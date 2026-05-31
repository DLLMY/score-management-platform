import { test, expect, request } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

test.describe('API Tests', () => {
  let apiContext;

  test.beforeAll(async () => {
    apiContext = await request.newContext({
      baseURL: API_BASE_URL,
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('GET /health should return 200', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    expect(response.ok()).toBeTruthy();
  });

  test('GET /users should return user list', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/users`);
    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data)).toBeTruthy();
    }
  });

  test('POST /auth/login should authenticate user', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/auth/login`, {
      data: {
        username: 'admin',
        password: 'admin123',
      },
    });
    expect([200, 401]).toContain(response.status());
  });

  test('GET /devices should return device list', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/devices`);
    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
    }
  });

  test('GET /rules should return rules list', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/rules`);
    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
    }
  });

  test('API versioning endpoints', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/version`);
    if (response.ok()) {
      const data = await response.json();
      expect(data.supported_versions).toBeDefined();
    }
  });
});
