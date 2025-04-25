/**
 * JSON数据迁移到PostgreSQL数据库脚本
 * 
 * 使用方法:
 * 1. 安装依赖: npm install pg dotenv
 * 2. 创建.env文件，配置数据库连接信息
 * 3. 运行: node scripts/data_migration.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 从环境变量获取数据库配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

/**
 * 清空现有数据
 */
async function clearExistingData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 按照外键依赖关系从子表到父表的顺序删除
    await client.query('DELETE FROM blog_references');
    await client.query('DELETE FROM blog_attachments');
    await client.query('DELETE FROM blog_posts');
    await client.query('DELETE FROM social_links');
    await client.query('DELETE FROM profile');
    
    await client.query('COMMIT');
    console.log('数据库表已清空');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('清空数据失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 迁移个人资料数据
 */
async function migrateProfileData() {
  // 读取个人资料JSON文件
  const profileData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/profile.json'), 'utf8'));
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 插入个人资料
    const profileResult = await client.query(
      'INSERT INTO profile (name, avatar, motto) VALUES ($1, $2, $3) RETURNING id',
      [profileData.name, profileData.avatar, profileData.motto]
    );
    
    const profileId = profileResult.rows[0].id;
    
    // 插入社交链接
    if (profileData.socialLinks && profileData.socialLinks.length > 0) {
      for (const link of profileData.socialLinks) {
        await client.query(
          'INSERT INTO social_links (platform, url, icon, profile_id) VALUES ($1, $2, $3, $4)',
          [link.platform, link.url, link.icon, profileId]
        );
      }
      console.log(`插入了 ${profileData.socialLinks.length} 条社交链接`);
    }
    
    await client.query('COMMIT');
    console.log('个人资料数据迁移成功');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('个人资料数据迁移失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 迁移博客文章数据
 */
async function migrateBlogPosts() {
  // 读取博客文章JSON文件
  const blogPosts = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/blog.json'), 'utf8'));
  
  // 先检查是否有重复ID的文章
  const uniquePosts = [];
  const idSet = new Set();
  
  for (const post of blogPosts) {
    if (!idSet.has(post.id)) {
      idSet.add(post.id);
      uniquePosts.push(post);
    } else {
      console.warn(`跳过重复ID的文章: ${post.id} - ${post.title}`);
    }
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 插入博客文章
    for (const post of uniquePosts) {
      const postResult = await client.query(
        'INSERT INTO blog_posts (id, title, content, date, category) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [post.id, post.title, post.content, new Date(post.date), post.category]
      );
      
      const postId = postResult.rows[0].id;
      
      // 插入附件
      if (post.attachments && post.attachments.length > 0) {
        for (const attachment of post.attachments) {
          await client.query(
            'INSERT INTO blog_attachments (post_id, url, type, filename) VALUES ($1, $2, $3, $4)',
            [postId, attachment.url, attachment.type, attachment.filename]
          );
        }
      }
    }
    
    // 单独处理文章引用关系（确保所有文章都已插入）
    for (const post of uniquePosts) {
      if (post.references && post.references.length > 0) {
        for (const refId of post.references) {
          try {
            await client.query(
              'INSERT INTO blog_references (post_id, referenced_post_id) VALUES ($1, $2)',
              [post.id, refId]
            );
          } catch (e) {
            console.warn(`跳过无效引用: 文章 ${post.id} 引用了不存在的文章 ${refId}`);
          }
        }
      }
    }
    
    await client.query('COMMIT');
    console.log(`博客文章数据迁移成功，共迁移 ${uniquePosts.length} 篇文章`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('博客文章数据迁移失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('开始数据迁移...');
    
    // 连接数据库
    await pool.query('SELECT NOW()');
    console.log('数据库连接成功');
    
    // 清空现有数据
    await clearExistingData();
    
    // 迁移个人资料数据
    await migrateProfileData();
    
    // 迁移博客文章数据
    await migrateBlogPosts();
    
    console.log('数据迁移完成！');
  } catch (error) {
    console.error('数据迁移失败:', error);
  } finally {
    await pool.end();
  }
}

// 运行主函数
main(); 