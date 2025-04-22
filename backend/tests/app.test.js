const request = require('supertest');
const app = require('../server'); // Import the Express app

describe('Health check - /metrics', () => {
  it('should return 200 OK and contain Prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });
});
