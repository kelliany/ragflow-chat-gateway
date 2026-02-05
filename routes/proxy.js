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
    // 1. 智能流式判断 (支持图片路径)
    // ==========================================
    const isApiRequest = req.path.includes('/api/') || req.path.includes('/completions') || req.path.includes('/session');
    // 兼容所有可能的文档/图片路径判断
    const isResourceRequest = req.path.includes('/document/') || req.path.includes('/v1/document/');
    const currentResponseType = (isApiRequest || isResourceRequest) ? 'stream' : 'arraybuffer';

    let queryParams = '';
    let hiddenParams = {}; 
    
    // ==========================================
    // 2. 参数处理逻辑 (保持原样)
    // ==========================================
    const agentKey = req.query.key;
    const mappings = config.chatMappings;
    
    // 🏆 核心：创建一个合并后的参数池，先放入当前请求的所有参数
    let combinedParams = new URLSearchParams(req.query);
    combinedParams.delete('token'); // 移除网关私有 token

    if (agentKey && mappings && mappings[agentKey]) {
        // 🏆 核心：将 Mapping 里的参数合并进来
        const mappedParams = new URLSearchParams(mappings[agentKey]);
        mappedParams.forEach((value, key) => {
            combinedParams.set(key, value); // 使用 set 确保 mapping 里的配置优先
        });
        
        queryParams = combinedParams.toString();
        // 将合并后的所有参数存入 hiddenParams 供 JS 使用
        combinedParams.forEach((value, key) => { hiddenParams[key] = value; });
        
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
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 复制响应头
    Object.keys(response.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      // 🚀 核心修改：必须排除 content-length，因为内容长度变了
      if (!['content-encoding', 'content-length', 'content-security-policy', 'x-frame-options'].includes(lowerKey)) {
        res.setHeader(key, response.headers[key]);
      }
    });

    if (isApiRequest || isResourceRequest) {
      res.status(response.status);
      response.data.pipe(res); 
      return; 
    }

    // ==========================================
    // 6. HTML 注入与多路径地址替换
    // ==========================================
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf8');
      
      const gatewayHost = req.get('host'); 
      const ragflowHost = config.ragflow.baseUrl.replace(/^https?:\/\//, ''); 
      
      // 🚀 核心增加：增强版正则，覆盖 /v1/document 和 /document
      // 匹配 http://10.215.208.98/v1/document 或 http://10.215.208.98/document
      const addressRegex = new RegExp(`http://${ragflowHost}(/v1)?/document`, 'g');
      htmlContent = htmlContent.replace(addressRegex, `http://${gatewayHost}$1/document`);

      console.log(`[Gateway] 已替换 HTML 中的后端链接为网关链接: ${gatewayHost}`);

      // 你的原生注入脚本 (保持原样)
      const injectionScript = `
        <script>
          (function() {
            try {
              console.log('[Gateway] Auth & System patches active...');
              const HIDDEN_PARAMS = ${JSON.stringify(hiddenParams)};
              
              // 🚀 新增：通知父窗口调整宽高
              if (window.parent !== window) {
                  window.parent.postMessage({
                      type: 'UI_CONFIG',
                      width: HIDDEN_PARAMS.width || '500px',
                      height: HIDDEN_PARAMS.height || '600px'
                  }, '*');
              }
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
      res.status(response.status).send(response.data);
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