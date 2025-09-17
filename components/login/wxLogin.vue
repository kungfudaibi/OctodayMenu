<!-- 登录组件 -->
<template>
    <view class="login-container">
        <view class="login-header">
            <image class="logo" src="/static/logo.png" mode="aspectFit"></image>
            <text class="title">欢迎登录</text>
        </view>
        
        <view class="login-body">
            <button class="login-btn wx-btn" @click="handleWxLogin" open-type="getUserProfile">
                <text class="iconfont icon-weixin"></text>
                微信一键登录
            </button>
            <view class="tips">
                登录即表示同意
                <text class="link" @click="navToAgreement">《用户协议》</text>
                和
                <text class="link" @click="navToPrivacy">《隐私政策》</text>
            </view>
        </view>
    </view>
</template>

<script setup>
import { wxLogin } from '@/common/wxLogin.js';
import { ref } from 'vue';

import { useUserStore } from '@/common/userStore.js';

// 初始化用户状态管理
const userStore = useUserStore();

// 处理微信登录
const handleWxLogin = async () => {
    try {
        const loginResult = await wxLogin();
        
        // 保存用户信息
        userStore.setUserInfo(loginResult.userInfo);
        // 设置登录状态
        userStore.setLoginState(true);
        // 如果后端返回token，也可以保存token
        if (loginResult.token) {
            userStore.setToken(loginResult.token);
        }
        
        // 触发登录成功事件
        emits('loginSuccess', loginResult);
        
        // 显示成功提示
        uni.showToast({
            title: '登录成功',
            icon: 'success'
        });
        
        // 延迟跳转到首页或用户中心
        setTimeout(() => {
            uni.switchTab({
                url: '/pages/ucenter/ucenter'
            });
        }, 1500);
        
    } catch (error) {
        console.error('登录失败:', error);
    }
};

// 页面跳转方法
const navToAgreement = () => {
    uni.navigateTo({
        url: '/pages/uni-agree/uni-agree?type=agreement'
    });
};

const navToPrivacy = () => {
    uni.navigateTo({
        url: '/pages/uni-agree/uni-agree?type=privacy'
    });
};

// 定义组件事件
const emits = defineEmits(['loginSuccess']);
</script>

<style lang="scss">
.login-container {
    padding: 30rpx;
    
    .login-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 60rpx;
        
        .logo {
            width: 200rpx;
            height: 200rpx;
            margin-bottom: 20rpx;
        }
        
        .title {
            font-size: 36rpx;
            font-weight: bold;
            color: #333;
        }
    }
    
    .login-body {
        .login-btn {
            width: 100%;
            height: 88rpx;
            line-height: 88rpx;
            margin-bottom: 30rpx;
            border-radius: 44rpx;
            font-size: 32rpx;
            
            &.wx-btn {
                background-color: #07c160;
                color: #ffffff;
                
                .iconfont {
                    margin-right: 10rpx;
                }
            }
        }
        
        .tips {
            font-size: 24rpx;
            color: #999;
            text-align: center;
            
            .link {
                color: #007aff;
                display: inline;
            }
        }
    }
}
</style>