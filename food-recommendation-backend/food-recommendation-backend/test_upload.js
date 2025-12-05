const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

// 配置测试服务器地址
const BASE_URL = 'http://localhost:4444/api';

// 测试数据
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123'
};

let authToken = '';
let uploadId = '';

// 获取认证令牌
async function getAuthToken() {
  console.log('\n=== 获取认证令牌 ===');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login/email`, testUser);
    if (response.data.success && response.data.data.token) {
      authToken = response.data.data.token;
      console.log('✅ 获取到认证令牌');
      return true;
    }
  } catch (error) {
    console.log('❌ 获取认证令牌失败:', error.response?.data || error.message);
  }
  return false;
}

// 测试上传菜单图片
async function testUploadMenu() {
  console.log('\n=== 测试上传菜单图片 ===');
  try {
    // 检查测试图片是否存在
    const testImagePath = './uploads/1.png';
    if (!fs.existsSync(testImagePath)) {
      console.log('❌ 测试图片不存在:', testImagePath);
      return;
    }

    // 创建FormData
    const formData = new FormData();
    formData.append('image', fs.createReadStream(testImagePath));
    formData.append('restaurant_id', '1');
    formData.append('window_number', '1');

    const response = await axios.post(`${BASE_URL}/upload/menu`, formData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders()
      }
    });

    console.log('✅ 上传成功:', response.data);

    if (response.data.success && response.data.data.upload_id) {
      uploadId = response.data.data.upload_id;
      console.log('✅ 获取到上传ID:', uploadId);
    }
  } catch (error) {
    console.log('❌ 上传失败:', error.response?.data || error.message);
  }
}

// 测试获取识别结果
async function testGetResult() {
  console.log('\n=== 测试获取识别结果 ===');
  if (!uploadId) {
    console.log('❌ 没有上传ID，跳过获取结果');
    return;
  }

  // 等待识别完成
  console.log('⏳ 等待识别完成...');
  await new Promise(resolve => setTimeout(resolve, 15000)); // 15秒

  try {
    const response = await axios.get(`${BASE_URL}/upload/menu/${uploadId}/result`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log('✅ 获取结果成功:', response.data);
  } catch (error) {
    console.log('❌ 获取结果失败:', error.response?.data || error.message);
  }
}

// 测试上传无效文件类型
async function testInvalidFileType() {
  console.log('\n=== 测试上传无效文件类型 ===');
  try {
    // 创建一个文本文件作为测试
    const invalidFilePath = './test_invalid.txt';
    fs.writeFileSync(invalidFilePath, 'This is not an image');

    const formData = new FormData();
    formData.append('image', fs.createReadStream(invalidFilePath));

    const response = await axios.post(`${BASE_URL}/upload/menu`, formData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders()
      }
    });

    console.log('❌ 无效文件上传成功（不应该发生）:', response.data);
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 无效文件类型正确被拒绝');
    } else {
      console.log('❌ 无效文件类型处理错误:', error.response?.data || error.message);
    }
  } finally {
    // 清理测试文件
    if (fs.existsSync('./test_invalid.txt')) {
      fs.unlinkSync('./test_invalid.txt');
    }
  }
}

// 测试未认证上传
async function testUnauthenticatedUpload() {
  console.log('\n=== 测试未认证上传 ===');
  try {
    const testImagePath = './uploads/1.png';
    if (!fs.existsSync(testImagePath)) {
      console.log('❌ 测试图片不存在');
      return;
    }

    const formData = new FormData();
    formData.append('image', fs.createReadStream(testImagePath));

    const response = await axios.post(`${BASE_URL}/upload/menu`, formData, {
      headers: formData.getHeaders()
    });

    console.log('❌ 未认证上传成功（不应该发生）:', response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ 未认证上传正确被拒绝');
    } else {
      console.log('❌ 未认证上传处理错误:', error.response?.data || error.message);
    }
  }
}

// 测试获取不存在的结果
async function testGetNonExistentResult() {
  console.log('\n=== 测试获取不存在的结果 ===');
  try {
    const response = await axios.get(`${BASE_URL}/upload/menu/non_existent_id/result`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log('❌ 获取不存在结果成功（不应该发生）:', response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('✅ 获取不存在结果正确返回404');
    } else {
      console.log('❌ 获取不存在结果处理错误:', error.response?.data || error.message);
    }
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始验证图片上传功能');

  // 检查服务器是否运行
  try {
    await axios.get('http://localhost:4444/health');
    console.log('✅ 服务器正在运行');
  } catch (error) {
    console.log('❌ 服务器未运行，请先启动服务器: npm run dev');
    return;
  }

  // 获取认证令牌
  if (!(await getAuthToken())) {
    console.log('❌ 无法获取认证令牌，测试终止');
    return;
  }

  await testUploadMenu();
  await testGetResult();
  await testInvalidFileType();
  await testUnauthenticatedUpload();
  await testGetNonExistentResult();

  console.log('\n🎉 测试完成');
}

// 运行测试
runTests().catch(console.error);