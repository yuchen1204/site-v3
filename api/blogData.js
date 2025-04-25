// 博客文章数据访问模块
const fs = require('fs').promises;
const path = require('path');
const { executeQuery, testConnection } = require('./db');

/**
 * 从数据库获取博客文章数据
 * @returns {Promise<Array>} 博客文章列表
 */
async function getBlogPostsFromDb() {
  try {
    // 获取所有博客文章
    const posts = await executeQuery(`
      SELECT 
        p.id, 
        p.title, 
        p.date, 
        p.category, 
        p.content
      FROM 
        blog_posts p
      ORDER BY 
        p.date DESC
    `);
    
    // 对每篇文章获取附件
    for (const post of posts) {
      const attachments = await executeQuery(`
        SELECT 
          url, 
          type, 
          filename
        FROM 
          blog_attachments
        WHERE 
          post_id = $1
        ORDER BY 
          display_order
      `, [post.id]);
      
      post.attachments = attachments;
      
      // 获取引用
      const references = await executeQuery(`
        SELECT 
          referenced_post_id
        FROM 
          blog_references
        WHERE 
          post_id = $1
      `, [post.id]);
      
      // 转换引用格式为ID数组
      post.references = references.map(ref => ref.referenced_post_id);
    }
    
    return posts;
  } catch (error) {
    console.error('从数据库获取博客文章失败:', error.message);
    throw error;
  }
}

/**
 * 从JSON文件获取博客文章数据
 * @returns {Promise<Array>} 博客文章列表
 */
async function getBlogPostsFromJson() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'blog.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('从JSON文件获取博客文章失败:', error.message);
    throw error;
  }
}

/**
 * 获取博客文章数据（先尝试数据库，失败则使用JSON）
 * @returns {Promise<Array>} 博客文章列表
 */
async function getBlogPosts() {
  try {
    // 测试数据库连接
    const isDbAvailable = await testConnection();
    
    if (isDbAvailable) {
      try {
        // 尝试从数据库加载
        return await getBlogPostsFromDb();
      } catch (dbError) {
        console.warn('从数据库加载博客文章失败，尝试从JSON加载:', dbError.message);
        // 从数据库加载失败，使用JSON
        return await getBlogPostsFromJson();
      }
    } else {
      // 数据库不可用，直接使用JSON
      console.info('数据库不可用，使用JSON文件加载博客文章');
      return await getBlogPostsFromJson();
    }
  } catch (error) {
    console.error('获取博客文章失败:', error.message);
    throw error;
  }
}

/**
 * 根据分类获取博客文章
 * @param {string} category 分类名称，'all'表示获取所有文章
 * @returns {Promise<Array>} 过滤后的博客文章列表
 */
async function getBlogPostsByCategory(category) {
  try {
    const allPosts = await getBlogPosts();
    
    if (category === 'all') {
      return allPosts;
    } else {
      return allPosts.filter(post => post.category === category);
    }
  } catch (error) {
    console.error(`获取分类 '${category}' 的博客文章失败:`, error.message);
    throw error;
  }
}

module.exports = {
  getBlogPosts,
  getBlogPostsByCategory
};