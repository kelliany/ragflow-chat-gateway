require('dotenv').config();
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd(); 
const MAPPING_FILE = path.join(rootDir, 'mappings.json');

console.log('----------------------------------------');
console.log('正在寻找映射文件路径:', MAPPING_FILE);
console.log('----------------------------------------');

let chatMappings = {};

function loadMappings() {
  try {
    if (fs.existsSync(MAPPING_FILE)) {
      const data = fs.readFileSync(MAPPING_FILE, 'utf8');
      chatMappings = JSON.parse(data);
      console.log('✅ 成功加载 mappings.json');
      // 打印详细映射，方便调试
      // console.log('当前映射详情:', JSON.stringify(chatMappings, null, 2));
    } else {
      console.warn('❌ 严重错误: 找不到 mappings.json 文件！');
    }
  } catch (err) {
    console.error('❌ 加载失败，JSON 格式可能错误:', err.message);
  }
}

loadMappings();

// 使用更轻量级的 watch，或者保持 watchFile
fs.watchFile(MAPPING_FILE, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    console.log('🔄 检测到 mappings.json 变化，重新加载...');
    loadMappings();
  }
});

module.exports = {
  port: process.env.PORT || 3030,
  
  // JWT 鉴权配置
  jwt: {
    secret: process.env.JWT_SECRET || 'bestv-secret-key-2026',
    expiresIn: '8h'
  },
  
  // OA 换票口令
  client: {
    secret: process.env.CLIENT_SECRET || 'my-super-secret-key'
  },

  ragflow: {
    // ⚠️ 注意：这里应该是 RAGFlow 的服务地址，如果是同机 Docker，通常是 http://127.0.0.1:80
    baseUrl: process.env.RAGFLOW_BASE_URL || 'http://127.0.0.1:80',
    apiKey: process.env.RAGFLOW_API_KEY || '', 
  },

  get chatMappings() { return chatMappings; },

  security: {
    // 生产环境建议指定具体的 OA 域名，['*'] 仅用于开发调试
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'],
  }
};