// 数据库连接模块
const { Pool } = require('pg');
require('dotenv').config();

// 数据库连接池配置
let dbPool = null;

/**
 * 初始化数据库连接池
 * @returns {Pool|null} 数据库连接池或null（如果无法连接）
 */
function initializeDbPool() {
  try {
    // 尝试从环境变量获取数据库连接信息
    if (!process.env.DATABASE_URL) {
      console.warn('数据库URL未配置，将使用JSON文件作为数据源');
      return null;
    }

    // 创建新的数据库连接池
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.SSL === 'TRUE' ? 
        { rejectUnauthorized: false } : 
        (process.env.SSL === 'FALSE' ? false : undefined)
    });

    return pool;
  } catch (error) {
    console.error('初始化数据库连接池失败:', error.message);
    return null;
  }
}

/**
 * 获取数据库连接池
 * @returns {Pool|null} 数据库连接池或null（如果不可用）
 */
function getDbPool() {
  if (!dbPool) {
    dbPool = initializeDbPool();
  }
  return dbPool;
}

/**
 * 执行SQL查询
 * @param {string} query SQL查询语句
 * @param {Array} params 查询参数
 * @returns {Promise<Object>} 查询结果
 * @throws {Error} 查询失败时抛出错误
 */
async function executeQuery(query, params = []) {
  const pool = getDbPool();
  
  if (!pool) {
    throw new Error('数据库连接不可用');
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('执行查询失败:', error.message);
    throw error;
  }
}

/**
 * 测试数据库连接
 * @returns {Promise<boolean>} 连接成功返回true，否则返回false
 */
async function testConnection() {
  try {
    const pool = getDbPool();
    if (!pool) return false;
    
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('测试数据库连接失败:', error.message);
    return false;
  }
}

module.exports = {
  getDbPool,
  executeQuery,
  testConnection
}; 