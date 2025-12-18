const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { recognizeMenu } = require('../utils/aiRecognizer');

const router = express.Router();

// 上传菜单图片
router.post('/menu', auth, upload.single('image'), async (req, res) => {
  try {
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE',
          message: req.fileValidationError
        }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded'
        }
      });
    }
    
    const { restaurant_id, window_number } = req.body;
    const imagePath = req.file.path;
    
    // 生成唯一上传ID
    const uploadId = 'upload_' + Date.now();

    // 预先写入上传记录，便于查询任务状态
    await query(
      `INSERT INTO upload_results (upload_id, user_id, image_path, status)
       VALUES ($1, $2, $3, $4)`,
      [uploadId, req.user.id, imagePath, 'processing']
    );
    
    // 异步调用阿里云AI识别
    recognizeMenu(imagePath, uploadId, restaurant_id, window_number)
      .then(async (result) => {
        // 保存识别结果到数据库
        await query(
          `UPDATE upload_results
           SET status = $1,
               result_data = $2::jsonb,
               error_message = NULL
           WHERE upload_id = $3 AND user_id = $4`,
          ['completed', JSON.stringify(result), uploadId, req.user.id]
        );
      })
      .catch(async (error) => {
        console.error('AI recognition error:', error);
        
        // 保存错误状态到数据库
        await query(
          `UPDATE upload_results
           SET status = $1,
               error_message = $2
           WHERE upload_id = $3 AND user_id = $4`,
          ['failed', error.message || 'Recognition failed', uploadId, req.user.id]
        );
      });
    
    res.json({
      success: true,
      data: {
        upload_id: uploadId,
        status: 'processing',
        estimated_time: 10
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// 获取识别结果
router.get('/menu/:uploadId/result', auth, async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const result = await query(
      `SELECT status, result_data, error_message 
       FROM upload_results 
       WHERE upload_id = $1 AND user_id = $2`,
      [uploadId, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESULT_NOT_FOUND',
          message: 'Upload result not found'
        }
      });
    }
    
    const uploadResult = result.rows[0];
    
    if (uploadResult.status === 'failed') {
      return res.json({
        success: false,
        data: {
          status: 'failed',
          error: uploadResult.error_message
        }
      });
    }
    
    if (uploadResult.status === 'processing') {
      return res.json({
        success: true,
        data: {
          status: 'processing'
        }
      });
    }
    
    // 返回识别结果
    const resultData = JSON.parse(uploadResult.result_data);
    
    res.json({
      success: true,
      data: {
        status: 'completed',
        ...resultData
      }
    });
  } catch (error) {
    console.error('Get result error:', error);
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