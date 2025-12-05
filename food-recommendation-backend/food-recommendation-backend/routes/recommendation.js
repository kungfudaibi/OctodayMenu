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

module.exports = router;