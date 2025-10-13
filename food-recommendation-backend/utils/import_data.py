import json
import psycopg2
import re
from psycopg2.extras import execute_values

# 数据库连接配置
DB_CONFIG = {
    "dbname": "restaurant_db",
    "user": "qie",
    "password": "qie",
    "host": "localhost",
    "port": "5432"
}

# 价格解析函数
def parse_price_advanced(price_text):
    """
    更健壮的价格解析函数，处理各种格式的价格文本
    """
    # 常见价格模式
    patterns = [
        # 匹配 "小份X元，大份Y元" 格式
        r'小份[^\d]*(\d+\.?\d*)[^\d]*[，,]\s*大份[^\d]*(\d+\.?\d*)',
        # 匹配 "X元" 格式
        r'(\d+\.?\d*)[元]',
        # 匹配纯数字
        r'(\d+\.?\d*)',
    ]
    
    prices = []
    original_text = price_text
    
    for pattern in patterns:
        matches = re.findall(pattern, price_text)
        if matches:
            for match in matches:
                if isinstance(match, tuple):
                    # 如果有多个捕获组，处理每个组
                    for m in match:
                        if m:  # 确保不是空字符串
                            try:
                                prices.append(float(m))
                            except ValueError:
                                pass
                else:
                    # 单个捕获组
                    try:
                        prices.append(float(match))
                    except ValueError:
                        pass
            break  # 找到一个匹配的模式就停止
    
    # 如果没有找到任何价格，尝试更宽松的匹配
    if not prices:
        # 提取所有数字
        numbers = re.findall(r'\d+\.?\d*', price_text)
        prices = [float(num) for num in numbers if num]
    
    if not prices:
        return None, None, original_text
    
    # 计算最小和最大价格
    min_price = min(prices)
    max_price = max(prices)
    
    # 如果只有一个价格，最小和最大相同
    if len(prices) == 1:
        max_price = min_price
    
    return min_price, max_price, original_text

# 读取JSON文件
with open('res.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 连接到数据库
conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

# 处理每个餐厅数据
for restaurant_data in data:
    # 提取餐厅信息
    restaurant_name = restaurant_data["content"]["店名"]
    
    # 插入餐厅数据
    cur.execute(
        "INSERT INTO restaurants (name) VALUES (%s) RETURNING id",
        (restaurant_name,)
    )
    restaurant_id = cur.fetchone()[0]
    
    # 处理菜品数据
    dishes = restaurant_data["content"]["菜品"]
    dish_values = []
    
    for dish in dishes:
        dish_name = dish["名称"]
        price_text = dish["价格"]
        image_url = restaurant_data.get("image", "")
        
        # 解析价格
        min_price, max_price, original_price = parse_price_advanced(price_text)
        
        # 如果无法解析价格，使用默认值
        if min_price is None:
            min_price = 0
            max_price = 0
        
        dish_values.append((
            restaurant_id,
            dish_name,
            min_price,  # 使用最小价格作为主要价格
            original_price,  # 存储原始价格文本
            min_price,  # 最小价格
            max_price,  # 最大价格
            image_url
        ))
    
    # 批量插入菜品数据
    execute_values(
        cur,
        "INSERT INTO dishes (restaurant_id, name, price, original_price_text, min_price, max_price, image_url) VALUES %s",
        dish_values
    )

# 提交事务并关闭连接
conn.commit()
cur.close()
conn.close()

print("数据导入完成！")

