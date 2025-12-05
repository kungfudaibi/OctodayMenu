const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// 获取菜品详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const dishQuery = `
      SELECT d.*,
             json_build_object(
               'id', r.id,
               'name', r.name,
               'window_number', r.window_number
             ) as restaurant
      FROM dishes d
      JOIN restaurants r ON d.restaurant_id = r.id
      WHERE d.id = $1
    `;

    const result = await query(dishQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISH_NOT_FOUND',
          message: 'Dish not found'
        }
      });
    }

    const dish = result.rows[0];

    res.json({
      success: true,
      data: dish
    });
  } catch (error) {
    console.error('Get dish detail error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 获取菜品评价
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, sort = 'recent' } = req.query;

    const offset = (page - 1) * limit;

    let orderBy = 'created_at DESC';
    if (sort === 'helpful') {
      orderBy = 'helpful_count DESC, created_at DESC';
    }

    const reviewsQuery = `
      SELECT r.*,
             json_build_object(
               'id', u.id,
               'nickname', u.nickname,
               'avatar', u.avatar
             ) as user
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.dish_id = $1
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM reviews
      WHERE dish_id = $1
    `;

    const [reviewsResult, countResult] = await Promise.all([
      query(reviewsQuery, [id, limit, offset]),
      query(countQuery, [id])
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        reviews: reviewsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages
        }
      }
    });
  } catch (error) {
    console.error('Get dish reviews error:', error);
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