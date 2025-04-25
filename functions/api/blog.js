const { createDbPool } = require('./db');
const fs = require('fs');
const path = require('path');

/**
 * 从数据库获取博客文章
 * @returns {Promise<Array>} 博客文章数组
 */
async function getBlogPostsFromDb() {
  let pool;
  try {
    pool = await createDbPool();
    
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
  } finally {
    if (pool) {
      pool.end();
    }
  }
}

/**
 * 从 JSON 文件获取博客文章
 * @returns {Promise<Array>} 博客文章数组
 */
async function getBlogPostsFromJson() {
  try {
    const dataFilePath = path.join(process.cwd(), 'data', 'blog.json');
    const fileData = await fs.promises.readFile(dataFilePath, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    console.error('从 JSON 文件获取博客文章失败:', error);
    throw error;
  }
}

/**
 * 处理博客文章请求
 * @param {Request} request - 请求对象
 * @returns {Response} - 响应对象
 */
export async function onRequest(context) {
  try {
    // 首先尝试从数据库获取数据
    try {
      const blogPosts = await getBlogPostsFromDb();
      // 添加元数据信息
      const response = {
        posts: blogPosts,
        meta: {
          dataSource: 'postgresql'
        }
      };
      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=60'
        }
      });
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
      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=60'
        }
      });
    }
  } catch (error) {
    console.error('获取博客文章失败:', error);
    return new Response(JSON.stringify({ error: '获取博客文章失败' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 