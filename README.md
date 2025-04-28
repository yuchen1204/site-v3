# 个人网站 V3

这是一个使用 Cloudflare Pages 构建的现代、轻量级个人网站，包含动态博客系统和后台管理功能。它利用 Cloudflare 的全球网络提供快速访问，并通过 Cloudflare KV 存储数据。

## 功能特点

- 响应式设计，适配桌面和移动设备
- 暗色/亮色主题切换
- 动态博客文章展示（从 Cloudflare KV 加载）
- 支持分类筛选和分页的博客列表
- 博客文章详情页及评论系统（评论存储于 KV）
- 基于 Session 和 Cloudflare KV 的后台管理身份验证
- 支持 Passkey (WebAuthn) 的安全登录方式
- 后台管理界面，用于管理文章、评论和个人资料
- 通过 Node.js 脚本将本地 JSON 数据同步到 Cloudflare KV

## 项目结构

```
site-v3/
├── admin/                  # 后台管理前端文件
│   ├── css/                # 后台管理特定样式 (login.css 等)
│   ├── js/                 # 后台管理特定脚本 (dashboard.js, comments.js, login.js)
│   ├── dashboard.html      # 后台管理主界面 (文章、评论管理)
│   └── index.html          # 后台登录页面
├── blog/                   # 博客前端文件
│   └── index.html          # 博客文章详情页模板
├── data/                   # 数据源文件 (本地)
│   ├── blog.json           # 博客文章数据 (需要同步到 KV)
│   └── profile.json        # 个人资料数据 (需要同步到 KV)
├── functions/              # Cloudflare Pages Functions (后端 API)
│   ├── admin/              # 后台管理 API 和认证中间件
│   │   ├── api/            # 受保护的后台管理 API 端点
│   │   │   ├── blog/       # 管理博客文章和评论的 API
│   │   │   │   ├── comments/
│   │   │   │   │   └── [id].js # 删除评论 (DELETE /admin/api/blog/comments/:id)
│   │   │   │   └── [id].js # 更新/删除文章 (PUT/DELETE /admin/api/blog/:id), 获取/审批/拒绝评论 (GET /admin/api/blog/:id?comments=true)
│   │   │   ├── blog.js     # 创建文章 (POST /admin/api/blog), 获取所有评论 (GET /admin/api/blog?all_comments=true)
│   │   │   └── profile.js  # 更新个人资料 (PUT /admin/api/profile)
│   │   ├── _middleware.js  # 认证中间件 (检查 session cookie 和 KV)
│   │   ├── login.js        # 处理登录请求 (POST /admin/login)
│   │   └── logout.js       # 处理登出请求 (POST /admin/logout)
│   └── api/                # 公共 API 端点 (前端调用)
│       ├── blog/           # 公共博客相关 API
│       │   ├── comments/   # 评论相关 API
│       │   │   └── [id].js # 添加评论 (POST /api/blog/comments/:postId)
│       │   └── post/       # 文章相关 API
│       │       └── [id].js # 获取单篇文章详情和已批准评论 (GET /api/blog/post/:id)
│       ├── blog.js         # 获取博客文章列表 (GET /api/blog)
│       └── profile.js      # 获取个人资料 (GET /api/profile)
├── scripts/                # 前端 JavaScript 和辅助脚本
│   ├── blog-details.js     # 博客详情页逻辑 (加载文章/评论, 提交评论)
│   ├── main.js             # 网站主页逻辑 (加载个人资料/博客列表, 主题切换, 侧边栏)
│   └── sync-to-kv.js       # Node.js 脚本: 将 data/*.json 同步到 Cloudflare KV
├── styles/                 # 前端 CSS 样式
│   └── main.css            # 主要样式表
├── .gitignore              # Git 忽略文件配置
├── index.html              # 网站首页模板
└── README.md               # 项目说明文档
```

## 数据存储与同步

- **数据源:** 核心内容（博客文章、个人资料）存储在项目根目录下的 `data/` 文件夹中的 JSON 文件 (`profile.json`, `blog.json`)。这便于版本控制和本地编辑。
- **线上存储:** Cloudflare KV 被用作线上的主要数据存储。Functions API 直接与 KV 交互以获取和修改数据。Session 数据也存储在 KV 中。
- **同步:** 需要手动运行 `node scripts/sync-to-kv.js` 脚本将 `data/` 目录下的 JSON 文件内容同步到 Cloudflare KV 的 `blog_data` 命名空间中。每次更新本地 JSON 文件后，都需要运行此脚本以使更改在线上生效。评论数据是直接通过 API 写入 KV 的。

## 后台登录系统

网站后台管理系统支持两种登录方式:

### 传统用户名密码登录

使用环境变量配置的用户名和密码进行登录。在 Cloudflare Pages 的环境变量中设置:

- `ADMIN_USERNAME`: 管理员用户名
- `ADMIN_PASSWORD`: 管理员密码

### Passkey (WebAuthn) 登录

网站支持现代的 Passkey 登录方式，提供以下优势:

