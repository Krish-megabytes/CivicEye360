import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { CSRF, TEST_PASSWORD, app, clearDatabase, createUser, login, registerCitizen, seedReferenceData, startTestContext, stopTestContext, validReport } from './helpers/testContext.js';
import { ngoRegisterSchema, ngoClaimSchema, ngoSubmitSchema, ngoReviewSchema } from '../src/validation/schemas.js';
import { can } from '../src/auth/permissions.js';

beforeAll(startTestContext);
afterAll(stopTestContext);
beforeEach(async () => { await clearDatabase(); await seedReferenceData(); });

describe('NGO workflow validation and authorization', () => {
  it('accepts NGO signup and rejects attempts to supply privileged roles', () => {
    expect(ngoRegisterSchema.safeParse({ name: 'Community Cleaners', email: 'team@example.org', password: 'CivicStrong123' }).success).toBe(true);
    expect(ngoRegisterSchema.safeParse({ name: 'Community Cleaners', email: 'team@example.org', password: 'CivicStrong123', role: 'platform_admin' }).success).toBe(false);
  });
  it('validates claims, completion summaries, and bounded admin points', () => {
    expect(ngoClaimSchema.safeParse({ reportId: 'CE-2026-000001' }).success).toBe(true);
    expect(ngoSubmitSchema.safeParse({ summary: 'Removed dumped waste and cleaned the area.' }).success).toBe(true);
    expect(ngoSubmitSchema.safeParse({ summary: 'done' }).success).toBe(false);
    expect(ngoReviewSchema.safeParse({ approved: true, points: 101 }).success).toBe(true);
    expect(ngoReviewSchema.safeParse({ approved: true, points: 1001 }).success).toBe(false);
  });
  it('isolates NGO task endpoints and permits only authorized admins to review', async () => {
    const registration = await request(app).post('/api/auth/register-ngo').set(CSRF).send({ name: 'Community Action', email: 'ngo@example.test', password: TEST_PASSWORD });
    expect(registration.status).toBe(201);
    expect(registration.body.data.role).toBe('ngo');
    const ngo = request.agent(app);
    expect((await ngo.post('/api/auth/login').set(CSRF).send({ email: 'ngo@example.test', password: TEST_PASSWORD })).status).toBe(200);
    expect((await ngo.get('/api/ngo/tasks')).status).toBe(200);
    expect((await ngo.get('/api/ngo/leaderboard')).status).toBe(200);
    expect((await ngo.get('/api/ngo/admin/review')).status).toBe(403);
    const citizen = await registerCitizen('not-ngo@example.test');
    expect((await citizen.get('/api/ngo/tasks')).status).toBe(403);
    const staff = await createUser({ email: 'staff@example.test', role: 'field_staff' });
    const fieldAgent = request.agent(app);
    expect((await fieldAgent.post('/api/auth/login').set(CSRF).send({ email: staff.email, password: TEST_PASSWORD })).status).toBe(200);
    expect((await fieldAgent.get('/api/ngo/admin/review')).status).toBe(403);
    const admin = await createUser({ email: 'admin@example.test', role: 'municipal_admin' });
    const adminAgent = request.agent(app);
    expect((await adminAgent.post('/api/auth/login').set(CSRF).send({ email: admin.email, password: TEST_PASSWORD })).status).toBe(200);
    expect((await adminAgent.get('/api/ngo/admin/review')).status).toBe(200);
  });
  it('reports NGO stats, prevents double claims and lets a claim be released', async () => {
    await createUser({ email: 'ngo-a@example.test', role: 'ngo' });
    const ngo = await login('ngo-a@example.test');
    const citizen = await registerCitizen('reporter@example.test');
    const created = await citizen.post('/api/reports').set(CSRF).send(validReport);
    expect(created.status).toBe(201);
    const reportId = created.body.data.report.reportId as string;

    const board = await ngo.get('/api/ngo/tasks');
    expect(board.status).toBe(200);
    expect(board.body.data.stats).toMatchObject({ points: 0, completedTasks: 0, activeTasks: 0, rank: null });
    expect(board.body.data.available.some((task: { reportId: string }) => task.reportId === reportId)).toBe(true);

    const claim = await ngo.post('/api/ngo/tasks/claim').set(CSRF).send({ reportId });
    expect(claim.status).toBe(201);
    const taskId = claim.body.data.id as string;
    expect((await ngo.get('/api/ngo/tasks')).body.data.stats.activeTasks).toBe(1);

    await createUser({ email: 'ngo-b@example.test', role: 'ngo' });
    const other = await login('ngo-b@example.test');
    expect((await other.post('/api/ngo/tasks/claim').set(CSRF).send({ reportId })).status).toBe(409);
    expect((await other.post(`/api/ngo/tasks/${taskId}/release`).set(CSRF)).status).toBe(404);

    expect((await ngo.post(`/api/ngo/tasks/${taskId}/release`).set(CSRF)).status).toBe(200);
    const rechecked = await other.get('/api/ngo/tasks');
    expect(rechecked.body.data.stats.activeTasks).toBe(0);
    expect(rechecked.body.data.available.some((task: { reportId: string }) => task.reportId === reportId)).toBe(true);
  });

  it('does not grant NGO municipal report permissions', () => {
    expect(can('ngo', 'reports.read.all')).toBe(false);
    expect(can('ngo', 'reports.update.status')).toBe(false);
    expect(can('ngo', 'users.manage')).toBe(false);
  });
});
