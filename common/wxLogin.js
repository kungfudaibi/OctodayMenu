/**
 * 微信登录处理工具
 */
export const wxLogin = async () => {
    try {
        // 获取用户登录凭证code
        const loginRes = await uni.login({
            provider: 'weixin'
        });

        if (loginRes.errMsg !== 'login:ok') {
            throw new Error('登录失败');
        }

        // 获取用户信息
        const userInfoRes = await uni.getUserProfile({
            desc: '用于完善用户资料',
            lang: 'zh_CN'
        });

        if (userInfoRes.errMsg !== 'getUserProfile:ok') {
            throw new Error('获取用户信息失败');
        }

        // 返回登录结果
        return {
            code: loginRes.code,
            userInfo: userInfoRes.userInfo
        };
    } catch (error) {
        // 统一错误处理
        uni.showToast({
            title: error.message || '登录失败，请重试',
            icon: 'none'
        });
        throw error;
    }
};

/**
 * 检查微信登录状态
 */
export const checkWxLoginStatus = () => {
    return new Promise((resolve) => {
        uni.checkSession({
            success() {
                // session_key 未过期
                resolve(true);
            },
            fail() {
                // session_key 已经失效，需要重新执行登录流程
                resolve(false);
            }
        });
    });
};