- **增强安全性**: 使用公钥加密技术，无需记忆复杂密码
- **抗钓鱼**: 凭证绑定到特定域名，无法被钓鱼网站窃取
- **便捷登录**: 使用设备的生物识别功能 (指纹、面部识别等) 快速登录
- **跨设备同步**: 在支持的平台上 (如 iOS/macOS/Android) 可实现凭证同步

#### 启用 Passkey

1. 首先使用传统用户名密码登录
2. 在登录页面，点击"注册新Passkey"按钮
3. 按照浏览器提示完成注册
4. 注册成功后，下次可直接使用"使用Passkey登录"按钮进行登录

#### Passkey 兼容性要求

- 现代浏览器 (Chrome 67+, Firefox 60+, Safari 13+, Edge 79+)
- 支持生物识别的设备 (带有指纹识别器或面部识别的设备)
- 某些功能可能需要操作系统支持 (Windows 10+, macOS 11+, iOS 14+, Android 7+)

## 部署到 Cloudflare Pages

1.  **Fork 或 Clone 仓库:** 将此项目仓库 Fork 到你的 GitHub 账户或 Clone 到本地。
2.  **创建 Cloudflare KV 命名空间:**
    *   在 Cloudflare Dashboard 中，导航到 Workers & Pages -> KV。
    *   创建一个新的命名空间（例如，可以命名为 `blog_data`）。
3.  **配置 Wrangler (用于同步):**
    *   安装 Wrangler CLI: `npm install -g wrangler`
    *   登录 Cloudflare: `wrangler login`
    *   创建一个 `wrangler.toml` 文件（如果尚未存在）在项目根目录，并添加 KV 绑定配置：
        ```toml
        # wrangler.toml
        kv_namespaces = [
          { binding = "blog_data", id = "<你的 KV 命名空间 ID>" }
        ]
        ```
        将 `<你的 KV 命名空间 ID>` 替换为上一步创建的 KV 命名空间 ID。
4.  **同步初始数据:**
    *   运行 `node scripts/sync-to-kv.js` 将本地 `data/` 目录的内容同步到 KV。
5.  **创建 Cloudflare Pages 项目:**
    *   在 Cloudflare Dashboard 中，导航到 Workers & Pages -> Pages。
    *   连接你的 GitHub 仓库。
    *   选择你的项目仓库。
6.  **配置构建设置:**
    *   **构建命令:** 留空或根据需要设置 (例如 `npm install` 如果未来添加了需要构建的依赖)。
    *   **构建输出目录:** 设置为项目根目录，通常是 `/` 或直接留空。
7.  **添加 KV 命名空间绑定:**
    *   在 Pages 项目的设置 (Settings) -> Functions -> KV namespace bindings 中。
    *   点击 "Add binding"。
    *   **Variable name:** `blog_data` (必须与 Functions 代码和 `wrangler.toml` 中的 `binding` 名称一致)。
    *   **KV namespace:** 选择你之前创建的 KV 命名空间。
8.  **设置环境变量:**
    *   在 Pages 项目的设置 (Settings) -> Environment variables 中添加生产环境变量。
    *   **必需变量:**
        * `ADMIN_USERNAME`: 管理员用户名
        * `ADMIN_PASSWORD`: 管理员密码用于传统登录
    *   **可选变量:**
        * 其他自定义配置项
9.  **部署:** 点击 "Save and Deploy"。

## 本地开发

建议使用以下方式进行本地开发:

1. 使用 Cloudflare Wrangler 进行本地开发:
   ```
   npm install -g wrangler
   wrangler pages dev
   ```

2. 或使用简单的 HTTP 服务器 (仅用于预览静态文件，无法测试 Functions):
   ```bash
   # 安装 http-server (如果尚未安装)
   npm install -g http-server 
   # 在项目根目录运行
   http-server ./
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

## 二次开发指南

本指南旨在帮助开发者在现有项目基础上进行二次开发。

### 开发环境

强烈建议使用 Cloudflare Wrangler 进行本地开发，因为它能完整模拟 Pages Functions 和 KV 存储环境：

```bash
# 安装 Wrangler (如果尚未安装)
npm install -g wrangler

# 登录 Cloudflare (如果尚未登录)
wrangler login

