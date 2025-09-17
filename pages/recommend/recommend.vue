<template>
  <view class="recommend-container">
    <view class="card-container" :class="{ 'card-animation': isAnimating }">
      <view class="food-card" :style="cardScaleStyle">
        <image class="food-image" :src="foodInfo.image" mode="aspectFill"></image>
        <view class="image-overlay"></view>
        
        <view class="food-info">
          <text class="food-name">{{foodInfo.name}}</text>
          <view class="tags-container">
            <view class="tag" v-if="foodInfo.spicyLevel >= 0">
              <text class="tag-text">{{spicyLevels[foodInfo.spicyLevel]}}</text>
            </view>
            <block v-for="(tag, index) in foodInfo.tags" :key="index">
              <view class="tag">
                <text class="tag-text">{{tag}}</text>
              </view>
            </block>
          </view>
          
          <view class="price-rating">
            <text class="food-price">¥{{foodInfo.price}}</text>
            <view class="rating">
              <text class="rating-text">{{foodInfo.rating}}分</text>
              <text class="sales">月售{{foodInfo.sales}}份</text>
            </view>
          </view>
          
          <text class="description">{{foodInfo.description}}</text>
          
          <view class="restaurant-info">
            <text class="restaurant-name">{{foodInfo.restaurantName}}</text>
            <view class="delivery-info">
              <text class="distance">{{foodInfo.distance}}</text>
              <text class="delivery-time">{{foodInfo.deliveryTime}}</text>
            </view>
          </view>
        </view>
        
        <view class="actions">
          <view class="action-group">
            <button class="action-btn" bindtap="handleFavorite">
              <text class="btn-icon">{{isFavorited ? '❤️' : '🤍'}}</text>
              <text class="btn-text">{{isFavorited ? '已收藏' : '收藏'}}</text>
            </button>
            <button class="action-btn" open-type="share">
              <text class="btn-icon">📤</text>
              <text class="btn-text">分享</text>
            </button>
            <button class="action-btn" bindtap="viewDetails">
              <text class="btn-icon">📋</text>
              <text class="btn-text">详情</text>
            </button>
          </view>
          <button class="recommend-btn bounce-effect" bindtap="getRandomFood" :disabled="isAnimating">
            <text class="btn-text">换一个</text>
            <text class="btn-icon">🔄</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      foodInfo: {
        id: '',
        name: '',
        price: 0,
        image: '',
        restaurantName: '',
        spicyLevel: 0,
        tags: [],
        description: '',
        rating: 0,
        sales: 0,
        distance: '',
        deliveryTime: ''
      },
      isAnimating: false,
      cardScale: 1,
      spicyLevels: ['不辣', '微辣', '中辣', '特辣'],
      isFavorited: false
    }
  },
  
  computed: {
    cardScaleStyle() {
      return {
        transform: `scale(${this.cardScale})`
      }
    }
  },
  onLoad() {
    // 页面加载时初始化数据
    try {
      this.getRandomFood()
    } catch (error) {
      console.error('页面初始化失败：', error)
      uni.showToast({
        title: '页面加载失败，请重试',
        icon: 'none'
      })
    }
  },
  
  onShow() {
    // 页面显示时检查状态
    if (!this.foodInfo.name) {
      this.getRandomFood()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    try {
      this.getRandomFood().finally(() => {
        uni.stopPullDownRefresh()
      })
    } catch (error) {
      console.error('刷新失败：', error)
      uni.stopPullDownRefresh()
      uni.showToast({
        title: '刷新失败，请重试',
        icon: 'none'
      })
    }
  },

  // 错误处理
  onError(error) {
    console.error('页面错误：', error)
    uni.showToast({
      title: '发生错误，请重试',
      icon: 'none'
    })
  },
  methods: {
    handleFavorite() {
      this.isFavorited = !this.isFavorited;
      if (this.isFavorited) {
        uni.showToast({
          title: '收藏成功',
          icon: 'success'
        });
        // TODO: 调用收藏API
      } else {
        uni.showToast({
          title: '已取消收藏',
          icon: 'none'
        });
        // TODO: 调用取消收藏API
      }
    },
    
    handleShare() {
      uni.showActionSheet({
        itemList: ['分享给好友', '生成分享图片', '复制链接'],
        success: (res) => {
          switch(res.tapIndex) {
            case 0:
              // TODO: 实现分享给好友
              break;
            case 1:
              // TODO: 实现生成分享图片
              break;
            case 2:
              // TODO: 实现复制链接
              break;
          }
        }
      });
    },
    
    viewDetails() {
      // TODO: 跳转到详情页面
      uni.navigateTo({
        url: `/pages/food/detail?id=${this.foodInfo.id}`
      });
    },

    async getRandomFood() {
      if (this.isAnimating) return;
      
      this.isAnimating = true;
      this.cardScale = 0.8;
      
      try {
        uni.showLoading({
          title: '换个新选择...'
        })
        
        // 使用本地模拟数据
        const mockFoodList = [
          {
            id: '1',
            name: '麻婆豆腐',
            price: 28.00,
            image: '/static/logo.png',
            restaurantName: '川味小馆',
            spicyLevel: 2,
            tags: ['招牌菜', '家常菜'],
            description: '使用新鲜嫩豆腐，搭配特制辣酱，口感麻辣鲜香。',
            rating: 4.8,
            sales: 238,
            distance: '1.2km',
            deliveryTime: '30分钟'
          },
          {
            id: '2',
            name: '清炒时蔬',
            price: 18.00,
            image: '/static/logo.png',
            restaurantName: '健康餐厅',
            spicyLevel: 0,
            tags: ['素菜', '低卡'],
            description: '当季新鲜蔬菜，清淡爽口，营养健康。',
            rating: 4.5,
            sales: 156,
            distance: '0.8km',
            deliveryTime: '25分钟'
          }
        ]
        
        setTimeout(() => {
          const randomIndex = Math.floor(Math.random() * mockFoodList.length)
          this.foodInfo = {...mockFoodList[randomIndex]}
          
          this.cardScale = 1;
          setTimeout(() => {
            this.isAnimating = false;
          }, 300);
        }, 300);
        
      } catch (e) {
        uni.showToast({
          title: '获取推荐失败，请重试',
          icon: 'none'
        })
        this.cardScale = 1;
        this.isAnimating = false;
      } finally {
        uni.hideLoading()
      }
    }
  }
}
</script>

