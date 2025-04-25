/**
 * 数据库初始化脚本
 * 用于创建必要的表并导入初始数据
 * 
 * 使用方法: node scripts/db-init.js
 */
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// 数据库连接配置
const getDbConfig = () => {
  // 从环境变量获取数据库连接信息
  const connectionString = process.env.DATABASE_URL;
  const sslEnabled = process.env.SSL === 'TRUE';

  return {
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false
  };
};

// 创建数据库表的SQL语句
const createTablesSql = `
-- 创建个人资料表
CREATE TABLE IF NOT EXISTS profile (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  avatar TEXT,
  motto TEXT
);

-- 创建社交链接表
CREATE TABLE IF NOT EXISTS social_links (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  profile_id INTEGER REFERENCES profile(id)
);

-- 创建博客文章表
CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  date TIMESTAMP NOT NULL,
  category VARCHAR(50),
  content TEXT NOT NULL
);

-- 创建附件表
CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES blog_posts(id),
  url TEXT NOT NULL,
  type VARCHAR(50),
  filename VARCHAR(100)
);

-- 创建文章引用表
CREATE TABLE IF NOT EXISTS post_references (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES blog_posts(id),
  referenced_post_id INTEGER REFERENCES blog_posts(id)
);
`;

/**
 * 从JSON文件读取数据
 * @param {string} filePath - JSON文件路径
 * @returns {Promise<any>} 解析后的JSON数据
 */
async function readJsonFile(filePath) {
  try {
    const fullPath = path.resolve(__dirname, '..', filePath);
    const data = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取JSON文件失败 ${filePath}:`, error);
    throw error;
  }
}

/**
 * 导入个人资料数据
 * @param {Pool} pool - 数据库连接池
 */
async function importProfileData(pool) {
  try {
    const profileData = await readJsonFile('data/profile.json');
    
    // 插入个人资料
    const profileResult = await pool.query(
      'INSERT INTO profile (name, avatar, motto) VALUES ($1, $2, $3) RETURNING id',
      [profileData.name, profileData.avatar, profileData.motto]
    );
    
    const profileId = profileResult.rows[0].id;
    
    // 插入社交链接
    if (profileData.socialLinks && profileData.socialLinks.length > 0) {
      for (const link of profileData.socialLinks) {
        await pool.query(
          'INSERT INTO social_links (platform, url, icon, profile_id) VALUES ($1, $2, $3, $4)',
          [link.platform, link.url, link.icon, profileId]
        );
      }
    }
    
    console.log('个人资料数据导入成功');
  } catch (error) {
    console.error('导入个人资料数据失败:', error);
    throw error;
  }
}

/**
 * 导入博客文章数据
 * @param {Pool} pool - 数据库连接池
 */
async function importBlogPosts(pool) {
  try {
    const blogPosts = await readJsonFile('data/blog.json');
    
    // 使用Map存储旧ID到新ID的映射
    const idMapping = new Map();
    
    for (const post of blogPosts) {
      // 检查是否已经导入过此ID的文章（处理可能的重复）
      if (idMapping.has(post.id)) {
        continue;
      }
      
      // 插入博客文章
      const postResult = await pool.query(
        'INSERT INTO blog_posts (title, date, category, content) VALUES ($1, $2, $3, $4) RETURNING id',
        [post.title, post.date, post.category, post.content]
      );
      
      const newPostId = postResult.rows[0].id;
      idMapping.set(post.id, newPostId);
      
      // 插入附件
      if (post.attachments && post.attachments.length > 0) {
        for (const attachment of post.attachments) {
          await pool.query(
            'INSERT INTO attachments (post_id, url, type, filename) VALUES ($1, $2, $3, $4)',
            [newPostId, attachment.url, attachment.type, attachment.filename]
          );
        }
      }
    }
    
    // 插入引用关系（在所有文章都导入后）
    for (const post of blogPosts) {
      if (post.references && post.references.length > 0) {
        const newPostId = idMapping.get(post.id);
        
        for (const referencedId of post.references) {
          const newReferencedId = idMapping.get(referencedId);
          
          if (newPostId && newReferencedId) {
            await pool.query(
              'INSERT INTO post_references (post_id, referenced_post_id) VALUES ($1, $2)',
              [newPostId, newReferencedId]
            );
          }
        }
      }
    }
    
    console.log('博客文章数据导入成功');
  } catch (error) {
    console.error('导入博客文章数据失败:', error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  let pool;
  
  try {
    // 创建数据库连接池
    pool = new Pool(getDbConfig());
    
    // 创建数据库表
    console.log('开始创建数据库表...');
    await pool.query(createTablesSql);
    console.log('数据库表创建成功');
    
    // 导入个人资料数据
    console.log('开始导入个人资料数据...');
    await importProfileData(pool);
    
    // 导入博客文章数据
    console.log('开始导入博客文章数据...');
    await importBlogPosts(pool);
    
    console.log('数据库初始化成功！');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  } finally {
    // 关闭连接池
    if (pool) {
      await pool.end();
    }
  }
}

// 运行主函数
main(); 