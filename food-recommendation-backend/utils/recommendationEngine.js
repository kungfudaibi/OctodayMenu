const { query } = require('../config/database');

// 获取随机推荐
const getRandomRecommendations = async (userId, limit = 10, excludeTried = true) => {
  let queryText = `
    SELECT 
      d.id AS dish_id,
      d.name AS dish_name,
      d.price,
      d.image_url AS dish_image,
      r.id AS restaurant_id,
      r.name AS restaurant_name,
      r.floor,
      r.campus,
      r.window_number,
      r.store_name,
      r.image_url AS restaurant_image,
      EXTRACT(EPOCH FROM (NOW() - d.created_at)) / 86400 AS days_since_created
    FROM dishes d
    JOIN restaurants r ON d.restaurant_id = r.id
  `;
  
  const queryParams = [];
  
  // 排除用户已尝试过的菜品
  if (excludeTried) {
    queryText += `
      AND d.id NOT IN (
        SELECT dish_id FROM user_dish_history WHERE user_id = $1
      )
    `;
    queryParams.push(userId);
  }
  
  // 随机排序并限制数量
  queryText += `
    ORDER BY RANDOM()
    LIMIT $${queryParams.length + 1}
  `;
  queryParams.push(limit);
  
  const result = await query(queryText, queryParams);
  
  return result.rows.map(row => ({
    dish: {
      id: row.dish_id,
      name: row.dish_name,
      price: row.price,
      image_url: row.dish_image ? `/data/${row.dish_image}` : null
    },
    restaurant: {
      id: row.restaurant_id,
      name: row.restaurant_name,
      location: `${row.campus} ${row.floor}楼 ${row.store_name} ${row.window_number ? `第${row.window_number}号窗口` : ''}`.trim(),
      image_url: row.restaurant_image ? `/data/${row.restaurant_image}` : null
    },
    match_score: Math.random().toFixed(2), // 随机匹配分数
    reason: getRandomRecommendationReason() // 随机推荐理由
  }));
};

// 生成随机推荐理由
const getRandomRecommendationReason = () => {
  const reasons = [
    "这道菜品非常受欢迎，评分很高",
    "与您的口味偏好高度匹配",
    "最近新添加的菜品，值得一试",
    "这家餐厅的招牌菜之一",
    "价格实惠，性价比很高",
    "营养均衡，健康选择",
    "适合您当前的饮食偏好"
  ];
  
  return reasons[Math.floor(Math.random() * reasons.length)];
};

module.exports = {
  getRandomRecommendations
};