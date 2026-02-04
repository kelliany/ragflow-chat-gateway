// src/middleware/security.js
const cors = require('cors');
const helmet = require('helmet');
const config = require('../config/config');

const securityMiddleware = (app) => {
  // 1. 配置 Helmet
  app.use(helmet({
    // 关键：RAGFlow 前端依赖大量内联脚本和第三方资源，关闭 CSP 以防白屏
    contentSecurityPolicy: false, 
    
    // 关键：允许被您的 OA 系统页面通过 iframe 嵌入
    frameguard: false, // 在新版 helmet 中使用 frameguard: false 代替 xFrameOptions: false

    // 允许跨域资源共享 (如果 RAGFlow 需要从网关加载图片/插件)
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  }));
  
  // 2. 配置 CORS
  app.use(cors({
    // 建议：确保 config.security.allowedOrigins 包含你 OA 系统的域名
    origin: config.security.allowedOrigins || '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true // 必须为 true，否则 iframe 内部无法携带 auth_token Cookie
  }));
  
  // 3. 增强：防止网关被缓存 (针对鉴权场景)
  // 这一步极其重要！如果浏览器缓存了鉴权结果，即便 Token 过期，
  // 浏览器也可能直接读取本地缓存而跳过网关验证。
  app.use((req, res, next) => {
    // 只有针对页面请求（非静态资源）才禁用缓存
    if (req.path.includes('/agent/') || req.path.includes('/view/')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
  });

  // 4. 日志记录
  app.use((req, res, next) => {
    if (req.url !== '/health') {
        // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });
};

module.exports = securityMiddleware;