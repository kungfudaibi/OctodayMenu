const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// 添加消费历史
router.post('/history', auth, async (req, res) => {
  try {
    const { dish_id, restaurant_id, rating, notes } = req.body;

    if (!dish_id || !restaurant_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dish ID and restaurant ID are required'
        }
      });
    }

    const result = await query(
      `INSERT INTO user_history (user_id, dish_id, restaurant_id, rating, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.user.id, dish_id, restaurant_id, rating, notes]
    );

    res.status(201).json({
      success: true,
      data: {
        history_id: result.rows[0].id
      }
    });
  } catch (error) {
    console.error('Add history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 获取消费历史
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const historyQuery = `
      SELECT h.*,
             json_build_object(
               'id', d.id,
               'name', d.name,
               'price', d.price,
               'image_url', d.image_url
             ) as dish,
             json_build_object(
               'id', r.id,
               'name', r.name,
               'window_number', r.window_number
             ) as restaurant
      FROM user_history h
      JOIN dishes d ON h.dish_id = d.id
      JOIN restaurants r ON h.restaurant_id = r.id
      WHERE h.user_id = $1
      ORDER BY h.consumed_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM user_history
      WHERE user_id = $1
    `;

    const [historyResult, countResult] = await Promise.all([
      query(historyQuery, [req.user.id, limit, offset]),
      query(countQuery, [req.user.id])
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        history: historyResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages
        }
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 添加收藏
router.post('/favorites', auth, async (req, res) => {
  try {
    const { dish_id, restaurant_id } = req.body;

    if (!dish_id || !restaurant_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dish ID and restaurant ID are required'
        }
      });
    }

    // 检查是否已收藏
    const existing = await query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND dish_id = $2',
      [req.user.id, dish_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_FAVORITED',
          message: 'Dish already favorited'
        }
      });
    }

    const result = await query(
      `INSERT INTO user_favorites (user_id, dish_id, restaurant_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [req.user.id, dish_id, restaurant_id]
    );

    res.status(201).json({
      success: true,
      data: {
        favorite_id: result.rows[0].id
      }
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 获取收藏列表
router.get('/favorites', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const favoritesQuery = `
      SELECT f.*,
             json_build_object(
               'id', d.id,
               'name', d.name,
               'price', d.price,
               'image_url', d.image_url,
               'average_rating', d.average_rating
             ) as dish,
             json_build_object(
               'id', r.id,
               'name', r.name,
               'window_number', r.window_number
             ) as restaurant
      FROM user_favorites f
      JOIN dishes d ON f.dish_id = d.id
      JOIN restaurants r ON f.restaurant_id = r.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM user_favorites
      WHERE user_id = $1
    `;

    const [favoritesResult, countResult] = await Promise.all([
      query(favoritesQuery, [req.user.id, limit, offset]),
      query(countQuery, [req.user.id])
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        favorites: favoritesResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages
        }
      }
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 删除收藏
router.delete('/favorites/:favoriteId', auth, async (req, res) => {
  try {
    const { favoriteId } = req.params;

    const result = await query(
      'DELETE FROM user_favorites WHERE id = $1 AND user_id = $2 RETURNING id',
      [favoriteId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FAVORITE_NOT_FOUND',
          message: 'Favorite not found'
        }
      });
    }

    res.json({
      success: true,
      data: null
    });
  } catch (error) {
    console.error('Delete favorite error:', error);
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