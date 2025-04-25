# 个人网站项目

这是一个个人网站项目，具有个人资料展示和博客功能。该项目支持从PostgreSQL数据库和本地JSON文件双线加载数据。

## 技术栈

- 前端：HTML, CSS, JavaScript, Bootstrap 5
- 后端：Node.js, Express
- 数据库：PostgreSQL
- 部署：Vercel

## 功能特性

- 个人资料展示（头像、姓名、座右铭、社交链接）
- 博客文章展示（支持分类筛选和分页）
- 文章可折叠显示
- 支持浅色/深色主题切换
- 响应式设计，适配移动设备
- 双线数据加载（先尝试从数据库加载，失败后从JSON文件加载）

## 项目结构

```
site-v3/
├── api/                 # API和服务器相关代码
│   ├── index.js         # API服务器入口
│   ├── server.js        # API路由定义
│   ├── dataService.js   # 数据服务模块（双线加载逻辑）
│   └── db.js            # 数据库连接和查询模块
├── data/                # 本地JSON数据文件
│   ├── profile.json     # 个人资料数据
│   └── blog.json        # 博客文章数据
├── scripts/             # JavaScript脚本
│   ├── main.js          # 主要前端逻辑
│   └── db-init.js       # 数据库初始化脚本
├── styles/              # CSS样式
│   └── main.css         # 主要样式文件
├── .env                 # 环境变量配置（未包含在Git中）
├── index.html           # 主页面
├── vercel.json          # Vercel部署配置
└── package.json         # 项目依赖
```

## 环境变量

项目使用以下环境变量：

- `DATABASE_URL`: PostgreSQL数据库连接URI
- `SSL`: PostgreSQL连接是否使用SSL（值为'TRUE'或'FALSE'）
- `PORT`: 本地开发服务器端口（默认：3001）

## 安装和运行

1. 克隆项目并安装依赖：

```bash
git clone <项目仓库URL>
cd site-v3
npm install
```

2. 设置环境变量（创建.env文件）：

```
DATABASE_URL=postgres://用户名:密码@主机:端口/数据库名
SSL=FALSE  # 本地开发通常为FALSE
PORT=3001
```

3. 初始化数据库（创建表和导入初始数据）：

```bash
node scripts/db-init.js
```

4. 启动本地开发服务器：

```bash
node api/index.js
```

5. 使用静态文件服务器访问前端页面（例如使用Live Server VS Code扩展）

## 部署到Vercel

1. 在Vercel上创建一个新项目，并连接到您的Git仓库。
2. 添加环境变量：`DATABASE_URL`和`SSL`（通常在Vercel上设置为'TRUE'）
3. 部署项目。

部署后，网站将首先尝试从配置的PostgreSQL数据库加载数据。如果数据库连接失败，将回退到使用本地JSON文件加载数据。 