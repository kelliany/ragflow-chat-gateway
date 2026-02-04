const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../config/config');

const axiosInstance = axios.create({
  timeout: 120000, 
  maxRedirects: 5,
  validateStatus: (status) => status < 500 
});

async function handleRequest(req, res) {
  try {
    // ==========================================
    // 1. 智能流式判断
    // ==========================================
    const isApiRequest = req.path.includes('/api/') || req.path.includes('/completions') || req.path.includes('/session');
    const currentResponseType = isApiRequest ? 'stream' : 'arraybuffer';

    let queryParams = '';
    let hiddenParams = {}; 
    
    // ==========================================
    // 2. 参数处理逻辑
    // ==========================================
    const agentKey = req.query.key;
    const mappings = config.chatMappings;

    if (agentKey && mappings && mappings[agentKey]) {
      const params = new URLSearchParams(mappings[agentKey]);
      params.forEach((value, key) => { hiddenParams[key] = value; });
      queryParams = mappings[agentKey];
      // 这里的 Cookie 仅用于业务参数持久化，不用于身份验证
      res.cookie('ragflow_params', queryParams, { httpOnly: true, maxAge: 3600000 });
    } else {
       const cookies = req.headers.cookie;
       if (cookies && cookies.includes('ragflow_params')) {
         const match = cookies.match(/ragflow_params=([^;]+)/);
         if (match) {
             queryParams = decodeURIComponent(match[1]);
             const params = new URLSearchParams(queryParams);
             params.forEach((value, key) => { hiddenParams[key] = value; });
         }
       }
    }

    // ==========================================
    // 3. 构建 URL (清理 token 参数)
    // ==========================================
    let targetUrl = req.path; 
    let finalUrl = `${config.ragflow.baseUrl}${targetUrl}`;
    console.log(`🚀 请求路径: ${finalUrl}`); // 👈 添加这一行
    // 获取原始 query，但删除 token，避免传给 RAGFlow
    const cleanQuery = { ...req.query };
    delete cleanQuery.token; 

    if (queryParams) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryParams;
    } else if (Object.keys(cleanQuery).length > 0) {
      const originalQuery = new URLSearchParams(cleanQuery).toString();
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + originalQuery;
    }

    // ==========================================
    // 4. 构建 Header
    // ==========================================
    const proxyHeaders = { ...req.headers };
    
    delete proxyHeaders['if-none-match']; 
    delete proxyHeaders['if-modified-since'];
    delete proxyHeaders['host']; 
    delete proxyHeaders['accept-encoding']; 
    
    proxyHeaders['origin'] = config.ragflow.baseUrl;
    proxyHeaders['referer'] = config.ragflow.baseUrl;

    const requestConfig = {
      method: req.method,
      url: finalUrl,
      headers: proxyHeaders,
      data: req, 
      responseType: currentResponseType, 
    };
    console.log(`🚀 正在转发到后端: ${requestConfig.url}`); // 👈 添加这一行
    const response = await axiosInstance(requestConfig);
    console.log(`📡 后端返回状态码: ${response.status}`);  // 👈 添加这一行
    // ==========================================
    // 5. 执行请求与转发响应
    // ==========================================
    

    // 复制响应头 (排除可能导致 iframe 无法显示的限制性 Header)
    Object.keys(response.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'content-security-policy', 'x-frame-options'].includes(lowerKey)) {
        res.setHeader(key, response.headers[key]);
      }
    });

    if (isApiRequest) {
      res.status(response.status);
      response.data.pipe(res); 
      return; 
    }

    // ==========================================
    // 6. HTML 注入 (JS/CSS Patch)
    // ==========================================
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf8');
      
      // 注入 JS Patch：重写参数解析逻辑，确保 iframe 能拿到 hiddenParams
      const injectionScript = `
        <script>
          (function() {
            try {
              console.log('[Gateway] Auth & System patches active...');
              const HIDDEN_PARAMS = ${JSON.stringify(hiddenParams)};
              
              // 兼容性修正：解决 touch 事件被动监听问题
              const originalAddEventListener = EventTarget.prototype.addEventListener;
              EventTarget.prototype.addEventListener = function(type, listener, options) {
                let newOptions = options;
                if (['touchstart', 'touchmove', 'wheel'].includes(type)) {
                   if (typeof options === 'boolean') { newOptions = { capture: options, passive: false }; }
                   else if (typeof options === 'object') { newOptions = { ...options, passive: false }; }
                   else { newOptions = { passive: false }; }
                }
                return originalAddEventListener.call(this, type, listener, newOptions);
              };

              // 参数补丁：模拟 URL 参数
              const originalGet = URLSearchParams.prototype.get;
              URLSearchParams.prototype.get = function(name) {
                if (HIDDEN_PARAMS[name]) return HIDDEN_PARAMS[name];
                return originalGet.apply(this, arguments);
              };
              
              const originalGetAll = URLSearchParams.prototype.getAll;
              URLSearchParams.prototype.getAll = function(name) {
                 if (HIDDEN_PARAMS[name]) return [HIDDEN_PARAMS[name]];
                 return originalGetAll.apply(this, arguments);
              };
            } catch (e) { console.error('[Gateway] Patch error:', e); }
          })();
        </script>
      `;
      
      htmlContent = htmlContent.replace('<head>', `<head>${injectionScript}`);

      // 如果是聊天按钮模式，注入特定样式
      if (req.query.key === 'agent-chat-button') {
        const cssInjection = `
          <style>
            #chat-float-btn { width: 50px !important; height: 50px !important; border-radius: 50% !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; display: flex !important; justify-content: center !important; align-items: center !important; padding: 0 !important; min-width: 0 !important; }
            #chat-float-btn > div, #chat-float-btn span { display: none !important; }
            #chat-float-btn svg, #chat-float-btn img { margin: 0 !important; display: block !important; width: 24px !important; height: 24px !important; }
          </style>
        `;
        htmlContent = htmlContent.replace('</head>', `${cssInjection}</head>`);
      }

      // 允许 iframe 嵌套，移除安全策略限制
      res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline';");
      res.removeHeader('X-Frame-Options');
      res.send(htmlContent);
    } else {
      res.status(response.status);
      res.send(response.data);
    }

  } catch (error) {
    console.error(`Proxy Error [${req.path}]: ${error.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Bad Gateway' });
    }
  }
}

router.use(async (req, res) => {
  await handleRequest(req, res);
});

module.exports = router;