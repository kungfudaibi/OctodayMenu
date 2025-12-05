# 食物推荐系统API文档设计

## 快速开始

### 环境要求

- Node.js >= 14.0.0
- PostgreSQL >= 12.0

### 安装步骤

1. **克隆项目并安装依赖**

```bash
npm install
```

2. **环境配置**

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库和API密钥
```

3. **数据库设置**

```bash
# 创建PostgreSQL数据库
createdb food_recommendation

# 运行数据库迁移
psql -d food_recommendation -f migrations/create_tabels.sql
```

4. **启动服务器**

```bash
npm start
# 或者开发模式
npm run dev
```

服务器将在 `http://localhost:4444` 启动。

### 测试API

健康检查端点：

```bash
curl http://localhost:4444/health
```

### 自动化 API 测试（仓库内）

项目包含一个自动化测试脚本，用于对主要 API 端点进行检查并把结果保存到 `results/api_test_outputs/summary.json`。

- 脚本路径：`scripts/run_api_tests.sh`
- 使用方法（在项目根目录）：

```bash
# 在服务已运行的情况下运行（默认使用 PORT=4444）
PORT=4444 ./scripts/run_api_tests.sh
```

- 输出文件：`results/api_test_outputs/summary.json`
- 脚本会注册一个临时测试用户、登录获取 JWT、调用一组关键端点并保存响应，便于回归测试和 CI 集成。

### 最近一次测试（摘要）

基于仓库中运行的自动化测试脚本（输出文件：`results/api_test_outputs/summary.json`），下为每个主要 API 的最新快照：

- **GET /health** — 状态: 200 OK
  - 示例文件：`results/api_test_outputs/health.json`

- **POST /auth/register** — 状态: 201 Created (测试用户已注册)
  - 示例文件：`results/api_test_outputs/register.json`

- **POST /auth/login** — 状态: 200 OK (返回 JWT)
  - 示例文件：`results/api_test_outputs/login.json`

- **GET /restaurants** — 状态: 200 OK（分页列表，示例包含 `average_rating` / `rating_count` / `dish_count` 字段）
  - 示例文件：`results/api_test_outputs/restaurants_list.json`

- **GET /restaurants/{id}** — 状态: 200 OK（返回餐厅详情与 `dishes` 数组）
  - 示例文件：`results/api_test_outputs/restaurant_1.json`

- **GET /dishes/{id}** — 状态: 200 OK（返回菜品详情）
  - 示例文件：`results/api_test_outputs/dish_1.json`

- **GET /recommendations/random** — 状态: 200 OK（返回若干推荐项）
  - 示例文件：`results/api_test_outputs/recommendations_random.json`

- **GET /recommendations/flavor-based** — 状态: 200 OK（若无用户偏好会返回空数组）
  - 示例文件：`results/api_test_outputs/recommendations_flavor.json`

- **GET /user/history** — 状态: 200 OK（测试环境返回空历史）
  - 示例文件：`results/api_test_outputs/user_history.json`

- **GET /user/favorites** — 状态: 200 OK（测试环境返回空数组；历史上曾因 DB 字段命名导致 500，已修复）
  - 示例文件：`results/api_test_outputs/user_favorites.json`

- **POST /api/upload/menu (无文件)** — 状态: 401 AUTH_REQUIRED（需要认证）
  - 示例文件：`results/api_test_outputs/upload_no_file.json`

说明与建议：

- 测试脚本位于：`scripts/run_api_tests.sh`，它会依次注册并登录一个临时用户（获取 JWT），然后调用上述端点并将响应保存到 `results/api_test_outputs/` 目录下；你可以直接查看这些 JSON 文件以获取每个端点的原始响应。
- 如果你在部署到新数据库或 CI 环境遇到 500 错误，请先确认数据库 schema 是否包含代码期望的列（例如 `average_rating`、`rating_count`、`dish_count` 等），或者在代码中添加 null-safe 处理。仓库迁移文件：`migrations/create_tabels.sql`。
- 最近我们移除了临时向客户端暴露错误堆栈的调试改动，错误现在通过统一错误处理中间件以标准格式返回并记录到服务器日志。


## API基础信息

- **基础URL**: `https://api.food-recommendation.com/v1`
- **数据格式**: JSON
- **认证方式**: JWT Token (Bearer Token)

## 认证相关接口

下面是基于仓库自动化测试输出（`results/api_test_outputs/`）整理的真实请求路径和示例响应：

### 1. 微信登录/注册

```text
POST /login/wechat
```

