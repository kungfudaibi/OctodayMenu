const axios = require('axios');

// 配置测试服务器地址
const BASE_URL = 'http://localhost:4444/api';

// 测试数据
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  nickname: '测试用户'
};

let authToken = '';

// 测试邮箱注册功能
async function testEmailRegistration() {
  console.log('\n=== 测试邮箱注册功能 ===');
  try {
    const response = await axios.post(`${BASE_URL}/auth/register/email`, testUser);
    console.log('✅ 注册成功:', response.data);

    if (response.data.success && response.data.data.token) {
      authToken = response.data.data.token;
      console.log('✅ 获取到认证令牌');
    }
  } catch (error) {
    console.log('❌ 注册失败:', error.response?.data || error.message);
  }
}

// 测试邮箱登录功能
async function testEmailLogin() {
  console.log('\n=== 测试邮箱登录功能 ===');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login/email`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ 登录成功:', response.data);

    if (response.data.success && response.data.data.token) {
      authToken = response.data.data.token;
      console.log('✅ 获取到认证令牌');
    }
  } catch (error) {
    console.log('❌ 登录失败:', error.response?.data || error.message);
  }
}

// 测试重复注册（应该失败）
async function testDuplicateRegistration() {
  console.log('\n=== 测试重复注册（应该失败） ===');
  try {
    const response = await axios.post(`${BASE_URL}/auth/register/email`, testUser);
    console.log('❌ 重复注册成功（不应该发生）:', response.data);
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.code === 'EMAIL_EXISTS') {
      console.log('✅ 重复注册正确被拒绝:', error.response.data);
    } else {
      console.log('❌ 重复注册处理错误:', error.response?.data || error.message);
    }
  }
}

// 测试获取用户信息（需要认证）
async function testGetUserProfile() {
  console.log('\n=== 测试获取用户信息 ===');
  try {
    const response = await axios.get(`${BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('✅ 获取用户信息成功:', response.data);
  } catch (error) {
    console.log('❌ 获取用户信息失败:', error.response?.data || error.message);
  }
}

// 测试无效认证
async function testInvalidAuth() {
  console.log('\n=== 测试无效认证 ===');
  try {
    const response = await axios.get(`${BASE_URL}/auth/me`, {
      headers: {
        'Authorization': 'Bearer invalid_token'
      }
    });
    console.log('❌ 无效认证成功（不应该发生）:', response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ 无效认证正确被拒绝:', error.response.data);
    } else {
      console.log('❌ 无效认证处理错误:', error.response?.data || error.message);
    }
  }
}

// 测试输入验证
async function testInputValidation() {
  console.log('\n=== 测试输入验证 ===');

  // 测试注册缺少字段
  try {
    await axios.post(`${BASE_URL}/auth/register/email`, { email: 'test@test.com' });
    console.log('❌ 缺少字段注册成功（不应该发生）');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 缺少字段注册正确被拒绝');
    }
  }

  // 测试登录缺少字段
  try {
    await axios.post(`${BASE_URL}/auth/login/email`, { email: 'test@test.com' });
    console.log('❌ 缺少字段登录成功（不应该发生）');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 缺少字段登录正确被拒绝');
    }
  }
}

// 测试微信登录（模拟）
async function testWeChatLogin() {
  console.log('\n=== 测试微信登录（模拟） ===');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login/wechat`, {
      code: 'test_wechat_code'
    });
    console.log('❌ 微信登录成功（不应该发生，因为没有真实code）:', response.data);
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 微信登录正确处理无效code');
    } else {
      console.log('❌ 微信登录处理错误:', error.response?.data || error.message);
    }
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始验证注册登录功能');

  // 检查服务器是否运行
  try {
    await axios.get('http://localhost:4444/health');
    console.log('✅ 服务器正在运行');
  } catch (error) {
    console.log('❌ 服务器未运行，请先启动服务器: npm run dev');
    return;
  }

  await testEmailRegistration();
  await testDuplicateRegistration();
  await testEmailLogin();
  await testGetUserProfile();
  await testInvalidAuth();
  await testInputValidation();
  await testWeChatLogin();

  console.log('\n🎉 测试完成');
}

// 运行测试
runTests().catch(console.error);