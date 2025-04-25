# 个人网站

这是一个使用 Cloudflare Pages 和 KV 数据库的个人网站项目。网站包含个人资料展示、博客文章功能和后台管理功能，支持浅色/深色主题切换和响应式设计。

## 技术栈

- 前端：HTML, CSS, JavaScript
- CSS 框架：Bootstrap 5
- 字体：Maple Mono CN
- 数据存储：Cloudflare KV 数据库（双线加载，自动回退到本地 JSON）
- 部署平台：Cloudflare Pages
- 后台认证：基于环境变量和 Session Cookie

## 项目结构

```
site-v3/
├── admin/                # 后台管理区域
│   ├── css/
│   │   ├── dashboard.css
│   │   └── login.css
│   ├── js/
│   │   ├── dashboard.js
│   │   └── login.js
│   ├── index.html        # 登录页面
│   └── dashboard.html    # 管理面板页面
├── data/                 # 本地数据文件（作为备份）
│   ├── blog.json         # 博客文章数据
│   └── profile.json      # 个人资料数据
├── functions/            # Cloudflare Pages Functions
│   ├── admin/            # 后台 API 和认证
│   │   ├── login.js      # 处理登录请求
│   │   ├── logout.js     # 处理退出登录请求
│   │   └── _middleware.js # 认证中间件
│   └── api/              # 前台 API
│       ├── blog.js       # 获取博客文章的 API
│       └── profile.js    # 获取个人资料的 API
├── scripts/              # 实用脚本
│   ├── main.js           # 主要 JavaScript 代码
│   └── sync-to-kv.js     # 同步本地数据到 KV 的工具
├── styles/               # 样式文件
│   └── main.css          # 主要 CSS 样式
├── index.html            # 网站主页
├── wrangler.toml         # Cloudflare Pages 配置
└── README.md             # 项目说明
```

## 部署步骤

### 1. 准备工作

1. 安装 Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. 登录 Cloudflare 账户:
   ```bash
   wrangler login
   ```

### 2. 创建 KV 命名空间

1. 在 Cloudflare Dashboard 中创建一个 KV 命名空间（或使用 Wrangler CLI）:
   ```bash
   wrangler kv:namespace create "blog_data"
   ```

2. 复制得到的 namespace ID，更新 `wrangler.toml` 文件中的 `KV_NAMESPACE_ID`。

### 3. 配置管理员凭据

在 Cloudflare Pages 项目的环境变量中设置以下变量：
- `ADMIN_USERNAME`: 设置你的后台登录用户名
- `ADMIN_PASSWORD`: 设置你的后台登录密码

你可以在 Cloudflare Dashboard -> Pages 项目 -> Settings -> Environment variables 中进行配置，区分生产环境和预览环境。

### 4. 同步数据到 KV

运行同步脚本，将本地 JSON 数据上传到 KV 数据库:
```bash
node scripts/sync-to-kv.js
```

### 5. 部署到 Cloudflare Pages

1. 将代码推送到 GitHub 仓库。

2. 在 Cloudflare Dashboard 中创建新的 Pages 项目，连接到 GitHub 仓库。

3. 在部署设置中，配置以下内容:
   - 构建命令: 留空（或根据需要设置）
   - 输出目录: 留空（默认为根目录）

4. 在 "Environment variables" 部分，添加 KV 绑定:
   - 变量名称: `blog_data`
   - 选择刚才创建的 KV 命名空间

5. 确保已在 Pages 项目设置中添加了 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 环境变量。

6. 点击 "Save and Deploy" 开始部署。

## 本地开发

1. 克隆仓库:
   ```bash
   git clone [your-repo-url]
   cd site-v3
   ```

2. 使用 Cloudflare Pages 本地开发服务器 `wrangler pages dev` 来模拟环境（包括 KV 和环境变量）:
   ```bash
   # 创建 .dev.vars 文件（不要提交到 Git）
   echo "ADMIN_USERNAME=your_dev_username" > .dev.vars
   echo "ADMIN_PASSWORD=your_dev_password" >> .dev.vars
   
   # 运行本地开发服务器
   wrangler pages dev .
   ```
   或者使用普通的本地服务器（后台功能将不可用，仅前台回退到 JSON）:
   ```bash
   npx serve
   # 或使用 Python
   python -m http.server
   ```

注意：本地开发时，API 请求会失败，网站将自动回退到使用本地 JSON 文件。

## 数据更新

要更新网站内容:

1. 修改 `data/` 目录下的 JSON 文件。
2. 运行同步脚本上传到 KV:
   ```bash
   node scripts/sync-to-kv.js
   ```
3. 或直接使用 Wrangler CLI 更新特定键:
   ```bash
   wrangler kv:key put --binding=blog_data "blog" --path=data/blog.json
   wrangler kv:key put --binding=blog_data "profile" --path=data/profile.json
   ```

## 双线加载数据机制

网站使用双线加载机制从多个数据源获取内容:

1. 首先尝试从 Cloudflare KV 数据库加载数据（通过 `/api/profile` 和 `/api/blog` 端点）。
2. 如果 KV 数据加载失败（例如 KV 不可用或数据不存在），自动回退到加载本地 JSON 文件 (`data/profile.json` 和 `data/blog.json`)。

这种机制确保了即使 KV 数据库出现问题，网站也能正常显示内容。

## 后台管理

- 访问 `/admin` 进入登录页面。
- 使用配置在 Cloudflare Pages 环境变量中的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 进行登录。
- 登录后进入 `/admin/dashboard.html` 管理面板。
- 通过中间件 `functions/admin/_middleware.js` 对后台路由进行保护。 