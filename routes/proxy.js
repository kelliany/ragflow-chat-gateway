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
    const isApiRequest = req.path.includes('/api/') || req.path.includes('/completions') || req.path.includes('/session');
    const isResourceRequest = req.path.includes('/document/') || req.path.includes('/v1/document/');
    const currentResponseType = (isApiRequest || isResourceRequest) ? 'stream' : 'arraybuffer';

    let queryParams = '';
    let hiddenParams = {}; 
    
    // ==========================================
    // 2. 参数处理逻辑 (优化：参数合并模式)
    // ==========================================
    const agentKey = req.query.key;
    const mappings = config.chatMappings;
    
    // 🏆 核心：创建一个合并后的参数池，初始放入前端请求的所有参数
    let combinedParams = new URLSearchParams(req.query);
    combinedParams.delete('token'); // 移除网关私有 token

    if (agentKey && mappings && mappings[agentKey]) {
        // 🏆 核心：将 Mapping 里的业务配置合并进来
        const mappedParams = new URLSearchParams(mappings[agentKey]);
        mappedParams.forEach((value, key) => {
            // 使用 set。如果 Mapping 里有 width，会覆盖前端的；
            // 只有当 Mapping 里的值不为空时，才覆盖前端传来的参数
          if (value) {
              combinedParams.set(key, value);
          }
        });
        
        queryParams = combinedParams.toString();
        // 将最终合并的所有参数存入 hiddenParams 供前端 JS 使用
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
    // 3. 构建 URL (使用合并后的 queryParams)
    // ==========================================
    let targetUrl = req.path; 
    let finalUrl = `${config.ragflow.baseUrl}${targetUrl}`;
    
    // 这里的逻辑修改：如果存在合并后的参数，则优先使用
    if (queryParams) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryParams;
    } else {
      const cleanQuery = { ...req.query };
      delete cleanQuery.token; 
      if (Object.keys(cleanQuery).length > 0) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + new URLSearchParams(cleanQuery).toString();
      }
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
    
    const response = await axiosInstance(requestConfig);

    // ==========================================
    // 5. 执行请求与转发响应
    // ==========================================
    res.setHeader('Access-Control-Allow-Origin', '*');

    Object.keys(response.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
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
    if (response.headers['content-type']?.includes('text/html')) {
      let htmlContent = response.data.toString('utf8');
      
      const gatewayHost = req.get('host'); 
      const ragflowHost = config.ragflow.baseUrl.replace(/^https?:\/\//, ''); 
      const addressRegex = new RegExp(`http://${ragflowHost}(/v1)?/document`, 'g');
      htmlContent = htmlContent.replace(addressRegex, `http://${gatewayHost}$1/document`);
      
      const injectionScript = `
        <script>
          (function() {
            try {
              console.log('[Gateway] Auth & System patches active...');
              const HIDDEN_PARAMS = ${JSON.stringify(hiddenParams)};
              console.log('[Gateway] Final Hidden Params:', HIDDEN_PARAMS);
              // 🚀 核心逻辑：通知父窗口调整宽高 (w/h 均来自合并后的参数)
              if (window.parent !== window) {
                  window.parent.postMessage({
                      type: 'UI_CONFIG',
                      width: HIDDEN_PARAMS.width || HIDDEN_PARAMS.w || '500px',
                      height: HIDDEN_PARAMS.height || HIDDEN_PARAMS.h || '600px'
                  }, '*');
              }

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

      if (req.query.key === 'agent-chat-button') {
        const cssInjection = `<style>#chat-float-btn { width: 50px !important; height: 50px !important; border-radius: 50% !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; display: flex !important; justify-content: center !important; align-items: center !important; padding: 0 !important; min-width: 0 !important; } #chat-float-btn > div, #chat-float-btn span { display: none !important; } #chat-float-btn svg, #chat-float-btn img { margin: 0 !important; display: block !important; width: 24px !important; height: 24px !important; }</style>`;
        htmlContent = htmlContent.replace('</head>', `${cssInjection}</head>`);
      }

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