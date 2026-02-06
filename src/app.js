require('dotenv').config(); 
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors'); 
const proxyRoutes = require('../routes/proxy'); 

const app = express();
const port = 3030;

const JWT_SECRET = process.env.JWT_SECRET || 'bestv-jwt-secret-2026';
const RAGFLOW_URL = process.env.RAGFLOW_BASE_URL || 'http://10.215.208.98';

app.use(cors()); 
app.use(cookieParser());

// ==========================================
// 辅助函数：生成 HTML
// ==========================================
function getAuthErrorHtml(reason, code) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Auth Error ${code}</title>
    </head>
    <body>
      <div style="text-align:center; padding:50px;">
        <h1>${code} Authentication Failed</h1>
        <p>${reason}</p>
        <p>Redirecting to login...</p>
      </div>
      <script>
        try {
          console.log('Gateway: Auth failed (${code}), notifying parent window...');
          // 发送消息给父页面
          window.parent.postMessage({ 
            type: 'AUTH_ERROR', 
            message: '${reason}',
            code: ${code}
          }, '*'); 
        } catch (e) {
          console.error('PostMessage failed:', e);
        }
      </script>
    </body>
    </html>
  `;
}

// ==========================================
//  获取 Token 的接口 (放在校验中间件之前)
// ==========================================
app.get('/api/get-token', (req, res) => {
  const CLIENT_SECRET = process.env.CLIENT_SECRET || 'bestvwin2026';
  const secretFromReq = req.query.secret;
  const userIdFromReq = req.query.userid; // 获取传入的 userid

  if (!secretFromReq || secretFromReq !== CLIENT_SECRET) {
    console.log('  ⚠️ [获取Token失败] 暗号错误');
    return res.status(403).json({ error: '口令错误' });
  }

  // 签发 Token，包含 userid，并统一有效期为 8 小时
  const token = jwt.sign(
    { 
      userid: userIdFromReq || 'guest',
      role: 'user', 
      system: 'bestv-tvcms' 
    }, 
    JWT_SECRET, 
    { expiresIn: '30s' } // 👈 修正：必须与你的日志描述一致
  );

  console.log(`  ✅ [Token成功] 已为用户 ${userIdFromReq || '访客'} 签发 30s Token`);
  res.json({ success: true, token: token });
});

// 测试页面也放行，不需要 Token 校验
app.get('/test-oa', (req, res) => {
  res.sendFile(path.join(__dirname, '../test.html'));
});

// ==========================================
// 核心鉴权中间件
// ==========================================
const checkAuth = (req, res, next) => {
  // 1. 静态资源放行
  const isStatic = /\.(js|css|map|svg|png|jpg|jpeg|woff2|ico|json)$/.test(req.path);
  if (isStatic) return next();

  // 2. 获取 Token
  const tokenFromUrl = req.query.token;
  const tokenFromCookie = req.cookies['auth_token'];
  let tokenFromReferer = null;
  if (req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      tokenFromReferer = refererUrl.searchParams.get('token');
    } catch (e) { }
  }

  const finalToken = tokenFromUrl || tokenFromCookie || tokenFromReferer;

  // 3. 验证逻辑
  
  // 👉 情况 A: 没 Token -> 返回 401 状态码 + HTML
  if (!finalToken) {
    console.log(` ⛔ [拒绝] 无有效 Token: ${req.path}`);
    return res.status(401).send(getAuthErrorHtml('No Token Provided', 401));
  }

  jwt.verify(finalToken, JWT_SECRET, (err, decoded) => {
    // 👉 情况 B: Token 错/过期 -> 返回 403 状态码 + HTML
    if (err) {
      console.log(` ❌ [拒绝] Token 验证失败: ${req.path} (${err.message})`);
      return res.status(403).send(getAuthErrorHtml(`Token Invalid: ${err.message}`, 403));
    }

    // 验证通过
    if (tokenFromUrl) {
      res.cookie('auth_token', tokenFromUrl, { 
        httpOnly: true, 
        path: '/', 
        sameSite: 'None', // 👈 跨域 iframe 必须设为 None
        secure: true,     // 👈 None 模式下必须设为 true (需确保是 https 或本地测试关闭)
        maxAge:  60 * 1000 
      });
    }

    req.user = decoded; // 此时你就拿到了 decoded.userid
    console.log(` ✅ [准许] 用户 ${decoded.userid} 访问: ${req.path}`);
    next();
  });
};

// 保安站岗：仅拦截页面和 API 路由
app.use(checkAuth);

// ==========================================
// 3. 代理转发
// ==========================================
app.use('/', proxyRoutes);

app.listen(port, () => {
  console.log('========================================');
  console.log(`🚀 安全网关已启动: http://localhost:${port}`);
  console.log(`🛡️  代理目标: ${RAGFLOW_URL}`);
  console.log('========================================');
});