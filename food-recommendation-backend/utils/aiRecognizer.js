const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { query } = require('../config/database');

// 调用真实的AI识别功能
const recognizeMenu = async (imagePath, uploadId, restaurantId, windowNumber) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Node cwd:', process.cwd());
      console.log('imagePath:', imagePath);
      console.log('resolved:', path.resolve(imagePath));
      // 调用Python脚本进行AI识别
      const pythonProcess = spawn('python3', [
        path.join(__dirname, 'request.py'),
        path.resolve(imagePath)
      ], {
        cwd: process.cwd(), // 在项目根目录运行
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        try {
          if (code !== 0) {
            throw new Error(`Python script failed with code ${code}: ${stderr}`);
          }

          // 解析Python脚本的输出，找到保存的结果文件
          const imageName = path.parse(imagePath).name;
          const projectRoot = path.join(__dirname, '..');
          const dataDir = path.join(projectRoot, 'results');

          // 查找最新生成的JSON文件
          let resultFiles = [];
          
          try {
            // 在results目录中查找
            const files = fs.readdirSync(dataDir);
            resultFiles = files.filter(file =>
              file.startsWith(`parsed_${imageName}_`) && file.endsWith('.json')
            );
          } catch (error) {
            console.warn('Error reading results directory:', error.message);
          }

          if (resultFiles.length === 0) {
            throw new Error('No parsed result file found');
          }

          // 按时间倒序排序
          resultFiles.sort().reverse();
          const latestResultFile = path.join(dataDir, resultFiles[0]);
          const resultContent = fs.readFileSync(latestResultFile, 'utf-8');
          const parsedData = JSON.parse(resultContent);

          // 解析识别结果
          const recognitionResult = parseRecognitionResult(parsedData, restaurantId, windowNumber);

          // 将识别到的餐厅和菜品插入数据库
          await saveRecognitionResults(recognitionResult, uploadId);

          resolve(recognitionResult);

        } catch (error) {
          console.error('Error processing recognition result:', error);
          reject(error);
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

// 解析AI识别结果
const parseRecognitionResult = (parsedData, providedRestaurantId, windowNumber) => {
  try {
    // 假设parsedData的结构如下：
    // {
    //   "店名": "餐厅名称",
    //   "菜品": [
    //     {"名称": "菜品名", "价格": "价格文本"},
    //     ...
    //   ]
    // }

    const restaurant = {
      id: providedRestaurantId || null,
      name: parsedData.店名 || parsedData.restaurant_name || "未知餐厅",
      window_number: windowNumber || parsedData.window_number || "未知"
    };

    const dishes = [];
    if (parsedData.菜品 && Array.isArray(parsedData.菜品)) {
      for (const dish of parsedData.菜品) {
        const priceInfo = parsePrice(dish.价格 || dish.price || "0");

        dishes.push({
          name: dish.名称 || dish.name || "未知菜品",
          price: priceInfo.price,
          min_price: priceInfo.minPrice,
          max_price: priceInfo.maxPrice,
          original_price_text: dish.价格 || dish.price || "",
          confidence: dish.confidence || 0.9
        });
      }
    }

    return {
      restaurant,
      dishes,
      raw_data: parsedData
    };

  } catch (error) {
    console.error('Error parsing recognition result:', error);
    throw new Error('Failed to parse AI recognition result');
  }
};

// 解析价格文本
const parsePrice = (priceText) => {
  if (!priceText || typeof priceText !== 'string') {
    return { price: 0, minPrice: 0, maxPrice: 0 };
  }

  // 使用正则表达式提取价格
  const priceRegex = /(\d+\.?\d*)/g;
  const matches = priceText.match(priceRegex);

  if (!matches) {
    return { price: 0, minPrice: 0, maxPrice: 0 };
  }

  const prices = matches.map(m => parseFloat(m)).sort((a, b) => a - b);

  return {
    price: prices[0], // 使用最低价作为主要价格
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1]
  };
};

// 保存识别结果到数据库
const saveRecognitionResults = async (recognitionResult, uploadId) => {
  let client;
  try {
    client = await require('../config/database').getClient();

    await client.query('BEGIN');

    let restaurantId = recognitionResult.restaurant.id;

    // 如果没有提供餐厅ID，创建新餐厅
    if (!restaurantId) {
      try {
        const restaurantResult = await client.query(
          `INSERT INTO restaurants (name, window_number)
           VALUES ($1, $2)
           ON CONFLICT (name, window_number) DO UPDATE SET
             name = EXCLUDED.name
           RETURNING id`,
          [recognitionResult.restaurant.name, recognitionResult.restaurant.window_number]
        );
        restaurantId = restaurantResult.rows[0].id;
      } catch (error) {
        console.warn('Failed to insert/update restaurant, using name-based lookup:', error.message);
        // 尝试查找现有餐厅
        const existingRestaurant = await client.query(
          'SELECT id FROM restaurants WHERE name = $1',
          [recognitionResult.restaurant.name]
        );
        if (existingRestaurant.rows.length > 0) {
          restaurantId = existingRestaurant.rows[0].id;
        }
      }
    }

    // 插入菜品
    if (restaurantId && Array.isArray(recognitionResult.dishes)) {
      for (const dish of recognitionResult.dishes) {
        const dishName = dish.name || '未知菜品';
        const parsedPrice = Number.parseFloat(dish.price);
        const normalizedPrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;

        try {
          const updateResult = await client.query(
            `UPDATE dishes
             SET price = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE restaurant_id = $1 AND name = $2`,
            [restaurantId, dishName, normalizedPrice]
          );

          if (updateResult.rowCount === 0) {
            await client.query(
              `INSERT INTO dishes (restaurant_id, name, price)
               VALUES ($1, $2, $3)`,
              [restaurantId, dishName, normalizedPrice]
            );
          }
        } catch (error) {
          console.warn(`Failed to upsert dish ${dishName}:`, error.message);
        }
      }
    }

    await client.query('COMMIT');

  } catch (error) {
    console.error('Database operation failed:', error);
    // 不抛出错误，继续处理
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = {
  recognizeMenu
};