<style lang="scss">
.recommend-container {
  padding: 30rpx;
  min-height: 100vh;
  background-color: #f8f9fa;
  
  .card-container {
    transition: all 0.3s ease-in-out;
    
    &.card-animation {
      animation: cardSwipe 0.3s ease-in-out;
    }
  }
  
  .food-card {
    background-color: #ffffff;
    border-radius: 20rpx;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
    padding: 30rpx;
    transition: all 0.3s ease-in-out;
    position: relative;
    overflow: hidden;
    
    &:before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6rpx;
      background: linear-gradient(90deg, #007aff, #00bcd4);
    }
    
    .food-image {
      width: 100%;
      height: 500rpx;
      border-radius: 16rpx;
      position: relative;
      overflow: hidden;
      
      .image-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 100rpx;
        background: linear-gradient(to top, rgba(0,0,0,0.4), transparent);
      }
    }
    
    .food-info {
      margin-top: 30rpx;
      padding: 20rpx;
      
      .food-name {
        font-size: 36rpx;
        font-weight: bold;
        color: #333;
        margin-bottom: 16rpx;
      }

      .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 12rpx;
        margin: 16rpx 0;

        .tag {
          background: rgba(0,122,255,0.1);
          padding: 6rpx 16rpx;
          border-radius: 20rpx;
          
          .tag-text {
            font-size: 24rpx;
            color: #007aff;
          }
          
          &:first-child {
            background: rgba(245,108,108,0.1);
            .tag-text {
              color: #f56c6c;
            }
          }
        }
      }

      .price-rating {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 16rpx 0;

        .food-price {
          font-size: 32rpx;
          color: #f56c6c;
          font-weight: bold;
        }

        .rating {
          display: flex;
          align-items: center;
          gap: 12rpx;

          .rating-text {
            color: #ffa500;
            font-size: 28rpx;
          }

          .sales {
            color: #999;
            font-size: 24rpx;
          }
        }
      }

      .description {
        font-size: 28rpx;
        color: #666;
        line-height: 1.6;
        margin: 20rpx 0;
        padding: 16rpx;
        background: #f8f9fa;
        border-radius: 12rpx;
      }

      .restaurant-info {
        margin-top: 20rpx;
        padding-top: 20rpx;
        border-top: 2rpx solid #f0f0f0;

        .restaurant-name {
          font-size: 28rpx;
          color: #333;
          font-weight: bold;
          display: block;
          margin-bottom: 12rpx;
        }

        .delivery-info {
          display: flex;
          gap: 20rpx;

          .distance, .delivery-time {
            font-size: 24rpx;
            color: #999;
          }
        }
      }
    }
    
    .actions {
      margin-top: 40rpx;
      
      .action-group {
        display: flex;
        justify-content: space-around;
        margin-bottom: 30rpx;
        
        .action-btn {
          background: none;
          border: none;
          padding: 10rpx 30rpx;
          display: flex;
          flex-direction: column;
          align-items: center;
          
          &::after {
            border: none;
          }
          
          .btn-icon {
            font-size: 40rpx;
            margin-bottom: 8rpx;
          }
          
          .btn-text {
            font-size: 24rpx;
            color: #666;
          }
          
          &:active {
            opacity: 0.7;
          }
        }
      }
      
      .recommend-btn {
        background: linear-gradient(45deg, #007aff, #00bcd4);
        color: #ffffff;
        font-size: 32rpx;
        padding: 20rpx 60rpx;
        border-radius: 40rpx;
        border: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        width: 80%;
        margin: 0 auto;
        
        &.bounce-effect {
          &:active {
            transform: scale(0.95);
          }
        }
        
        &:disabled {
          opacity: 0.7;
          background: #cccccc;
        }
        
        .btn-text {
          margin-right: 10rpx;
        }
        
        .btn-icon {
          font-size: 36rpx;
        }
      }
    }
  }
}

@keyframes cardSwipe {
  0% {
    transform: translateX(0) rotate(0);
    opacity: 1;
  }
  20% {
    transform: translateX(-50rpx) rotate(-2deg);
    opacity: 0.8;
  }
  100% {
    transform: translateX(0) rotate(0);
    opacity: 1;
  }
}
</style>