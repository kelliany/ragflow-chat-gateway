# Smart Chart Service 架构文档

## 1. 项目概述

Smart Chart Service 是一个为 RagFlow 设计的网关转发服务，主要用于解决 RagFlow 通过 iframe 嵌入到其他系统时 URL 暴露敏感信息的问题。该服务通过代理转发请求，隐藏真实的 RagFlow URL 和参数，提供安全的访问方式。

### 1.1 核心功能

- **请求转发**：将客户端的请求转发到 RagFlow 服务，并将响应返回给客户端
- **URL 映射**：隐藏真实的 RagFlow URL，使用代理路径替代
- **参数处理**：处理请求参数，确保参数正确传递
- **信息保护**：防止敏感信息通过 URL 暴露
- **安全增强**：提供 CORS 配置、请求验证等安全措施
- **日志记录**：记录请求和错误信息，便于调试和监控

## 2. 技术栈

| 技术/依赖 | 版本 | 用途 |
|---------|------|------|
| Node.js | 18+ | 运行环境 |
| Express | ^4.18.2 | Web 框架，用于处理 HTTP 请求 |
| Axios | ^1.6.2 | HTTP 客户端，用于转发请求 |
| Dotenv | ^16.3.1 | 环境变量管理 |
| CORS | ^2.8.5 | 跨域资源共享配置 |
| Helmet | ^7.1.0 | 安全增强，设置 HTTP 头 |
| Morgan | ^1.10.0 | 日志记录 |
| Jest | ^29.7.0 | 测试框架 |
| Supertest | ^6.3.3 | HTTP 测试工具 |

## 3. 目录结构

```
smart-chart-service/
├── config/             # 配置文件
│   └── config.js       # 主配置文件
├── middleware/         # 中间件
│   └── security.js     # 安全中间件
├── routes/             # 路由
│   └── proxy.js        # 代理路由
├── src/                # 源代码
│   └── app.js          # 主应用文件
├── test/               # 测试文件
│   └── app.test.js     # 应用测试
├── .env                # 环境变量文件
├── package.json        # 项目配置
├── package-lock.json   # 依赖锁定
└── ARCHITECTURE.md     # 架构文档
```

### 3.1 目录说明

