const { query, pool } = require('./config/database');
const { getRandomRecommendations } = require('./utils/recommendationEngine');

async function testRandomRecommendation() {
  console.log('Testing random recommendation with real data...');

  // 模拟一个用户ID，确保这个用户在数据库中存在
  const mockUserId = 1; 

  try {
    // 确保数据库中有用户
    await query("INSERT INTO users (id, username, email, password_hash) VALUES (1, 'testuser', 'test@example.com', 'password') ON CONFLICT (id) DO UPDATE SET username = 'testuser';");

    const recommendations = await getRandomRecommendations(mockUserId, 5, false);

    console.log('Recommendations received:', JSON.stringify(recommendations, null, 2));

    if (recommendations.length > 0) {
      console.log('Test PASSED: Received recommendations.');
      const firstRec = recommendations[0];
      if (firstRec.restaurant && firstRec.restaurant.location && firstRec.dish && firstRec.dish.image_url.startsWith('/data/')) {
        console.log('Test PASSED: Recommendation has correct structure and image path.');
        console.log('Example recommendation:');
        console.log(`  Restaurant: ${firstRec.restaurant.name}`);
        console.log(`  Location: ${firstRec.restaurant.location}`);
        console.log(`  Dish: ${firstRec.dish.name}`);
        console.log(`  Dish Image URL: ${firstRec.dish.image_url}`);
        console.log(`  Restaurant Image URL: ${firstRec.restaurant.image_url}`);
      } else {
        console.error('Test FAILED: Recommendation structure or image path is incorrect.');
      }
    } else {
      console.error('Test FAILED: Did not receive any recommendations. Check if there is data in the `dishes` and `restaurants` tables.');
    }
  } catch (error) {
    console.error('Test FAILED: An error occurred during the test.', error);
  } finally {
    // 测试结束，关闭数据库连接
    pool.end();
  }
}

testRandomRecommendation();
