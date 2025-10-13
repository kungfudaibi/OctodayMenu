const { recognizeMenu } = require('./utils/aiRecognizer');
const path = require('path');

// 测试AI识别功能
async function testAIRecognition() {
  try {
    console.log('开始测试AI识别功能...');

    // 使用一个示例图片路径（需要确保存在）
    const testImagePath = path.join(__dirname, 'uploads', '1.png');

    // 检查图片是否存在
    const fs = require('fs');
    if (!fs.existsSync(testImagePath)) {
      console.log('测试图片不存在，跳过AI调用，直接测试解析功能...');
      
      // 直接测试解析功能
      const mockData = {
        "店名": "测试餐厅",
        "菜品": [
          {"名称": "测试菜品1", "价格": "10元"},
          {"名称": "测试菜品2", "价格": "15元"}
        ]
      };
      
      const { parseRecognitionResult } = require('./utils/aiRecognizer');
      const result = parseRecognitionResult(mockData, null, 'A01');
      
      console.log('解析测试完成！');
      console.log('结果:', JSON.stringify(result, null, 2));
      return;
    }

    const result = await recognizeMenu(testImagePath, 'test_upload_123', null, 'A01');

    console.log('AI识别测试完成！');
    console.log('结果:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('AI识别测试失败:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  testAIRecognition();
}

module.exports = { testAIRecognition };