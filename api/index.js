/**
 * API服务器入口文件
 */
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./server');

// 创建Express应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// API路由
app.use('/api', apiRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API服务器运行在端口 ${PORT}`);
  });
}

// 为Vercel导出
module.exports = app; 