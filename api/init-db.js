// 数据库初始化脚本
const fs = require('fs').promises;
const path = require('path');
const { getDbPool } = require('./db');
require('dotenv').config();

/**
 * 创建数据库表结构
 * @param {Object} client 数据库客户端连接
 * @returns {Promise<void>}
 */
async function createTables(client) {
  const createTablesSQL = `
    -- 个人资料表
    CREATE TABLE IF NOT EXISTS profile (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      avatar VARCHAR(255),
      motto TEXT
    );

    -- 社交链接表
    CREATE TABLE IF NOT EXISTS social_links (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      url VARCHAR(255) NOT NULL,
      icon VARCHAR(255),
      display_order INT DEFAULT 0
    );

    -- 博客文章表
    CREATE TABLE IF NOT EXISTS blog_posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      category VARCHAR(50),
      content TEXT
    );

    -- 博客附件表
    CREATE TABLE IF NOT EXISTS blog_attachments (
      id SERIAL PRIMARY KEY,
      post_id INT REFERENCES blog_posts(id) ON DELETE CASCADE,
      url VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      display_order INT DEFAULT 0
    );

    -- 博客引用表
    CREATE TABLE IF NOT EXISTS blog_references (
      id SERIAL PRIMARY KEY,
      post_id INT REFERENCES blog_posts(id) ON DELETE CASCADE,
      referenced_post_id INT REFERENCES blog_posts(id) ON DELETE SET NULL
    );
  `;

  await client.query(createTablesSQL);
  console.log('数据库表创建成功');
}

/**
 * 从JSON文件加载数据
 * @returns {Promise<Object>} 包含个人资料和博客文章数据的对象
 */
async function loadDataFromJson() {
  try {
    const profilePath = path.join(process.cwd(), 'data', 'profile.json');
    const blogPath = path.join(process.cwd(), 'data', 'blog.json');

    const [profileContent, blogContent] = await Promise.all([
      fs.readFile(profilePath, 'utf8'),
      fs.readFile(blogPath, 'utf8')
    ]);

    return {
      profile: JSON.parse(profileContent),
      blogPosts: JSON.parse(blogContent)
    };
  } catch (error) {
    console.error('加载JSON数据失败:', error);
    throw error;
  }
}

/**
 * 将个人资料数据插入数据库
 * @param {Object} client 数据库客户端连接
 * @param {Object} profileData 个人资料数据
 * @returns {Promise<void>}
 */
async function insertProfileData(client, profileData) {
  // 清空现有数据
  await client.query('DELETE FROM profile');
  await client.query('DELETE FROM social_links');

  // 插入个人资料
  await client.query(
    'INSERT INTO profile (name, avatar, motto) VALUES ($1, $2, $3)',
    [profileData.name, profileData.avatar, profileData.motto]
  );
  console.log('个人资料数据已插入');

  // 插入社交链接
  if (profileData.socialLinks && profileData.socialLinks.length > 0) {
    for (let i = 0; i < profileData.socialLinks.length; i++) {
      const link = profileData.socialLinks[i];
      await client.query(
        'INSERT INTO social_links (platform, url, icon, display_order) VALUES ($1, $2, $3, $4)',
        [link.platform, link.url, link.icon, i]
      );
    }
    console.log('社交链接数据已插入');
  }
}

/**
 * 将博客文章数据插入数据库
 * @param {Object} client 数据库客户端连接
 * @param {Array} blogPosts 博客文章数据数组
 * @returns {Promise<void>}
 */
async function insertBlogData(client, blogPosts) {
  // 清空现有数据（由于外键约束，需要按顺序删除）
  await client.query('DELETE FROM blog_references');
  await client.query('DELETE FROM blog_attachments');
  await client.query('DELETE FROM blog_posts');

  // 博客ID映射（JSON ID -> 数据库ID）
  const idMap = {};

  // 第一步：插入博客文章
  for (const post of blogPosts) {
    const result = await client.query(
      'INSERT INTO blog_posts (id, title, date, category, content) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [post.id, post.title, post.date, post.category, post.content]
    );
    
    // 存储ID映射关系
    idMap[post.id] = result.rows[0].id;
    
    // 第二步：插入附件
    if (post.attachments && post.attachments.length > 0) {
      for (let i = 0; i < post.attachments.length; i++) {
        const attachment = post.attachments[i];
        await client.query(
          'INSERT INTO blog_attachments (post_id, url, type, filename, display_order) VALUES ($1, $2, $3, $4, $5)',
          [result.rows[0].id, attachment.url, attachment.type, attachment.filename, i]
        );
      }
    }
  }
  
  // 第三步：插入引用关系（必须在所有文章都插入后进行）
  for (const post of blogPosts) {
    if (post.references && post.references.length > 0) {
      for (const refId of post.references) {
        // 确保引用的文章ID存在
        if (idMap[refId]) {
          await client.query(
            'INSERT INTO blog_references (post_id, referenced_post_id) VALUES ($1, $2)',
            [idMap[post.id], idMap[refId]]
          );
        }
      }
    }
  }
  
  console.log('博客数据已全部插入');
}

/**
 * 初始化数据库
 */
async function initializeDatabase() {
  const pool = getDbPool();
  if (!pool) {
    console.error('无法连接到数据库，请检查环境变量配置');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    // 开始事务
    await client.query('BEGIN');

    // 1. 创建表结构
    await createTables(client);

    // 2. 从JSON文件加载数据
    const { profile, blogPosts } = await loadDataFromJson();

    // 3. 插入个人资料数据
    await insertProfileData(client, profile);

    // 4. 插入博客文章数据
    await insertBlogData(client, blogPosts);

    // 提交事务
    await client.query('COMMIT');
    console.log('数据库初始化成功！');
  } catch (error) {
    // 发生错误时回滚事务
    await client.query('ROLLBACK');
    console.error('数据库初始化失败:', error);
  } finally {
    client.release();
    // 关闭连接池
    pool.end();
  }
}

// 执行初始化
initializeDatabase().catch(console.error); 