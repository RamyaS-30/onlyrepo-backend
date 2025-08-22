require('dotenv').config({ path: '../.env' });
const request = require('supertest');
const app = require('../index');
const creds = require('./test-credentials');
const { getAuthToken } = require('./testutils');

describe('Auth Routes', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: creds.email, password: creds.password });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  }, 30000);

  it('should login with valid credentials', async () => {
    const token = await getAuthToken(); // Use helper here
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('should send a password reset email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: creds.email });

    // Debug: log response if not success
    if (res.statusCode !== 200) {
      console.error('Password reset response:', res.body);
    }

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/Password reset email sent/i);
  }, 30000);
});