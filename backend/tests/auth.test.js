const request = require('supertest');
const app = require('../server');

// ✅ Mock bcryptjs compare and hash functions
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));
const bcrypt = require('bcryptjs');

// ✅ Mock mysql2/promise pool.query()
jest.mock('../db', () => ({
  query: jest.fn()
}));
const db = require('../db');

describe('Auth Routes: /api/login and /api/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should login successfully with correct credentials', async () => {
    // Mock DB SELECT user
    db.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          username: 'testuser',
          password: '$2a$10$abcdefghijklmnopqrstuv' // dummy bcrypt hash
        }
      ]
    ]);

    // Mock password match
    bcrypt.compare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/login')
      .send({ username: 'testuser', password: '123456' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/dashboard'); // ✅ FIXED
  });

  it('should register a new user with /api/signup', async () => {
    // 1. Mock SELECT user (no existing user)
    db.query
      .mockResolvedValueOnce([[]]) // user not found
      .mockResolvedValueOnce([{ insertId: 2 }]); // mock INSERT

    // Mock password hashing
    bcrypt.hash.mockResolvedValueOnce('$2a$10$hashedpassword');

    const res = await request(app)
      .post('/api/signup')
      .send({
        username: 'newuser',
        email: 'new@example.com',
        password: 'testpass'
      });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login'); // ✅ FIXED
  });
});
