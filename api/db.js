/**
 * 数据库连接和工具模块
 */
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

// 创建数据库连接池
let pool;
try {
  pool = new Pool(getDbConfig());
} catch (error) {
  console.error('数据库连接池初始化失败:', error);
}

/**
 * 执行数据库查询
 * @param {string} text - SQL查询语句
 * @param {Array} params - 查询参数
 * @returns {Promise<Object>} 查询结果
 */
async function query(text, params) {
  if (!pool) {
    throw new Error('数据库连接池未初始化');
  }
  
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('数据库查询失败:', error);
    throw error;
  }
}

/**
 * 获取个人资料数据
 * @returns {Promise<Object>} 个人资料数据
 */
async function getProfileData() {
  try {
    // 获取基本个人信息
    const profileResult = await query('SELECT name, avatar, motto FROM profile LIMIT 1');
    
    if (profileResult.rows.length === 0) {
      throw new Error('未找到个人资料数据');
    }
    
    const profile = profileResult.rows[0];
    
    // 获取社交链接
    const socialLinksResult = await query('SELECT platform, url, icon FROM social_links');
    profile.socialLinks = socialLinksResult.rows;
    
    return profile;
  } catch (error) {
    console.error('从数据库获取个人资料失败:', error);
    throw error;
  }
}

/**
 * 获取博客文章数据
 * @returns {Promise<Array>} 博客文章数据数组
 */
async function getBlogPosts() {
  try {
    // 获取所有博客文章
    const postsResult = await query(`
      SELECT 
        id, title, date, category, content
      FROM 
        blog_posts
      ORDER BY 
        date DESC
    `);
    
    const posts = postsResult.rows;
    
    // 为每篇文章获取附件
    for (const post of posts) {
      const attachmentsResult = await query(`
        SELECT 
          url, type, filename
        FROM 
          attachments
        WHERE 
          post_id = $1
      `, [post.id]);
      
      post.attachments = attachmentsResult.rows;
      
      // 获取引用
      const referencesResult = await query(`
        SELECT 
          referenced_post_id
        FROM 
          post_references
        WHERE 
          post_id = $1
      `, [post.id]);
      
      post.references = referencesResult.rows.map(ref => ref.referenced_post_id);
    }
    
    return posts;
  } catch (error) {
    console.error('从数据库获取博客文章失败:', error);
    throw error;
  }
}

module.exports = {
  query,
  getProfileData,
  getBlogPosts
}; 