- 说明：该登录方式存在于代码中，但未被自动化测试覆盖（需要微信 appid/配置进行集成测试）。

### 2. QQ登录/注册

- 说明：同微信，代码中可能有支持点位，自动化测试未覆盖，保留为 TODO。

### 3. 邮箱注册（实际接口）

```http
POST /auth/register
Content-Type: application/json

{
  "email": "test+1764898357@example.com",
  "password": "your_password",
  "nickname": "testuser1764898357"
}
```

示例响应（来自 `results/api_test_outputs/register.json`）：

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 13,
      "email": "test+1764898357@example.com",
      "username": "testuser1764898357"
    },
    "token": "<jwt_token>"
  }
}
```

### 4. 邮箱登录（实际接口）

```http
POST /auth/login
Content-Type: application/json

{
  "email": "test+1764898357@example.com",
  "password": "your_password"
}
```

示例响应（来自 `results/api_test_outputs/login.json`）：

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 13,
      "email": "test+1764898357@example.com",
      "nickname": "testuser1764898357",
      "avatar": null
    },
    "token": "<jwt_token>"
  }
}
```

> 注意：示例中的 `token` 值为测试时返回的 JWT；真实环境请妥善保存和使用 `Authorization: Bearer <token>`。

### 5. 邮箱验证

```http
GET /auth/verify-email?token=<verification_token>
```

示例响应（行为通用说明）：

```json
{
  "success": true,
  "message": "邮箱验证成功"
}
```

（如果你的部署没有此流程，验证链接或邮件发送可能未实现）

### 6. 获取当前用户信息

```http
GET /auth/me
Authorization: Bearer <token>
```

响应示例（通用字段）：

```json
{
  "success": true,
  "data": {
    "id": 123,
    "email": "user@example.com",
    "nickname": "用户昵称",
    "avatar": "头像URL",
    "preferences": {
      "spicy": 3,
      "sweet": 2,
      "salty": 4,
      "sour": 1,
      "bitter": 0
    }
  }
}
```

。

## 图片上传与识别接口

### 1. 上传菜单图片

```http
POST /upload/menu
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "image": [文件],
  "restaurant_id": 123, // 可选，如果已知餐厅ID
  "window_number": "A12" // 可选，窗口号
}
```

响应:

```json
{
  "success": true,
  "data": {
    "upload_id": "upload_123456",
    "status": "processing",
    "estimated_time": 10 // 预计处理时间(秒)
  }
}
```

### 2. 获取识别结果

```http
GET /upload/menu/{upload_id}/result
Authorization: Bearer <token>
```

响应:

```json
{
  "success": true,
  "data": {
    "status": "completed",
    "restaurant": {
      "id": 123,
      "name": "识别出的餐厅名称",
      "window_number": "A12"
    },
    "dishes": [
      {
        "name": "香辣鱼块",
        "price": 6.0,
        "confidence": 0.92 // 识别置信度
      },
      {
        "name": "干炸小酥肉",
        "price": 6.0,
        "confidence": 0.87
      }
    ],
    "raw_data": { /* 阿里云AI返回的原始数据 */ }
  }
}
```

### 3. 确认并保存识别结果

```http
POST /upload/menu/{upload_id}/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirmed_dishes": [1, 3, 5], // 确认的菜品ID数组
  "corrections": {
    "1": {"name": "修正的菜品名", "price": 7.0} // 可选，修正信息
  }
}
```

响应:

```json
{
  "success": true,
  "data": {
    "added_dishes": 5, // 成功添加的菜品数量
    "new_restaurant": false // 是否是新餐厅
  }
}
```

## 餐厅与菜品接口

### 1. 获取餐厅列表

```http
GET /restaurants
Query Parameters:
  - page: 1 (默认)
  - limit: 20 (默认)
  - search: "关键词" (可选)
  - sort: "name|rating|popularity" (默认: name)
```

响应:

