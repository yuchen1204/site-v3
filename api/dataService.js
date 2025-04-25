/**
 * 数据服务模块 - 实现双线加载逻辑（数据库优先，JSON备用）
 */
const fs = require('fs').promises;
const path = require('path');
const db = require('./db');

/**
 * 从JSON文件读取数据
 * @param {string} filePath - JSON文件路径
 * @returns {Promise<Object|Array>} 解析后的JSON数据
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
 * 获取个人资料 - 双线加载
 * @returns {Promise<Object>} 个人资料数据
 */
async function getProfileData() {
  try {
    // 首先尝试从数据库加载
    console.log('尝试从数据库加载个人资料...');
    const profileData = await db.getProfileData();
    console.log('从数据库加载个人资料成功');
    return profileData;
  } catch (dbError) {
    console.error('从数据库加载个人资料失败，回退到JSON文件:', dbError);
    
    try {
      // 如果数据库加载失败，从JSON文件加载
      console.log('尝试从JSON文件加载个人资料...');
      const profileData = await readJsonFile('data/profile.json');
      console.log('从JSON文件加载个人资料成功');
      return profileData;
    } catch (jsonError) {
      console.error('从JSON文件加载个人资料也失败:', jsonError);
      throw new Error('无法加载个人资料数据');
    }
  }
}

/**
 * 获取博客文章 - 双线加载
 * @returns {Promise<Array>} 博客文章数据数组
 */
async function getBlogPosts() {
  try {
    // 首先尝试从数据库加载
    console.log('尝试从数据库加载博客文章...');
    const posts = await db.getBlogPosts();
    console.log('从数据库加载博客文章成功');
    return posts;
  } catch (dbError) {
    console.error('从数据库加载博客文章失败，回退到JSON文件:', dbError);
    
    try {
      // 如果数据库加载失败，从JSON文件加载
      console.log('尝试从JSON文件加载博客文章...');
      const posts = await readJsonFile('data/blog.json');
      console.log('从JSON文件加载博客文章成功');
      return posts;
    } catch (jsonError) {
      console.error('从JSON文件加载博客文章也失败:', jsonError);
      throw new Error('无法加载博客文章数据');
    }
  }
}

module.exports = {
  getProfileData,
  getBlogPosts
}; 