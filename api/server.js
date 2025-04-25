// 服务器启动文件
const express = require('express');
const path = require('path');
const cors = require('cors');
const apiRouter = require('./api');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors()); // 启用CORS
app.use(express.json()); // 解析JSON请求体
app.use(express.urlencoded({ extended: true })); // 解析URL编码的请求体

// 静态文件服务
app.use(express.static(path.join(__dirname, '../')));

// API路由
app.use('/api', apiRouter);

// 所有其他请求返回index.html (SPA模式)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 