import { ref } from 'vue';

// 创建用户状态存储
export const useUserStore = () => {
    const userInfo = ref(null);
    const token = ref('');
    const isLogin = ref(false);

    // 设置用户信息
    const setUserInfo = (info) => {
        userInfo.value = info;
        // 存储到本地
        uni.setStorageSync('userInfo', info);
    };

    // 设置token
    const setToken = (newToken) => {
        token.value = newToken;
        // 存储到本地
        uni.setStorageSync('token', newToken);
    };

    // 设置登录状态
    const setLoginState = (state) => {
        isLogin.value = state;
        // 存储到本地
        uni.setStorageSync('isLogin', state);
    };

    // 初始化用户状态
    const initUserState = () => {
        const storedUserInfo = uni.getStorageSync('userInfo');
        const storedToken = uni.getStorageSync('token');
        const storedLoginState = uni.getStorageSync('isLogin');

        if (storedUserInfo) {
            userInfo.value = storedUserInfo;
        }
        if (storedToken) {
            token.value = storedToken;
        }
        if (storedLoginState) {
            isLogin.value = storedLoginState;
        }
    };

    // 清除用户状态
    const clearUserState = () => {
        userInfo.value = null;
        token.value = '';
        isLogin.value = false;
        uni.clearStorageSync();
    };

    return {
        userInfo,
        token,
        isLogin,
        setUserInfo,
        setToken,
        setLoginState,
        initUserState,
        clearUserState
    };
};