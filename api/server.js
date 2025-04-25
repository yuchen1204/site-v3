/**
 * 服务端API - 提供数据端点
 */
const express = require('express');
const dataService = require('./dataService');

const router = express.Router();

// 获取个人资料API
router.get('/profile', async (req, res) => {
  try {
    const profileData = await dataService.getProfileData();
    res.json(profileData);
  } catch (error) {
    console.error('获取个人资料API错误:', error);
    res.status(500).json({ error: '服务器错误，无法获取个人资料数据' });
  }
});

// 获取博客文章API
router.get('/blog', async (req, res) => {
  try {
    const posts = await dataService.getBlogPosts();
    res.json(posts);
  } catch (error) {
    console.error('获取博客文章API错误:', error);
    res.status(500).json({ error: '服务器错误，无法获取博客文章数据' });
  }
});

module.exports = router; 