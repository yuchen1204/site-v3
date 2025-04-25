const { createDbPool } = require('./db');
const fs = require('fs');
const path = require('path');

/**
 * 从数据库获取个人资料数据
 * @returns {Promise<Object>} 个人资料数据
 */
async function getProfileFromDb() {
  let pool;
  try {
    pool = await createDbPool();
    
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
  } finally {
    if (pool) {
      pool.end();
    }
  }
}

/**
 * 从 JSON 文件获取个人资料数据
 * @returns {Promise<Object>} 个人资料数据
 */
async function getProfileFromJson() {
  try {
    const dataFilePath = path.join(process.cwd(), 'data', 'profile.json');
    const fileData = await fs.promises.readFile(dataFilePath, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    console.error('从 JSON 文件获取个人资料失败:', error);
    throw error;
  }
}

/**
 * 处理个人资料请求
 * @param {Request} request - 请求对象
 * @returns {Response} - 响应对象
 */
export async function onRequest(context) {
  try {
    // 首先尝试从数据库获取数据
    try {
      const profileData = await getProfileFromDb();
      // 添加数据来源信息
      profileData.dataSource = 'postgresql';
      return new Response(JSON.stringify(profileData), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=60'
        }
      });
    } catch (dbError) {
      console.log('数据库获取失败，尝试从 JSON 文件获取:', dbError);
      
      // 如果数据库获取失败，尝试从 JSON 文件获取
      const profileData = await getProfileFromJson();
      // 添加数据来源信息
      profileData.dataSource = 'json';
      return new Response(JSON.stringify(profileData), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=60'
        }
      });
    }
  } catch (error) {
    console.error('获取个人资料失败:', error);
    return new Response(JSON.stringify({ error: '获取个人资料失败' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 