# 在项目根目录启动本地开发服务器
wrangler pages dev ./ --kv=blog_data
```
`--kv=blog_data` 参数会在本地模拟名为 `blog_data` 的 KV 命名空间。本地 KV 数据是临时的，每次重启 `wrangler pages dev` 都会重置。如果需要持久化本地测试数据，需要手动管理。

### 技术栈概览

- **前端:** 原生 HTML, CSS, JavaScript, Bootstrap 5
- **后端:** Cloudflare Pages Functions (JavaScript)
- **数据存储:** Cloudflare KV
- **数据同步:** Node.js (用于 `sync-to-kv.js` 脚本)

### 修改前端

- **样式:**
    - 全局样式定义在 `styles/main.css`。
    - 可以利用 Bootstrap 5 的工具类快速调整布局和样式。
    - 后台管理特定样式在 `admin/css/` 下（如 `login.css`）。
- **脚本:**
    - 主页逻辑（个人资料加载、博客列表加载、主题切换、侧边栏等）在 `scripts/main.js`。
    - 博客详情页逻辑（文章加载、评论加载、评论提交等）在 `scripts/blog-details.js`。
    - 后台管理脚本在 `admin/js/` 下（如 `dashboard.js`, `comments.js`, `login.js`）。
- **添加新页面/组件:**
    - 创建新的 `.html` 文件。
    - 如果需要复杂的交互或数据加载，创建对应的 `.js` 文件，并在 HTML 中引入。
    - 参考 `index.html` 和 `scripts/main.js` 的模式，使用 `fetch` 调用后端 API 获取数据并动态渲染到页面。

### 修改后端 (Functions)

- **API 路由:** Cloudflare Pages Functions 使用基于文件的路由。
    - `functions/api/` 目录下的文件对应公共 API 路由 (e.g., `functions/api/blog.js` -> `/api/blog`)。
    - `functions/admin/api/` 目录下的文件对应受保护的后台管理 API 路由 (e.g., `functions/admin/api/profile.js` -> `/admin/api/profile`)。
    - 动态路由使用方括号，如 `functions/api/blog/post/[id].js` 对应 `/api/blog/post/:id`。
- **处理请求:**
    - 在 `.js` 文件中导出 `onRequestGet`, `onRequestPost`, `onRequestPut`, `onRequestDelete` 等函数来处理对应的 HTTP 方法。
    - `context` 参数包含 `request`, `env` (环境变量和 KV 绑定), `params` (动态路由参数), `next` (用于中间件)。
    - 示例：`export async function onRequestGet(context) { const { request, env, params } = context; ... }`
- **访问 KV:**
    - 通过 `context.env.blog_data` 访问绑定的 KV 命名空间。
    - `await env.blog_data.get("key")`: 读取数据。
    - `await env.blog_data.put("key", value)`: 写入数据。
    - `await env.blog_data.delete("key")`: 删除数据。
    - 注意 KV 的值大小限制，通常需要存储 JSON 字符串 (`JSON.stringify()`) 或使用 `type: 'json'` 选项。
- **添加新 API:**
    - 在 `functions/api/` 或 `functions/admin/api/` 下创建对应的 `.js` 文件。
    - 导出处理请求的函数。
    - 如果是后台管理 API，确保放在 `functions/admin/api/` 下以自动应用 `_middleware.js` 的认证。
- **认证:**
    - 后台管理认证逻辑在 `functions/admin/_middleware.js` 中实现，通过检查 `admin_session` Cookie 和 KV 中的 Session 数据。
    - 公共 API (`functions/api/`) 不需要认证。

### 数据管理

- **核心原则:** `data/*.json` 是博客文章和个人资料的权威来源。评论和 Session 数据直接写入 KV。
- **同步:** **极其重要！** 每次修改 `data/profile.json` 或 `data/blog.json` 后，**必须**在本地运行 `node scripts/sync-to-kv.js` 将更改同步到线上的 Cloudflare KV。否则，网站显示的内容不会更新。
- **修改数据结构:**
    1.  修改 `data/` 下的 JSON 文件结构。
    2.  如果需要，更新 `scripts/sync-to-kv.js` 以正确处理新结构。
    3.  更新所有读取或写入这些数据的后端 Functions (`functions/**/*.js`)。
    4.  更新所有使用这些数据的前端 JavaScript (`scripts/**/*.js`)。
    5.  修改完成后，务必运行 `sync-to-kv.js` 同步数据。

### 注意事项

- **KV 限制:** 了解并遵守 Cloudflare KV 的使用限制（如每个 key 的 value 最大 25MB，最终一致性可能导致短时间内的读写延迟）。对于需要强一致性的场景，KV 可能不是最佳选择。
- **安全性:**
    - **输入验证:** 对所有来自客户端（包括 API 请求体、URL 参数）的数据进行严格的验证和清理。
    - **输出转义:** 防止 XSS 攻击，确保动态插入到 HTML 的内容已进行适当转义。
    - **权限控制:** 确保后台管理 API 进行了充分的身份验证和授权检查。
- **错误处理:** 在 Functions 中使用 `try...catch` 捕获潜在错误，并返回标准化的错误响应（例如，JSON 格式，包含错误码和消息），以便前端可以优雅地处理。
- **依赖管理:** 当前项目主要使用 CDN 引入 Bootstrap 等库。如果需要添加 Node.js 依赖 (npm 包)：
    - 在本地运行 `npm install <package_name>`。
    - 在 Cloudflare Pages 的构建设置中添加构建命令，例如 `npm install`。
    - 在 Functions 代码中可以通过 `import` 或 `require` 使用这些依赖。
- **测试:** 使用 `wrangler pages dev` 在本地充分测试所有更改，包括前端交互和后端 API 调用。

## 安装依赖

项目使用以下依赖:

```bash
# 安装依赖
npm install
```

主要依赖:
- @simplewebauthn/browser: Passkey客户端功能
- @simplewebauthn/server: Passkey服务端验证 