- **config/**：存放配置文件，包括 RagFlow 服务的基础 URL、API 路径、安全配置等
- **middleware/**：存放中间件，主要是安全相关的中间件，如 CORS 配置、请求验证等
- **routes/**：存放路由文件，主要是代理路由，用于处理请求转发
- **src/**：存放源代码，主要是主应用文件，用于启动服务器和配置中间件
- **test/**：存放测试文件，用于验证网关服务的功能

## 4. 核心功能模块

### 4.1 配置模块

配置模块负责管理应用的配置信息，包括服务器端口、RagFlow 服务的基础 URL、API 路径、安全配置等。配置信息可以通过环境变量或配置文件设置。

**文件**：`config/config.js`

### 4.2 安全中间件

安全中间件负责处理安全相关的配置，如 CORS 配置、请求验证、日志记录等。

**文件**：`middleware/security.js`

### 4.3 代理路由

代理路由负责处理请求转发，将客户端的请求转发到 RagFlow 服务，并将响应返回给客户端。

**文件**：`routes/proxy.js`

### 4.4 主应用

主应用负责启动服务器，配置中间件和路由，处理健康检查等基础功能。

**文件**：`src/app.js`

## 5. API 设计

### 5.1 健康检查 API

- **路径**：`/health`
- **方法**：`GET`
- **功能**：检查网关服务的健康状态
- **响应**：
  ```json
  {
    "status": "ok",
    "timestamp": "2026-01-30T08:00:00.000Z"
  }
  ```

### 5.2 代理 API

- **路径**：`/proxy/*`
- **方法**：`GET`, `POST`, `PUT`, `DELETE`
- **功能**：将请求转发到 RagFlow 服务
- **说明**：
  - `*` 表示任意路径，会被映射到 RagFlow 服务的对应路径
  - 例如：`/proxy/api/test` 会被映射到 `http://localhost:8000/api/test`

## 6. 安全措施

### 6.1 CORS 配置

通过配置 CORS，限制允许访问的来源，防止跨站请求伪造攻击。

### 6.2 Helmet 安全增强

使用 Helmet 中间件，设置安全相关的 HTTP 头，如 `Content-Security-Policy`、`X-Content-Type-Options` 等，增强应用的安全性。

### 6.3 请求验证

对请求进行验证，确保请求的合法性，防止恶意请求。

### 6.4 日志记录

记录请求和错误信息，便于调试和监控，及时发现异常情况。

## 7. 部署与运行

### 7.1 环境要求

- Node.js 18+
- npm 9+

### 7.2 安装依赖

```bash
npm install
```

### 7.3 配置环境变量

在 `.env` 文件中配置环境变量：

```env
# Server Configuration
PORT=3000

# Ragflow Configuration
RAGFLOW_BASE_URL=http://localhost:8000
RAGFLOW_API_PATH=/api

# Security Configuration
ALLOWED_ORIGINS=*
SECRET_KEY=your-secret-key-for-url-encryption

# Logging Configuration
LOG_LEVEL=info
```

### 7.4 启动服务

```bash
# 启动服务
npm start

# 开发模式启动
npm run dev
```

### 7.5 测试

```bash
# 运行测试
npm test
```

## 8. 集成使用

### 8.1 iframe 嵌入

将原来的 RagFlow URL：

```html
<iframe src="http://localhost:8000/chat?projectId=123&apiKey=secret" width="100%" height="600px"></iframe>
```

替换为网关服务 URL：

```html
<iframe src="http://localhost:3000/proxy/chat?projectId=123&apiKey=secret" width="100%" height="600px"></iframe>
```

### 8.2 API 调用

将原来的 RagFlow API 调用：

```javascript
fetch('http://localhost:8000/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ message: 'Hello' })
});
```

替换为网关服务 API 调用：

```javascript
fetch('http://localhost:3000/proxy/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ message: 'Hello' })
});
```

## 9. 性能优化

### 9.1 缓存策略

- 实现请求缓存，减少重复请求
- 缓存静态资源，提高加载速度

### 9.2 并发处理

- 优化请求处理逻辑，提高并发处理能力
- 使用连接池，减少网络连接开销

### 9.3 监控与分析

- 实现监控系统，监控服务状态和性能指标
- 分析请求日志，优化服务配置

## 10. 可扩展性

### 10.1 模块化设计

- 采用模块化设计，便于功能扩展和维护
- 支持插件机制，可根据需要添加新功能

### 10.2 配置管理

- 集中管理配置，支持环境变量和配置文件
- 支持动态配置，无需重启服务即可更新配置

### 10.3 集群部署

- 支持集群部署，提高服务可用性和扩展性
- 实现负载均衡，分发请求到多个服务实例

## 11. 总结

Smart Chart Service 是一个轻量级的网关转发服务，通过代理转发请求，解决了 RagFlow iframe 嵌入时 URL 暴露敏感信息的问题。该服务采用现代化的技术栈，具有良好的安全性、可扩展性和性能。

### 11.1 优势

- **安全性**：隐藏真实 URL 和参数，提供安全的访问方式
- **灵活性**：支持多种 HTTP 方法和请求类型
- **可配置性**：通过环境变量和配置文件灵活配置
- **可扩展性**：模块化设计，支持功能扩展和集群部署
- **易于集成**：简单的集成方式，无需修改 RagFlow 代码

### 11.2 应用场景

- RagFlow 通过 iframe 嵌入到其他系统
- 需要隐藏真实 API URL 的场景
- 需要统一管理 API 访问的场景
- 需要增强 API 安全性的场景

Smart Chart Service 为 RagFlow 提供了安全、可靠的网关转发解决方案，满足了企业级应用的需求。