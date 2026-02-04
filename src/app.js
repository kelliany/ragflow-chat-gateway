require('dotenv').config(); // 👈 必须放在第一行
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const proxyRoutes = require('../routes/proxy'); // 👈 确认路径正确
const app = express();
const port = 3030; // 建议用 3030 避开之前的端口冲突

const JWT_SECRET = process.env.JWT_SECRET || 'bestv-jwt-secret-2026'; // 保持一致
const RAGFLOW_URL = process.env.RAGFLOW_BASE_URL || 'http://10.215.208.98'; // 你的 RAGFlow 真实地址

app.use(cookieParser());

// ==========================================
// 1. 核心鉴权中间件 (保安)
// ==========================================
const checkAuth = (req, res, next) => {
  const tokenFromUrl = req.query.token;
  const tokenFromCookie = req.cookies['auth_token'];
  const finalToken = tokenFromUrl || tokenFromCookie;

  // 只打印主要页面和 API 的日志，忽略静态资源 (js, css, map, svg)
  const isStatic = /\.(js|css|map|svg|png|jpg|jpeg|woff2)$/.test(req.path);
  
  if (!isStatic) {
    console.log(`[${new Date().toLocaleTimeString()}] 🔍 拦截请求: ${req.path}`);
  }

  // 白名单：放行 logo 等资源（可选）
  if (req.path.startsWith('/logo')) return next();

  if (!finalToken) {
    console.log('  ⛔ [拒绝] 无有效 Token');
    return res.status(401).send('<h1>401 Unauthorized</h1><p>未授权访问：请通过 TVCMS 系统进入。</p>');
  }

  jwt.verify(finalToken, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('  ❌ [拒绝] Token 验证失败');
      res.clearCookie('auth_token');
      return res.status(403).send(`
        <script>
          window.parent.postMessage({ type: 'AUTH_ERROR', status: 403 }, '*');
        </script>
        <h1>403 Forbidden</h1><p>Token 已失效</p>
      `);
    }

    // 🏆 关键：通过验证后，如果是 URL 传来的 Token，存入 Cookie
    // 这样 iframe 内部发出的 API 请求会自动带上这个 Cookie
    if (tokenFromUrl) {
      res.cookie('auth_token', tokenFromUrl, { 
        httpOnly: true, 
        path: '/', // 极其重要：确保所有 API 路径都能读到此 Cookie
        maxAge: 8 * 60 * 60 * 1000 // 👈 增加这一行，设为 8 小时（毫秒）
      });
      console.log('  🍪 Cookie 已成功植入/更新');
    }

    req.user = decoded;
    next();
  });
};
// ==========================================
// 0. 获取 Token 的接口 (放在 checkAuth 之前)
// ==========================================
app.get('/api/get-token', (req, res) => {
  const CLIENT_SECRET = process.env.CLIENT_SECRET || 'bestvwin2026';
  const secretFromReq = req.query.secret;

  // 1. 验证“暗号”是否正确
  if (!secretFromReq || secretFromReq !== CLIENT_SECRET) {
    console.log('  ⚠️ [获取Token失败] 暗号错误');
    return res.status(403).json({ error: '口令错误，无法生成 Token' });
  }

  // 2. 签发 JWT Token，并设置过期时间
  const token = jwt.sign(
    { 
      role: 'user', 
      ip: req.ip,
      system: 'bestv-tvcms' 
    }, 
    JWT_SECRET, 
    { expiresIn: '1m' } // 👈 在这里设置 Token 的有效期
  );

  console.log('  ✅ [获取Token成功] 已签发 8 小时有效期 Token');
  res.json({ success: true, token: token });
});
// 托管测试页面 (放在 checkAuth 之前，方便访问)
app.get('/test-oa', (req, res) => {
    res.sendFile(path.join(__dirname, '../test.html'));
});
// 先让保安站岗
app.use(checkAuth);

// ==========================================
// 2. 代理转发 (只有保安放行了，才会走到这里)
// ==========================================
app.use('/', proxyRoutes);

app.listen(port, () => {
  console.log('========================================');
  console.log(`🚀 安全网关已启动: http://localhost:${port}`);
  console.log(`🛡️  代理目标: ${RAGFLOW_URL}`);
  console.log('========================================');
});