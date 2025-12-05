const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { query } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// 邮箱注册
router.post('/register/email', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;
    
    // 验证输入
    if (!email || !password || !nickname) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email, password and nickname are required'
        }
      });
    }
    
    // 检查邮箱是否已存在
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already exists'
        }
      });
    }
    
    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // 创建用户
    const result = await query(
      'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username',
      [email, hashedPassword, nickname]
    );
    
    // 生成JWT令牌
    const token = jwt.sign(
      { userId: result.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.rows[0],
        token: token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 邮箱登录
router.post('/login/email', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 验证输入
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
    }
    
    // 查找用户
    const userResult = await query(
      'SELECT id, email, username, wechat_avatar, password_hash FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }
    
    const user = userResult.rows[0];
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }
    
    // 生成JWT令牌
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // 移除密码哈希
    delete user.password_hash;
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: { id: user.id, email: user.email, nickname: user.username, avatar: user.wechat_avatar },
        token: token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 微信登录
router.post('/login/wechat', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'WeChat authorization code is required'
        }
      });
    }
    
    // 获取微信access_token
    const tokenResponse = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
      params: {
        appid: process.env.WECHAT_APP_ID,
        secret: process.env.WECHAT_APP_SECRET,
        code: code,
        grant_type: 'authorization_code'
      }
    });
    
    if (tokenResponse.data.errcode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WECHAT_ERROR',
          message: tokenResponse.data.errmsg
        }
      });
    }
    
    const { access_token, openid, unionid } = tokenResponse.data;
    
    // 获取微信用户信息
    const userInfoResponse = await axios.get('https://api.weixin.qq.com/sns/userinfo', {
      params: {
        access_token: access_token,
        openid: openid
      }
    });
    
    if (userInfoResponse.data.errcode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WECHAT_ERROR',
          message: userInfoResponse.data.errmsg
        }
      });
    }
    
    const { nickname, headimgurl: avatar } = userInfoResponse.data;
    
    // 检查用户是否已存在
    let userResult = await query(
      'SELECT id, username, email, wechat_nickname, wechat_avatar FROM users WHERE wechat_openid = $1',
      [openid]
    );
    
    let user;
    if (userResult.rows.length === 0) {
      // 创建新用户
      const insertResult = await query(
        `INSERT INTO users (wechat_openid, wechat_unionid, wechat_nickname, wechat_avatar, username) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, wechat_nickname, wechat_avatar`,
        [openid, unionid, nickname, avatar, `wx_${openid.slice(-8)}`]
      );
      user = insertResult.rows[0];
    } else {
      // 更新用户信息
      await query(
        `UPDATE users SET wechat_nickname = $1, wechat_avatar = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE wechat_openid = $3`,
        [nickname, avatar, openid]
      );
      user = userResult.rows[0];
    }
    
    // 生成JWT令牌
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({
      success: true,
      message: 'WeChat login successful',
      data: {
        user: {
          id: user.id,
          nickname: user.wechat_nickname,
          avatar: user.wechat_avatar
        },
        token: token
      }
    });
  } catch (error) {
    console.error('WeChat login error:', error);
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