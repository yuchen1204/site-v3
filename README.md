# 个人网站 V3

这是一个使用Cloudflare Pages构建的个人网站，集成了博客系统和后台管理功能。

## 功能特点

- 响应式设计，适配各种设备
- 暗色/亮色主题切换
- 博客文章展示与管理
- 评论系统，支持评论审核
- 后台管理界面

## 项目结构

```
site-v3/
├── admin/                  # 后台管理相关文件
│   ├── css/                # 后台管理样式
│   ├── js/                 # 后台管理脚本
│   │   ├── comments.js     # 评论管理功能
│   │   ├── dashboard.js    # 仪表盘主要功能
│   │   └── login.js        # 登录功能
│   ├── dashboard.html      # 后台管理主界面
│   └── index.html          # 后台登录页面
├── blog/                   # 博客相关文件
│   └── index.html          # 博客文章页面
├── data/                   # 静态数据文件
├── functions/              # Cloudflare Pages函数
│   ├── admin/              # 后台管理API函数
│   │   └── api/            
│   │       └── blog/       
│   │           └── comments/  # 评论管理API
│   └── api/                # 前端API函数
│       └── blog/           
│           ├── comments/   # 评论API
│           └── post/       # 文章API
├── scripts/                # 前端脚本
├── styles/                 # 前端样式
├── .gitignore              # Git忽略文件配置
├── index.html              # 网站首页
└── README.md               # 项目说明文档
```

## 部署到Cloudflare Pages的步骤

1. 确保您已注册Cloudflare账户并已创建好Pages项目

2. 将本项目推送到您的GitHub仓库

3. 在Cloudflare Pages中连接您的GitHub仓库

4. 配置构建设置:
   - 构建命令: 留空（无需构建）
   - 输出目录: 留空（默认为根目录）

5. 部署设置:
   - 环境变量: 根据需要添加（例如后台管理员密码等）

6. 点击"保存并部署"

## 本地开发

建议使用以下方式进行本地开发:

1. 使用 Cloudflare Wrangler 进行本地开发:
   ```
   npm install -g wrangler
   wrangler pages dev
   ```

2. 或使用简单的HTTP服务器:
   ```
   npx http-server
   ```

## 评论管理功能

评论管理功能允许您:

- 查看所有文章的评论
- 按状态筛选评论（全部/待审核/已通过/已拒绝）
- 通过或拒绝评论
- 删除不适当的评论

## 安全注意事项

- 后台管理页面应该有适当的身份验证措施
- 所有用户输入都需要进行验证和转义
- API请求应该有适当的权限检查

## 许可证

此项目采用MIT许可证。 