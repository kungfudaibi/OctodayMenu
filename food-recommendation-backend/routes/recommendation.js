const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const { getRandomRecommendations } = require('../utils/recommendationEngine');

const router = express.Router();

// 随机推荐
router.get('/random', auth, async (req, res) => {
  try {
    const { limit = 10, exclude_tried = true } = req.query;
    
    const recommendations = await getRandomRecommendations(
      req.user.id, 
      parseInt(limit), 
      exclude_tried === 'true'
    );
    
    // 获取用户偏好
    const preferencesResult = await query(
      `SELECT spicy_pref, sweet_pref, salty_pref, sour_pref, bitter_pref 
       FROM user_flavor_preferences 
       WHERE user_id = $1`,
      [req.user.id]
    );
    
    const userPreferences = preferencesResult.rows.length > 0 ? {
      spicy: preferencesResult.rows[0].spicy_pref,
      sweet: preferencesResult.rows[0].sweet_pref,
      salty: preferencesResult.rows[0].salty_pref,
      sour: preferencesResult.rows[0].sour_pref,
      bitter: preferencesResult.rows[0].bitter_pref
    } : {
      spicy: 3,
      sweet: 3,
      salty: 3,
      sour: 3,
      bitter: 3
    };
    
    res.json({
      success: true,
      data: {
        recommendations: recommendations.map(row => ({
          dish: {
            // ...
            image_url: row.dish_image ? `/data/${row.dish_image}` : null,
            // ...
          },
          restaurant: {
            // ...
            image_url: row.restaurant_image ? `/data/${row.restaurant_image}` : null
          },
        })),
        user_preferences: userPreferences
      }
    });
  } catch (error) {
    console.error('Random recommendations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 基于口味的推荐
router.get('/flavor-based', auth, async (req, res) => {
  try {
    const { limit = 10, spicy, sweet, salty, sour, bitter, exclude_tried = true } = req.query;

    // 如果没有传入口味参数，从用户偏好表获取
    let spicyPref = spicy;
    let sweetPref = sweet;
    let saltyPref = salty;
    let sourPref = sour;
    let bitterPref = bitter;

    if (!spicyPref || !sweetPref || !saltyPref || !sourPref || !bitterPref) {
      const prefResult = await query(
        `SELECT spicy_pref, sweet_pref, salty_pref, sour_pref, bitter_pref FROM user_flavor_preferences WHERE user_id = $1`,
        [req.user.id]
      );
      if (prefResult.rows.length > 0) {
        spicyPref = spicyPref || prefResult.rows[0].spicy_pref;
        sweetPref = sweetPref || prefResult.rows[0].sweet_pref;
        saltyPref = saltyPref || prefResult.rows[0].salty_pref;
        sourPref = sourPref || prefResult.rows[0].sour_pref;
        bitterPref = bitterPref || prefResult.rows[0].bitter_pref;
      } else {
        spicyPref = spicyPref || 3;
        sweetPref = sweetPref || 3;
        saltyPref = saltyPref || 3;
        sourPref = sourPref || 3;
        bitterPref = bitterPref || 3;
      }
    }

    // 构建查询，按口味距离（越小越匹配）排序
    const params = [spicyPref, sweetPref, saltyPref, sourPref, bitterPref];
    let idx = 6; // param index start for SQL ($6 etc.)

    let sql = `
      SELECT 
        d.id AS dish_id,
        d.name AS dish_name,
        d.price,
        d.image_url AS dish_image,
        r.id AS restaurant_id,
        r.name AS restaurant_name,
        dfp.spicy_level, dfp.sweet_level, dfp.salty_level, dfp.sour_level, dfp.bitter_level,
        (ABS(dfp.spicy_level - $1) + ABS(dfp.sweet_level - $2) + ABS(dfp.salty_level - $3) + ABS(dfp.sour_level - $4) + ABS(dfp.bitter_level - $5)) AS flavor_score
      FROM dishes d
      JOIN dish_flavor_profiles dfp ON d.id = dfp.dish_id
      JOIN restaurants r ON d.restaurant_id = r.id
    `;

    if (exclude_tried === 'true' || exclude_tried === true) {
      sql += ` WHERE d.id NOT IN (SELECT dish_id FROM user_dish_history WHERE user_id = $6)`;
      params.push(req.user.id);
      idx = 7;
    }

    sql += ` ORDER BY flavor_score ASC, RANDOM() LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    res.json({
      success: true,
      data: {
        recommendations: result.rows.map(row => ({
          dish: {
            id: row.dish_id,
            name: row.dish_name,
            price: row.price,
            image_url: row.dish_image ? `/data/${row.dish_image}` : null
          },
          restaurant: {
            id: row.restaurant_id,
            name: row.restaurant_name,
            image_url: row.restaurant_image ? `/data/${row.restaurant_image}` : null
          },
          match_score: (1 / (1 + row.flavor_score)).toFixed(2),
          reason: '基于口味偏好匹配排序'
        })),
        user_preferences: {
          spicy: Number(spicyPref),
          sweet: Number(sweetPref),
          salty: Number(saltyPref),
          sour: Number(sourPref),
          bitter: Number(bitterPref)
        }
      }
    });
  } catch (error) {
    console.error('Flavor-based recommendations error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

module.exports = router;