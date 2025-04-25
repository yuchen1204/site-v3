/**
 * 将本地 JSON 数据同步到 Cloudflare KV 数据库的工具脚本
 * 
 * 使用方法：
 * 1. 安装 Wrangler CLI: npm install -g wrangler
 * 2. 登录 Cloudflare: wrangler login
 * 3. 运行此脚本: node scripts/sync-to-kv.js
 * 
 * 注意：需要在 wrangler.toml 中配置 KV_NAMESPACE_ID
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 要同步的数据文件列表
const DATA_FILES = [
  { localPath: 'data/profile.json', kvKey: 'profile' },
  { localPath: 'data/blog.json', kvKey: 'blog' }
];

// KV 命名空间 ID (建议从 wrangler.toml 配置中获取)
const KV_NAMESPACE = 'blog_data';

/**
 * 从文件读取 JSON 数据
 * @param {string} filePath - 文件路径
 * @returns {Object} - 解析后的 JSON 对象
 */
function readJsonFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`读取文件 ${filePath} 失败:`, error);
    return null;
  }
}

/**
 * 使用 Wrangler CLI 将数据写入 KV
 * @param {string} key - KV 键名
 * @param {Object} data - 要存储的数据
 */
function writeToKV(key, data) {
  if (!data) {
    console.error(`无法写入 KV，${key} 的数据为空`);
    return;
  }

  // 将数据转换为 JSON 字符串
  const jsonData = JSON.stringify(data);
  
  // 创建临时文件
  const tempFile = path.resolve(process.cwd(), `.temp-${key}.json`);
  fs.writeFileSync(tempFile, jsonData);

  // 使用 wrangler 命令写入 KV
  const command = `wrangler kv:key put --binding=${KV_NAMESPACE} "${key}" --path=${tempFile}`;
  
  exec(command, (error, stdout, stderr) => {
    // 删除临时文件
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      console.warn(`删除临时文件 ${tempFile} 失败:`, e);
    }

    if (error) {
      console.error(`写入 KV 失败 (${key}):`, error);
      return;
    }
    
    if (stderr) {
      console.error(`写入 KV 警告 (${key}):`, stderr);
    }
    
    console.log(`成功写入 KV: ${key}`);
    console.log(stdout);
  });
}

/**
 * 主函数 - 同步所有数据
 */
function syncAllData() {
  console.log('开始同步数据到 Cloudflare KV...');
  
  DATA_FILES.forEach(({ localPath, kvKey }) => {
    console.log(`正在处理: ${localPath} -> KV:${kvKey}`);
    const data = readJsonFile(localPath);
    if (data) {
      writeToKV(kvKey, data);
    }
  });
}

// 执行同步
syncAllData(); 