```json
{
  "success": true,
  "data": {
    "restaurants": [
      {
        "id": 123,
        "name": "餐厅名称",
        "window_number": "A12",
        "image_url": "餐厅图片URL",
        "average_rating": 4.5,
        "rating_count": 120,
        "dish_count": 15
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### 2. 获取餐厅详情

```http
GET /restaurants/{id}
```

响应:

```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "餐厅名称",
    "window_number": "A12",
    "location": "位置描述",
    "operating_hours": {
      "monday": "9:00-21:00",
      "tuesday": "9:00-21:00",
      // ...
    },
    "contact_info": "联系方式",
    "image_url": "餐厅图片URL",
    "average_rating": 4.5,
    "rating_count": 120,
    "dishes": [
      {
        "id": 456,
        "name": "菜品名称",
        "price": 12.5,
        "image_url": "菜品图片URL",
        "average_rating": 4.2,
        "rating_count": 35,
        "flavor_profile": {
          "spicy": 3,
          "sweet": 2,
          "salty": 4,
          "sour": 1,
          "bitter": 0
        }
      }
    ]
  }
}
```

### 3. 获取菜品详情

```http
GET /dishes/{id}
```

响应:

```json
{
  "success": true,
  "data": {
    "id": 456,
    "name": "菜品名称",
    "description": "菜品描述",
    "price": 12.5,
    "original_price_text": "小份7元，大份8元",
    "min_price": 7.0,
    "max_price": 8.0,
    "image_url": "菜品图片URL",
    "restaurant": {
      "id": 123,
      "name": "餐厅名称",
      "window_number": "A12"
    },
    "average_rating": 4.2,
    "rating_count": 35,
    "flavor_profile": {
      "spicy": 3,
      "sweet": 2,
      "salty": 4,
      "sour": 1,
      "bitter": 0
    },
    "ingredients": ["原料1", "原料2"],
    "tags": ["辣", "推荐"]
  }
}
```

## 推荐接口

### 1. 随机推荐

```http
GET /recommendations/random
Authorization: Bearer <token>
Query Parameters:
  - limit: 10 (默认)
  - exclude_tried: true|false (默认: true, 排除已尝试过的)
```

响应:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "dish": {
          "id": 456,
          "name": "菜品名称",
          "price": 12.5,
          "image_url": "菜品图片URL",
          "average_rating": 4.2
        },
        "restaurant": {
          "id": 123,
          "name": "餐厅名称",
          "window_number": "A12"
        },
        "match_score": 0.87, // 与用户口味的匹配度
        "reason": "与您的口味偏好高度匹配" // 推荐理由
      }
    ],
    "user_preferences": {
      "spicy": 3,
      "sweet": 2,
      "salty": 4,
      "sour": 1,
      "bitter": 0
    }
  }
}
```

### 2. 基于口味的推荐

```http
GET /recommendations/flavor-based
Authorization: Bearer <token>
Query Parameters:
  - limit: 10 (默认)
  - spicy: 3 (可选，覆盖用户偏好)
  - sweet: 2 (可选)
  - salty: 4 (可选)
  - sour: 1 (可选)
  - bitter: 0 (可选)
```

响应格式同随机推荐。

### 3. 基于历史的推荐

```http
GET /recommendations/history-based
Authorization: Bearer <token>
Query Parameters:
  - limit: 10 (默认)
```

响应格式同随机推荐。

## 用户历史与收藏接口

### 1. 添加消费历史

```http
POST /user/history
Authorization: Bearer <token>
Content-Type: application/json

{
  "dish_id": 456,
  "restaurant_id": 123,
  "rating": 5, // 可选，1-5
  "notes": "很好吃" // 可选
}
```

响应:

```json
{
  "success": true,
  "data": {
    "history_id": 789
  }
}
```

### 2. 获取消费历史

```http
GET /user/history
Authorization: Bearer <token>
Query Parameters:
  - page: 1 (默认)
  - limit: 20 (默认)
```

响应:

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": 789,
        "dish": {
          "id": 456,
          "name": "菜品名称",
          "price": 12.5,
          "image_url": "菜品图片URL"
        },
        "restaurant": {
          "id": 123,
          "name": "餐厅名称",
          "window_number": "A12"
        },
        "consumed_at": "2023-06-15T12:30:00Z",
        "rating": 5,
        "notes": "很好吃"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### 3. 添加收藏

```http
POST /user/favorites
Authorization: Bearer <token>
Content-Type: application/json

{
  "dish_id": 456,
  "restaurant_id": 123
}
```

响应:

```json
{
  "success": true,
  "data": {
    "favorite_id": 101
  }
}
```

### 4. 获取收藏列表

```http
GET /user/favorites
Authorization: Bearer <token>
Query Parameters:
  - page: 1 (默认)
  - limit: 20 (默认)
```

响应格式类似消费历史。

### 5. 删除收藏

```http
DELETE /user/favorites/{favorite_id}
Authorization: Bearer <token>
```

响应:

```json
{
  "success": true,
  "data": null
}
```

## 评价接口

### 1. 提交评价

