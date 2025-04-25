// API接口模块
const express = require('express');
const router = express.Router();
const { getProfile } = require('./profileData');
const { getBlogPosts, getBlogPostsByCategory } = require('./blogData');

/**
 * 捕获并处理异步路由错误
 * @param {Function} fn 异步路由处理函数
 * @returns {Function} 错误处理包装后的路由处理函数
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 获取个人资料数据
router.get('/profile', asyncHandler(async (req, res) => {
  const profileData = await getProfile();
  res.json(profileData);
}));

// 获取所有博客文章
router.get('/blog-posts', asyncHandler(async (req, res) => {
  const blogData = await getBlogPosts();
  res.json(blogData);
}));

// 根据分类获取博客文章
router.get('/blog-posts/category/:category', asyncHandler(async (req, res) => {
  const category = req.params.category;
  const blogData = await getBlogPostsByCategory(category);
  res.json(blogData);
}));

// 获取单篇博客文章
router.get('/blog-posts/:id', asyncHandler(async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const blogData = await getBlogPosts();
  const posts = blogData.posts || blogData;
  const post = posts.find(p => p.id === postId);
  
  if (!post) {
    return res.status(404).json({ error: '文章未找到' });
  }
  
  if (blogData._source) {
    post._source = blogData._source;
  }
  
  res.json(post);
}));

// 错误处理中间件
router.use((err, req, res, next) => {
  console.error('API错误:', err.message);
  res.status(500).json({ error: '服务器错误', message: err.message });
});

module.exports = router; 