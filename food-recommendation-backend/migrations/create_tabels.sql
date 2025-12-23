-- 连接到数据库
\c restaurant_db ;

-- 1. 创建用户表
-- 创建餐厅表
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    floor INTEGER NOT NULL CHECK (floor >= 1 AND floor <= 2),
    campus VARCHAR(50),
    window_number VARCHAR(20),
    store_name VARCHAR(100),
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建菜品表
CREATE TABLE dishes (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    wechat_openid VARCHAR(100) UNIQUE,
    wechat_unionid VARCHAR(100) UNIQUE,
    wechat_nickname VARCHAR(100),
    wechat_avatar VARCHAR(500),
    profile JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建用户口味偏好表
CREATE TABLE user_flavor_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    spicy_pref SMALLINT CHECK (spicy_pref >= 0 AND spicy_pref <= 5) DEFAULT 3,
    sweet_pref SMALLINT CHECK (sweet_pref >= 0 AND sweet_pref <= 5) DEFAULT 3,
    salty_pref SMALLINT CHECK (salty_pref >= 0 AND salty_pref <= 5) DEFAULT 3,
    sour_pref SMALLINT CHECK (sour_pref >= 0 AND sour_pref <= 5) DEFAULT 3,
    bitter_pref SMALLINT CHECK (bitter_pref >= 0 AND bitter_pref <= 5) DEFAULT 3,
    dietary_restrictions VARCHAR(50)[] DEFAULT '{}',
    allergies VARCHAR(50)[] DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 创建用户历史记录表
CREATE TABLE user_dish_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    dish_id INTEGER REFERENCES dishes(id) ON DELETE CASCADE,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    consumed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 创建用户收藏表
CREATE TABLE user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    dish_id INTEGER REFERENCES dishes(id) ON DELETE CASCADE,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, dish_id)
);

-- 5. 创建菜品口味特征表
CREATE TABLE dish_flavor_profiles (
    dish_id INTEGER PRIMARY KEY REFERENCES dishes(id) ON DELETE CASCADE,
    spicy_level SMALLINT CHECK (spicy_level >= 0 AND spicy_level <= 5) DEFAULT 0,
    sweet_level SMALLINT CHECK (sweet_level >= 0 AND sweet_level <= 5) DEFAULT 0,
    salty_level SMALLINT CHECK (salty_level >= 0 AND salty_level <= 5) DEFAULT 0,
    sour_level SMALLINT CHECK (sour_level >= 0 AND sour_level <= 5) DEFAULT 0,
    bitter_level SMALLINT CHECK (bitter_level >= 0 AND bitter_level <= 5) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. 创建评价表
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    dish_id INTEGER REFERENCES dishes(id) ON DELETE CASCADE,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    flavor_ratings JSONB DEFAULT '{}',
    images VARCHAR(200)[] DEFAULT '{}',
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. 创建评价有用性投票表
CREATE TABLE review_helpfulness (
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, user_id)
);

-- 8. 创建菜品分类表（可选扩展）
CREATE TABLE dish_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. 创建菜品-分类关联表（多对多关系）
CREATE TABLE dish_category_relations (
    id SERIAL PRIMARY KEY,
    dish_id INTEGER REFERENCES dishes(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES dish_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dish_id, category_id)
);
-- 创建上传结果表
CREATE TABLE upload_results (
    id SERIAL PRIMARY KEY,
    upload_id VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    image_path VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    result_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_upload_results_upload_id ON upload_results(upload_id);
CREATE INDEX idx_upload_results_user_id ON upload_results(user_id);
-- 创建索引以提高查询性能
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_history_user_id ON user_dish_history(user_id);
CREATE INDEX idx_user_history_consumed_at ON user_dish_history(consumed_at);
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_reviews_dish_id ON reviews(dish_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);
CREATE INDEX idx_review_helpfulness_review_id ON review_helpfulness(review_id);
CREATE INDEX idx_dish_category_relations_dish_id ON dish_category_relations(dish_id);
CREATE INDEX idx_dish_category_relations_category_id ON dish_category_relations(category_id);

-- 创建更新触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为用户表添加更新触发器
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为评价表添加更新触发器
CREATE TRIGGER trigger_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建评价更新触发器（更新菜品平均评分）
CREATE OR REPLACE FUNCTION update_dish_rating()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE dishes 
        SET 
            average_rating = (
                (average_rating * rating_count + NEW.rating) / (rating_count + 1)
            ),
            rating_count = rating_count + 1
        WHERE id = NEW.dish_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE dishes 
        SET 
            average_rating = (
                (average_rating * rating_count - OLD.rating + NEW.rating) / rating_count
            )
        WHERE id = NEW.dish_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE dishes 
        SET 
            average_rating = (
                CASE 
                    WHEN rating_count > 1 THEN 
                        (average_rating * rating_count - OLD.rating) / (rating_count - 1)
                    ELSE 0
                END
            ),
            rating_count = rating_count - 1
        WHERE id = OLD.dish_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 为评价表添加触发器
CREATE TRIGGER trigger_update_dish_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_dish_rating();

-- 创建评价有用性更新触发器
CREATE OR REPLACE FUNCTION update_review_helpfulness()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE reviews 
        SET helpful_count = helpful_count + 1 
        WHERE id = NEW.review_id AND NEW.is_helpful = TRUE;
    ELSIF TG_OP = 'UPDATE' THEN
        -- 如果投票从有用变为无用
        IF OLD.is_helpful = TRUE AND NEW.is_helpful = FALSE THEN
            UPDATE reviews 
            SET helpful_count = helpful_count - 1 
            WHERE id = NEW.review_id;
        -- 如果投票从无用变为有用
        ELSIF OLD.is_helpful = FALSE AND NEW.is_helpful = TRUE THEN
            UPDATE reviews 
            SET helpful_count = helpful_count + 1 
            WHERE id = NEW.review_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE reviews 
        SET helpful_count = helpful_count - 1 
        WHERE id = OLD.review_id AND OLD.is_helpful = TRUE;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 为评价有用性表添加触发器
CREATE TRIGGER trigger_update_review_helpfulness
    AFTER INSERT OR UPDATE OR DELETE ON review_helpfulness
    FOR EACH ROW EXECUTE FUNCTION update_review_helpfulness();

-- 插入一些示例分类数据
INSERT INTO dish_categories (name, description) VALUES
('主食', '米饭、面条、馒头等主食类菜品'),
('荤菜', '以肉类为主要原料的菜品'),
('素菜', '以蔬菜为主要原料的菜品'),
('汤类', '各种汤品'),
('小吃', '零食、小点心等'),
('饮品', '各种饮料、茶水等');

ALTER TABLE dishes
ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0,
ADD COLUMN rating_count INTEGER DEFAULT 0;


-- 输出完成信息
SELECT '所有表已成功创建!' AS message;