# 个人网站 V3

一个简洁的个人网站，支持个人资料展示和博客文章管理，具有浅色/深色主题切换功能。

## 技术栈

- 前端：原生 JavaScript + Bootstrap 5
- 数据库：PostgreSQL (可选)
- 部署：Cloudflare Pages + Cloudflare Functions
- 本地开发：Express 服务器

## 特性

- 响应式设计，适配不同设备
- 浅色/深色主题切换
- 博客文章分类和分页
- 双线加载策略（优先从数据库加载，失败时从 JSON 文件加载）

## 开发环境设置

1. 克隆代码库
2. 安装依赖
   ```
   npm install
   ```
3. 创建环境变量示例文件并根据需要修改
   ```
   npm run create-env-example
   cp .env.example .env
   ```

4. 在 `.env` 文件中配置数据库连接信息（如果需要连接数据库）
   ```
   # 数据库连接URL (PostgreSQL)
   DATABASE_URL=postgres://username:password@hostname:5432/database_name
   
   # 是否启用SSL连接 ('true' 或 'false')
   DATABASE_SSL=false
   
   # 服务器端口 (可选，默认为3000)
   PORT=3000
   ```

5. 创建数据库和表结构（如果使用数据库）
   ```
   psql -U your_username -d your_database -f scripts/db_schema.sql
   ```

6. 迁移数据（可选，将 JSON 数据导入数据库）
   ```
   npm run migrateToDB
   ```

7. 启动开发服务器
   ```
   npm run dev
   ```
   服务器将在 http://localhost:3000 启动，API 端点将可用。

## 可用脚本

- `npm run dev` - 启动带 API 服务的开发服务器
- `npm run static` - 启动静态文件服务器（不包含 API）
- `npm run migrateToDB` - 将 JSON 数据迁移到数据库
- `npm run create-env-example` - 创建环境变量示例文件

## 本地开发和生产环境区别

- **本地开发**：使用 Express 服务器模拟 API 端点，支持静态文件服务和 API 请求
- **生产环境**：使用 Cloudflare Pages 提供静态文件，Cloudflare Functions 提供 API 功能

本地开发服务器和生产环境使用相同的双线加载策略，确保代码在两个环境中都能正常工作。

## Cloudflare Pages 部署

1. 连接你的 GitHub 仓库到 Cloudflare Pages

2. 配置以下环境变量：
   - `DATABASE_URL`: PostgreSQL 数据库连接字符串
   - `DATABASE_SSL`: 是否启用 SSL 连接 ('true' 或 'false')

3. 部署设置：
   - 构建命令：不需要，留空
   - 输出目录：`/` 