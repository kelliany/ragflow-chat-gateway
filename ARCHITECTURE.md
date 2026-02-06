# Smart Chart Service 架构文档

## 1. 项目概述

Smart Chart Service 是一个为 RagFlow 设计的安全网关服务，主要用于解决 RagFlow 通过 iframe 嵌入到其他系统时的安全认证和请求转发问题。该服务通过 JWT 认证、代理转发和模板注入等方式，提供安全、可靠的访问控制机制。

### 1.1 核心功能

- **JWT 认证**：提供基于 JWT 的身份验证机制，确保只有授权用户能访问
- **请求转发**：将客户端的请求安全转发到 RagFlow 服务，并将响应返回给客户端
- **模板注入**：提供 chat-button.html 模板，支持 Token 注入和动态配置
- **跨域支持**：配置 CORS，支持跨域 iframe 嵌入
- **安全增强**：提供请求验证、Cookie 管理等安全措施
- **日志记录**：记录请求和错误信息，便于调试和监控
- **参数处理**：智能处理请求参数，支持参数映射和持久化

## 2. 技术栈

| 技术/依赖 | 版本 | 用途 |
|---------|------|------|
| Node.js | 18+ | 运行环境 |
| Express | ^5.2.1 | Web 框架，用于处理 HTTP 请求 |
| Axios | ^1.13.4 | HTTP 客户端，用于转发请求 |
| Dotenv | ^17.2.3 | 环境变量管理 |
| CORS | ^2.8.6 | 跨域资源共享配置 |
| jsonwebtoken | ^9.0.3 | JWT 认证，生成和验证 Token |
| cookie-parser | ^1.4.7 | Cookie 管理，存储认证信息 |
| http-proxy-middleware | ^3.0.5 | 代理转发工具 |
| Jest | ^29.7.0 | 测试框架 |
| Supertest | ^7.2.2 | HTTP 测试工具 |

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
├── templates/          # 模板文件
│   ├── chat-button.html  # 聊天按钮模板
│   └── chat-window.html  # 聊天窗口模板
├── test/               # 测试文件
│   └── app.test.js     # 应用测试
├── test.html           # 测试页面
├── .env                # 环境变量文件
├── package.json        # 项目配置
├── package-lock.json   # 依赖锁定
├── Dockerfile          # Docker 构建文件
└── ARCHITECTURE.md     # 架构文档
```

### 3.1 目录说明

- **config/**：存放配置文件，包括 RagFlow 服务的基础 URL、API 路径、安全配置等
- **middleware/**：存放中间件，主要是安全相关的中间件，如 CORS 配置、请求验证等
- **routes/**：存放路由文件，主要是代理路由，用于处理请求转发
- **src/**：存放源代码，主要是主应用文件，用于启动服务器、配置中间件和路由
- **templates/**：存放模板文件，包括聊天按钮和聊天窗口的 HTML 模板
- **test/**：存放测试文件，用于验证网关服务的功能
- **test.html**：测试页面，用于验证认证流程和 iframe 嵌入功能

## 4. 核心功能模块

### 4.1 JWT 认证模块

JWT 认证模块负责生成和验证 JWT Token，确保只有授权用户能访问受保护的资源。

**文件**：`src/app.js`

**功能**：
- 生成带有过期时间的 JWT Token
- 验证 Token 的有效性和完整性
- 从 Token 中提取用户信息
- 支持从 URL 参数和 Cookie 中获取 Token

### 4.2 代理转发模块

代理转发模块负责将客户端的请求转发到 RagFlow 服务，并将响应返回给客户端。

**文件**：`routes/proxy.js`

**功能**：
- 智能判断请求类型（API 请求或静态资源）
- 处理请求参数，支持参数映射和持久化
- 构建目标 URL，清理敏感参数
- 转发请求并处理响应
- 支持 HTML 注入，添加安全补丁和样式

### 4.3 模板注入模块

模板注入模块负责提供聊天按钮和聊天窗口的 HTML 模板，并支持 Token 注入。

**文件**：`templates/chat-button.html`、`src/app.js`

**功能**：
- 提供聊天按钮的 HTML 模板
- 支持动态注入 JWT Token
- 实现悬浮球加载和消息监听
- 支持弹出聊天窗口

### 4.4 安全中间件模块

安全中间件模块负责处理安全相关的配置，如 CORS 配置、请求验证等。

**文件**：`middleware/security.js`、`src/app.js`

**功能**：
- 配置 CORS，支持跨域 iframe 嵌入
- 验证请求的合法性，防止恶意请求
- 管理 Cookie，支持安全的认证信息存储
- 记录请求和错误信息，便于调试和监控

### 4.5 测试模块

测试模块负责验证网关服务的功能，确保服务正常运行。

**文件**：`test.html`、`test/app.test.js`

**功能**：
- 提供测试页面，验证认证流程和 iframe 嵌入功能
- 实现自动化测试，验证 API 功能和错误处理

## 5. API 设计

### 5.1 Token 生成 API

- **路径**：`/api/get-token`
- **方法**：`GET`
- **功能**：生成 JWT Token
- **参数**：
  - `secret`：客户端密钥，用于验证请求合法性
  - `userid`：可选，用户 ID，会被包含在 Token 中
- **响应**：
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### 5.2 测试页面 API

- **路径**：`/test-oa`
- **方法**：`GET`
- **功能**：提供测试页面，用于验证认证流程和 iframe 嵌入功能
- **响应**：HTML 页面

### 5.3 聊天按钮 API

- **路径**：`/agent/share`
- **方法**：`GET`
- **功能**：提供聊天按钮模板，支持 Token 注入
- **参数**：
  - `key`：Agent Key，用于标识不同的聊天配置
  - `token`：JWT Token，用于身份验证
- **响应**：注入了 Token 的 HTML 模板

### 5.4 代理 API

- **路径**：`/*`
- **方法**：`GET`, `POST`, `PUT`, `DELETE`
- **功能**：将请求转发到 RagFlow 服务
- **说明**：
  - 任意路径都会被映射到 RagFlow 服务的对应路径
  - 例如：`/next-chats/widget` 会被映射到 `http://10.215.208.98/next-chats/widget`

## 6. 安全措施

### 6.1 JWT 认证

使用 JWT 进行身份验证，确保只有授权用户能访问受保护的资源。JWT 包含过期时间，过期后需要重新获取。

### 6.2 CORS 配置

配置 CORS，支持跨域 iframe 嵌入，确保宿主系统能正常访问网关服务。

### 6.3 Cookie 管理

安全管理 Cookie，使用 `httpOnly`、`sameSite` 和 `secure` 选项，防止 Cookie 被窃取或篡改。

### 6.4 请求验证

对请求进行验证，确保请求的合法性，防止恶意请求。验证内容包括 Token 有效性、请求来源等。

### 6.5 HTML 注入防护

在代理响应时，移除可能导致安全问题的 HTTP 头，如 `X-Frame-Options`，确保 iframe 能正常嵌入。

### 6.6 日志记录

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
PORT=3030

# Ragflow Configuration
RAGFLOW_BASE_URL=http://10.215.208.98

# Security Configuration
JWT_SECRET=bestv-jwt-secret-2026
CLIENT_SECRET=bestvwin2026

# CORS Configuration
ALLOWED_ORIGINS=*
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

**步骤 1：获取 Token**

在宿主系统的后端，调用网关的 Token 生成 API：

```javascript
// 后端代码示例
const response = await fetch('http://gateway-server:3030/api/get-token?secret=bestvwin2026&userid=user123');
const data = await response.json();
const token = data.token;
```

**步骤 2：嵌入聊天按钮**

在宿主系统的前端页面中，嵌入聊天按钮的 iframe：

```html
<iframe 
  src="http://gateway-server:3030/agent/share?key=agent-01&token=${token}"
  style="width: 100px; height: 100px; border: none;"
></iframe>
```

### 8.2 直接使用测试页面

**访问测试页面**：

```
http://gateway-server:3030/test-oa
```

**测试流程**：
1. 输入 CLIENT_SECRET（默认：bestvwin2026）
2. 输入 Agent Key（默认：agent-01）
3. 点击"换取 Token 并初始化聊天按钮"
4. 验证聊天按钮是否显示并能正常工作

## 9. 性能优化

### 9.1 静态资源处理

- 静态资源（js/css/图片）直接放行，不经过认证流程，提高加载速度
- 使用浏览器缓存，减少重复请求

### 9.2 请求处理优化

- 智能判断请求类型，采用不同的处理策略
- 优化参数处理逻辑，减少计算开销
- 使用 Axios 的超时和重试机制，提高请求可靠性

### 9.3 内存管理

- 避免内存泄漏，及时释放资源
- 优化 Cookie 存储，只存储必要的信息
- 合理设置 Token 过期时间，减少无效 Token 的验证开销

## 10. 可扩展性

### 10.1 模块化设计

- 采用模块化设计，便于功能扩展和维护
- 核心功能分离，如认证、代理、模板等模块独立实现
- 支持插件机制，可根据需要添加新功能

### 10.2 配置管理

- 集中管理配置，支持环境变量和配置文件
- 支持动态配置，无需重启服务即可更新配置
- 配置项分类管理，便于维护和理解

### 10.3 集群部署

- 支持集群部署，提高服务可用性和扩展性
- 实现负载均衡，分发请求到多个服务实例
- 支持水平扩展，根据负载动态调整服务实例数量

## 11. 总结

Smart Chart Service 是一个功能完整的安全网关服务，通过 JWT 认证、代理转发和模板注入等方式，为 RagFlow 提供了安全、可靠的访问控制机制。该服务采用现代化的技术栈，具有良好的安全性、可扩展性和性能。

### 11.1 优势

- **安全性**：基于 JWT 的身份验证，确保只有授权用户能访问
- **灵活性**：支持多种 HTTP 方法和请求类型，适应不同的使用场景
- **可配置性**：通过环境变量和配置文件灵活配置，适应不同的部署环境
- **可扩展性**：模块化设计，支持功能扩展和集群部署
- **易于集成**：简单的集成方式，支持 iframe 嵌入和直接 API 调用
- **性能优化**：静态资源放行、请求处理优化等措施，提高服务性能

### 11.2 应用场景

- **企业系统集成**：将 RagFlow 嵌入到企业 OA、CRM 等系统中
- **多租户环境**：为不同租户提供隔离的 RagFlow 访问
- **安全要求高的场景**：需要严格身份验证和访问控制的场景
- **跨域嵌入场景**：需要跨域 iframe 嵌入的场景
- **参数管理场景**：需要统一管理和映射请求参数的场景

Smart Chart Service 为 RagFlow 提供了企业级的安全网关解决方案，满足了复杂应用场景的需求，是 RagFlow 嵌入集成的理想选择。