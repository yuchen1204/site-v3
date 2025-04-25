/**
 * 本地开发服务器
 * 模拟 Cloudflare Functions API 端点
 */

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..'))); // 提供静态文件

// 创建数据库连接池
let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false
  });
  
  // 测试连接
  pool.query('SELECT NOW()')
    .then(() => console.log('数据库连接成功'))
    .catch(err => console.error('数据库连接失败:', err));
} catch (err) {
  console.error('创建数据库连接池失败:', err);
}

/**
 * 从数据库获取个人资料数据
 */
async function getProfileFromDb() {
  try {
    // 获取基本信息
    const profileResult = await pool.query('SELECT name, avatar, motto FROM profile LIMIT 1');
    
    if (profileResult.rows.length === 0) {
      throw new Error('没有个人资料数据');
    }
    
    const profile = profileResult.rows[0];
    
    // 获取社交链接
    const socialLinksResult = await pool.query(
      'SELECT platform, url, icon FROM social_links ORDER BY id'
    );
    
    profile.socialLinks = socialLinksResult.rows;
    
    return profile;
  } catch (error) {
    console.error('从数据库获取个人资料失败:', error);
    throw error;
  }
}

/**
 * 从 JSON 文件获取个人资料数据
 */
async function getProfileFromJson() {
  try {
    const dataFilePath = path.join(__dirname, '../data/profile.json');
    const fileData = await fs.promises.readFile(dataFilePath, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    console.error('从 JSON 文件获取个人资料失败:', error);
    throw error;
  }
}

/**
 * 从数据库获取博客文章
 */
async function getBlogPostsFromDb() {
  try {
    // 获取所有博客文章
    const postsResult = await pool.query(`
      SELECT p.id, p.title, p.date, p.category, p.content
      FROM blog_posts p
      ORDER BY p.date DESC
    `);
    
    if (postsResult.rows.length === 0) {
      return [];
    }
    
    // 获取所有附件
    const attachmentsResult = await pool.query(`
      SELECT post_id, url, type, filename
      FROM blog_attachments
      ORDER BY post_id, id
    `);
    
    // 获取所有引用
    const referencesResult = await pool.query(`
      SELECT post_id, referenced_post_id
      FROM blog_references
      ORDER BY post_id
    `);
    
    // 组织数据结构
    const posts = postsResult.rows.map(post => {
      // 查找该文章的所有附件
      const attachments = attachmentsResult.rows
        .filter(att => att.post_id === post.id)
        .map(({ url, type, filename }) => ({ url, type, filename }));
      
      // 查找该文章引用的所有其他文章ID
      const references = referencesResult.rows
        .filter(ref => ref.post_id === post.id)
        .map(ref => ref.referenced_post_id);
      
      return {
        id: post.id,
        title: post.title,
        date: post.date.toISOString(),
        category: post.category,
        content: post.content,
        attachments,
        references
      };
    });
    
    return posts;
  } catch (error) {
    console.error('从数据库获取博客文章失败:', error);
    throw error;
  }
}

/**
 * 从 JSON 文件获取博客文章
 */
async function getBlogPostsFromJson() {
  try {
    const dataFilePath = path.join(__dirname, '../data/blog.json');
    const fileData = await fs.promises.readFile(dataFilePath, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    console.error('从 JSON 文件获取博客文章失败:', error);
    throw error;
  }
}

// API 路由

// 个人资料 API 端点
app.get('/api/profile', async (req, res) => {
  try {
    // 首先尝试从数据库获取数据
    try {
      if (!pool) throw new Error('数据库连接池未初始化');
      const profileData = await getProfileFromDb();
      // 添加数据来源信息
      profileData.dataSource = 'postgresql';
      return res.json(profileData);
    } catch (dbError) {
      console.log('数据库获取失败，尝试从 JSON 文件获取:', dbError);
      
      // 如果数据库获取失败，尝试从 JSON 文件获取
      const profileData = await getProfileFromJson();
      // 添加数据来源信息
      profileData.dataSource = 'json';
      return res.json(profileData);
    }
  } catch (error) {
    console.error('获取个人资料失败:', error);
    return res.status(500).json({ error: '获取个人资料失败' });
  }
});

// 博客文章 API 端点
app.get('/api/blog', async (req, res) => {
  try {
    // 首先尝试从数据库获取数据
    try {
      if (!pool) throw new Error('数据库连接池未初始化');
      const blogPosts = await getBlogPostsFromDb();
      // 添加元数据信息
      const response = {
        posts: blogPosts,
        meta: {
          dataSource: 'postgresql'
        }
      };
      return res.json(response);
    } catch (dbError) {
      console.log('数据库获取失败，尝试从 JSON 文件获取:', dbError);
      
      // 如果数据库获取失败，尝试从 JSON 文件获取
      const blogPosts = await getBlogPostsFromJson();
      // 添加元数据信息
      const response = {
        posts: blogPosts,
        meta: {
          dataSource: 'json'
        }
      };
      return res.json(response);
    }
  } catch (error) {
    console.error('获取博客文章失败:', error);
    return res.status(500).json({ error: '获取博客文章失败' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器启动在 http://localhost:${PORT}`);
  console.log(`API 端点:
- http://localhost:${PORT}/api/profile
- http://localhost:${PORT}/api/blog`);
}); 