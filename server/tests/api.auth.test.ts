import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  CSRF,
  TEST_PASSWORD,
  app,
  clearDatabase,
  createUser,
  registerCitizen,
  seedReferenceData,
  startTestContext,
  stopTestContext,
} from './helpers/testContext.js';
import { User } from '../src/models/User.js';

beforeAll(startTestContext);
afterAll(stopTestContext);
beforeEach(async () => {
  await clearDatabase();
  await seedReferenceData();
});

describe('authentication', () => {
  it('registers a citizen, sets an httpOnly session and returns safe user data', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ name: 'Asha Patel', email: 'asha@example.test', password: TEST_PASSWORD });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('asha@example.test');
    expect(response.body.data.role).toBe('citizen');
    expect(response.body.data.permissions).toContain('reports.create');
    expect(response.body.data.permissions).not.toContain('users.manage');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const cookie = response.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const stored = await User.findOne({ email: 'asha@example.test' }).select('+passwordHash');
    expect(stored?.passwordHash).toBeTruthy();
    expect(stored?.passwordHash).not.toBe(TEST_PASSWORD);
  });

  it('registers NGOs with the NGO role and protects their task APIs from citizen access', async () => {
    const registration = await request(app).post('/api/auth/register-ngo').set(CSRF).send({ name: 'Community Action', email: 'ngo@example.test', password: TEST_PASSWORD });
    expect(registration.status).toBe(201);
    expect(registration.body.data.role).toBe('ngo');
    const ngo = request.agent(app);
    const loginResponse = await ngo.post('/api/auth/login').set(CSRF).send({ email: 'ngo@example.test', password: TEST_PASSWORD });
    expect(loginResponse.status).toBe(200);
    expect((await ngo.get('/api/ngo/tasks')).status).toBe(200);
    expect((await ngo.get('/api/ngo/leaderboard')).status).toBe(200);
    expect((await ngo.get('/api/ngo/admin/review')).status).toBe(403);
    const citizen = await registerCitizen('not-ngo@example.test');
    expect((await citizen.get('/api/ngo/tasks')).status).toBe(403);
  });

  it('rejects weak passwords and duplicate email addresses', async () => {
    const weak = await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ name: 'Weak User', email: 'weak@example.test', password: 'short' });
    expect(weak.status).toBe(422);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');

    await registerCitizen('duplicate@example.test');
    const duplicate = await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ name: 'Duplicate User', email: 'duplicate@example.test', password: TEST_PASSWORD });
    expect(duplicate.status).toBe(409);
  });

  it('ignores attempts to self-assign a privileged role during registration', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({
        name: 'Sneaky User',
        email: 'sneaky@example.test',
        password: TEST_PASSWORD,
        role: 'platform_admin',
        active: true,
      });
    expect(response.status).toBe(201);
    expect(response.body.data.role).toBe('citizen');
    const stored = await User.findOne({ email: 'sneaky@example.test' }).lean();
    expect(stored?.role).toBe('citizen');
  });

  it('returns a non-revealing error for bad credentials', async () => {
    const user = await createUser({ email: 'login@example.test' });
    const wrong = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: user.email, password: 'wrong-password-123' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.message).toBe('Email or password is incorrect.');

    const missing = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: 'nobody@example.test', password: TEST_PASSWORD });
    expect(missing.status).toBe(401);
    expect(missing.body.error.message).toBe(wrong.body.error.message);
  });

  it('loads the session and blocks unauthenticated or unauthorised access', async () => {
    const agent = await registerCitizen('session@example.test');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('session@example.test');

    const anonymous = await request(app).get('/api/auth/me');
    expect(anonymous.status).toBe(401);

    const forbidden = await agent.get('/api/admin/dashboard');
    expect(forbidden.status).toBe(403);
  });

  it('requires the request verification header for mutations', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'someone@example.test', password: TEST_PASSWORD });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('supports the development password reset flow and invalidates older sessions', async () => {
    const agent = await registerCitizen('reset@example.test');
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .set(CSRF)
      .send({ email: 'reset@example.test' });

    expect(forgot.status).toBe(200);
    expect(forgot.body.data.emailConfigured).toBe(false);
    const resetUrl = new URL(forgot.body.data.devResetUrl);
    const token = resetUrl.searchParams.get('token');
    expect(token).toMatch(/^[a-f\d]{64}$/);

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .set(CSRF)
      .send({ token, password: 'NewPassword456' });
    expect(reset.status).toBe(200);

    const oldSession = await agent.get('/api/auth/me');
    expect(oldSession.status).toBe(401);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: 'reset@example.test', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: 'reset@example.test', password: 'NewPassword456' });
    expect(newLogin.status).toBe(200);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .set(CSRF)
      .send({ token, password: 'AnotherPassword789' });
    expect(reuse.status).toBe(422);
  });

  it('gives the same response for password reset when no account exists', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .set(CSRF)
      .send({ email: 'ghost@example.test' });
    expect(response.status).toBe(200);
    expect(response.body.data.devResetUrl).toBeUndefined();
    expect(response.body.data.message).toContain('If an active account matches');
  });

  it('changes profile preferences and password with re-authentication', async () => {
    const agent = await registerCitizen('profile@example.test');
    const profile = await agent
      .patch('/api/auth/profile')
      .set(CSRF)
      .send({ name: 'Updated Name', notificationPreferences: { inApp: true, email: false } });
    expect(profile.status).toBe(200);
    expect(profile.body.data.name).toBe('Updated Name');

    const change = await agent
      .post('/api/auth/change-password')
      .set(CSRF)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'UpdatedPassword123' });
    expect(change.status).toBe(200);

    const wrongCurrent = await agent
      .post('/api/auth/change-password')
      .set(CSRF)
      .send({ currentPassword: 'not-my-password', newPassword: 'AnotherPassword123' });
    expect(wrongCurrent.status).toBe(422);
  });
});
