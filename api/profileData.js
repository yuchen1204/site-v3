// 个人资料数据访问模块
const fs = require('fs').promises;
const path = require('path');
const { executeQuery, testConnection } = require('./db');

// 数据源类型
const DataSource = {
  POSTGRES: 'postgres',
  JSON: 'json'
};

/**
 * 从数据库获取个人资料数据
 * @returns {Promise<Object>} 个人资料数据
 */
async function getProfileFromDb() {
  try {
    // 获取基本信息
    const profileData = await executeQuery(`
      SELECT name, avatar, motto 
      FROM profile 
      LIMIT 1
    `);
    
    if (profileData.length === 0) {
      throw new Error('未找到个人资料数据');
    }
    
    // 获取社交链接
    const socialLinks = await executeQuery(`
      SELECT platform, url, icon 
      FROM social_links 
      ORDER BY display_order
    `);
    
    // 合并数据并添加数据源标记
    return {
      ...profileData[0],
      socialLinks: socialLinks,
      _source: DataSource.POSTGRES
    };
  } catch (error) {
    console.error('从数据库获取个人资料失败:', error.message);
    throw error;
  }
}

/**
 * 从JSON文件获取个人资料数据
 * @returns {Promise<Object>} 个人资料数据
 */
async function getProfileFromJson() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'profile.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const profileData = JSON.parse(fileContent);
    
    // 添加数据源标记
    return {
      ...profileData,
      _source: DataSource.JSON
    };
  } catch (error) {
    console.error('从JSON文件获取个人资料失败:', error.message);
    throw error;
  }
}

/**
 * 获取个人资料数据（先尝试数据库，失败则使用JSON）
 * @returns {Promise<Object>} 个人资料数据
 */
async function getProfile() {
  try {
    // 测试数据库连接
    const isDbAvailable = await testConnection();
    
    if (isDbAvailable) {
      try {
        // 尝试从数据库加载
        return await getProfileFromDb();
      } catch (dbError) {
        console.warn('从数据库加载个人资料失败，尝试从JSON加载:', dbError.message);
        // 从数据库加载失败，使用JSON
        return await getProfileFromJson();
      }
    } else {
      // 数据库不可用，直接使用JSON
      console.info('数据库不可用，使用JSON文件加载个人资料');
      return await getProfileFromJson();
    }
  } catch (error) {
    console.error('获取个人资料失败:', error.message);
    throw error;
  }
}

module.exports = {
  getProfile,
  DataSource
}; 