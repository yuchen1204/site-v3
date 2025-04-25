const { Pool } = require('pg');

/**
 * 创建数据库连接池
 * @returns {Promise<Pool>} 返回连接池对象或抛出错误
 */
async function createDbPool() {
  try {
    // 从环境变量获取数据库配置
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });
    
    // 测试连接
    await pool.query('SELECT NOW()');
    return pool;
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}

module.exports = { createDbPool }; 