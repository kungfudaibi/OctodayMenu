const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// 获取餐厅列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sort = 'name' } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [limit, offset];
    let paramIndex = 3;

    if (search) {
      whereClause = 'WHERE name ILIKE $' + paramIndex;
      params.push(`%${search}%`);
      paramIndex++;
    }

    let orderBy = 'name ASC';
    if (sort === 'rating') {
      orderBy = 'average_rating DESC';
    } else if (sort === 'popularity') {
      orderBy = 'rating_count DESC';
    }

    const restaurantsQuery = `
      SELECT id, name, window_number, image_url, average_rating, rating_count, dish_count
      FROM restaurants
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM restaurants
      ${whereClause}
    `;

    const [restaurantsResult, countResult] = await Promise.all([
      query(restaurantsQuery, params),
      query(countQuery, params.slice(2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        restaurants: restaurantsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages
        }
      }
    });
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 获取餐厅详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const restaurantQuery = `
      SELECT r.*, json_agg(
        json_build_object(
          'id', d.id,
          'name', d.name,
          'price', d.price,
          'image_url', d.image_url,
          'average_rating', d.average_rating,
          'rating_count', d.rating_count,
          'flavor_profile', d.flavor_profile
        )
      ) as dishes
      FROM restaurants r
      LEFT JOIN dishes d ON r.id = d.restaurant_id
      WHERE r.id = $1
      GROUP BY r.id
    `;

    const result = await query(restaurantQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found'
        }
      });
    }

    const restaurant = result.rows[0];

    res.json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    console.error('Get restaurant detail error:', error);
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