```http
POST /reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "dish_id": 456,
  "restaurant_id": 123,
  "rating": 5,
  "comment": "非常好吃，强烈推荐",
  "flavor_ratings": {
    "spicy": 3,
    "sweet": 2,
    "salty": 4,
    "sour": 1,
    "bitter": 0
  },
  "images": ["image1_url", "image2_url"] // 可选
}
```

响应:

```json
{
  "success": true,
  "data": {
    "review_id": 202
  }
}
```

### 2. 获取菜品评价

```http
GET /dishes/{id}/reviews
Query Parameters:
  - page: 1 (默认)
  - limit: 10 (默认)
  - sort: "recent|helpful" (默认: recent)
```

响应:

```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": 202,
        "user": {
          "id": 123,
          "nickname": "用户昵称",
          "avatar": "头像URL"
        },
        "rating": 5,
        "comment": "非常好吃，强烈推荐",
        "flavor_ratings": {
          "spicy": 3,
          "sweet": 2,
          "salty": 4,
          "sour": 1,
          "bitter": 0
        },
        "images": ["image1_url", "image2_url"],
        "helpful_count": 5,
        "created_at": "2023-06-15T12:30:00Z",
        "is_helpful": true // 当前用户是否认为有用
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

### 3. 评价有用性投票

```http
POST /reviews/{id}/helpful
Authorization: Bearer <token>
Content-Type: application/json

{
  "is_helpful": true
}
```

响应:

```json
{
  "success": true,
  "data": {
    "new_helpful_count": 6
  }
}
```

## 搜索接口

### 1. 全局搜索

```http
GET /search
Query Parameters:
  - q: "搜索关键词"
  - type: "all|dishes|restaurants" (默认: all)
  - page: 1 (默认)
  - limit: 20 (默认)
```

响应:

```json
{
  "success": true,
  "data": {
    "dishes": [
      {
        "id": 456,
        "name": "菜品名称",
        "price": 12.5,
        "image_url": "菜品图片URL",
        "restaurant": {
          "id": 123,
          "name": "餐厅名称",
          "window_number": "A12"
        }
      }
    ],
    "restaurants": [
      {
        "id": 123,
        "name": "餐厅名称",
        "window_number": "A12",
        "image_url": "餐厅图片URL"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

## 错误处理

所有API错误响应格式:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {} // 可选，额外错误信息
  }
}
```

常见错误码:

- `AUTH_REQUIRED`: 需要认证
- `INVALID_TOKEN`: 令牌无效
- `PERMISSION_DENIED`: 权限不足
- `RESOURCE_NOT_FOUND`: 资源不存在
- `VALIDATION_ERROR`: 参数验证失败
- `RATE_LIMITED`: 请求过于频繁
- `INTERNAL_ERROR`: 服务器内部错误

## AI图片识别功能

### 功能概述

系统集成了阿里云DashScope AI服务，能够自动识别菜单图片中的餐厅信息和菜品详情。

### 工作流程

1. **图片上传**: 用户通过API上传菜单图片
2. **AI识别**: 调用Python脚本使用阿里云AI识别图片内容
3. **数据解析**: 解析AI返回的JSON数据，提取餐厅和菜品信息
4. **数据库存储**: 自动将识别结果保存到数据库中

### API使用

#### 上传菜单图片

```http
POST /api/upload/menu
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "image": [图片文件],
  "restaurant_id": 123, // 可选，已知餐厅ID
  "window_number": "A12" // 可选，窗口号
}
```

#### 获取识别结果

```http
GET /api/upload/menu/{upload_id}/result
Authorization: Bearer <token>
```

### AI识别数据格式

AI识别结果应返回以下JSON格式：

```json
{
  "店名": "餐厅名称",
  "菜品": [
    {
      "名称": "菜品名称",
      "价格": "价格描述（如：小份8元，大份10元）"
    }
  ]
}
```

### 技术实现

- **Python脚本**: `utils/request.py` - 调用阿里云AI API
- **批量处理**: `utils/batch_request.py` - 批量图片处理
- **Node.js集成**: `utils/aiRecognizer.js` - 集成到Node.js应用
- **数据导入**: `utils/import_data.py` - 从JSON文件导入数据

### 环境配置

确保设置以下环境变量：

```bash
DASHSCOPE_API_KEY=your_dashscope_api_key
```

### 测试AI功能

运行测试脚本：

```bash
node test_ai.js
```

### 注意事项

1. 确保Python环境已安装所需依赖
2. AI识别结果会自动保存到数据库
3. 如果数据库字段不匹配，会记录警告但不中断流程
4. 图片文件会保存在 `uploads/`目录
5. AI识别结果会保存在图片目录的 `data/`子目录中
