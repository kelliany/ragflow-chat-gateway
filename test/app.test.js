const request = require('supertest');
const app = require('../src/app');

// 模拟axios请求
jest.mock('axios', () => {
  return jest.fn();
});

const axios = require('axios');

describe('Gateway Service', () => {
  // 测试健康检查端点
  describe('GET /health', () => {
    it('should return 200 OK with status ok', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  // 测试404端点
  describe('GET /non-existent', () => {
    it('should return 404 Not Found', async () => {
      const response = await request(app).get('/non-existent');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });
  });

  // 测试代理转发功能
  describe('Proxy Routes', () => {
    beforeEach(() => {
      // 清除所有模拟调用
      jest.clearAllMocks();
    });

    // 测试GET请求转发
    describe('GET /proxy/api/test', () => {
      it('should forward GET request and return response', async () => {
        // 模拟axios响应
        const mockResponse = { status: 200, data: { message: 'GET success' } };
        axios.mockResolvedValue(mockResponse);

        const response = await request(app).get('/proxy/api/test?param1=value1');
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'GET success' });
        expect(axios).toHaveBeenCalledWith({
          method: 'GET',
          url: 'http://localhost:8000/api/test?param1=value1',
          headers: {
            'Accept': undefined,
            'Content-Type': undefined,
            'User-Agent': undefined
          },
          params: { param1: 'value1' },
          data: undefined
        });
      });

      it('should handle GET request error', async () => {
        // 模拟axios错误
        axios.mockRejectedValue(new Error('Network error'));

        const response = await request(app).get('/proxy/api/test');
        
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Internal server error');
      });
    });

    // 测试POST请求转发
    describe('POST /proxy/api/test', () => {
      it('should forward POST request and return response', async () => {
        // 模拟axios响应
        const mockResponse = { status: 201, data: { message: 'POST success' } };
        axios.mockResolvedValue(mockResponse);

        const response = await request(app)
          .post('/proxy/api/test')
          .send({ key: 'value' })
          .set('Content-Type', 'application/json');
        
        expect(response.status).toBe(201);
        expect(response.body).toEqual({ message: 'POST success' });
        expect(axios).toHaveBeenCalledWith({
          method: 'POST',
          url: 'http://localhost:8000/api/test',
          headers: {
            'Accept': undefined,
            'Content-Type': 'application/json',
            'User-Agent': undefined
          },
          params: {},
          data: { key: 'value' }
        });
      });

      it('should handle POST request error', async () => {
        // 模拟axios错误
        axios.mockRejectedValue(new Error('Network error'));

        const response = await request(app)
          .post('/proxy/api/test')
          .send({ key: 'value' });
        
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Internal server error');
      });
    });
  });
});
