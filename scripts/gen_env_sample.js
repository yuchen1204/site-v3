/**
 * 生成 .env 示例文件
 */
const fs = require('fs');
const path = require('path');

const envExample = `# 数据库连接URL (PostgreSQL)
DATABASE_URL=postgres://username:password@hostname:5432/database_name

# 是否启用SSL连接 ('true' 或 'false')
DATABASE_SSL=false

# 服务器端口 (可选，默认为3000)
PORT=3000
`;

const filePath = path.join(__dirname, '../.env.example');

fs.writeFileSync(filePath, envExample);
console.log('.env.example 文件已生成到:', filePath); 