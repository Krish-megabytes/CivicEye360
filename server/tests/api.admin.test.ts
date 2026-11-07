import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  CSRF,
  app,
  clearDatabase,
  createUser,
  login,
  registerCitizen,
  seedReferenceData,
  startTestContext,
  stopTestContext,
  validReport,
  type ReferenceData,
  type TestAgent,
} from './helpers/testContext.js';
import { User } from '../src/models/User.js';

let refs: ReferenceData;
let platformAdmin: { id: string; email: string; name: string; role: string };
let platformAgent: TestAgent;
let municipal: { id: string; email: string; name: string; role: string };
let municipalAgent: TestAgent;
let citizen: TestAgent;

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00,
]);

beforeAll(startTestContext);
afterAll(stopTestContext);

beforeEach(async () => {
  await clearDatabase();
  refs = await seedReferenceData();
  platformAdmin = await createUser({
    email: 'platform@example.test',
    role: 'platform_admin',
  });
  platformAgent = await login(platformAdmin.email);
  municipal = await createUser({ email: 'municipal@example.test', role: 'municipal_admin' });
  municipalAgent = await login(municipal.email);
  citizen = await registerCitizen('admin.test.citizen@example.test');
});

async function createReport(overrides: Record<string, unknown> = {}): Promise<{
  reportId: string;
  id: string;
}> {
  const response = await citizen
    .post('/api/reports')
    .set(CSRF)
    .send({ ...validReport, ...overrides });
  expect(response.status).toBe(201);
  return { reportId: response.body.data.report.reportId, id: response.body.data.report.id };
}

describe('dashboards and analytics', () => {
  it('derives KPIs, queues, distributions and trends from stored reports', async () => {
    await createReport({ title: 'Pothole near the library steps' });
    await createReport({
      title: 'Overflowing bin behind the market hall',
      description:
        'The public bin behind the market hall has not been emptied and waste is spreading across the service lane.',
      category: 'waste',
    });
    await createReport({
      title: 'Streetlight not working near the bus stop',
      description:
        'The streetlight beside the northbound bus stop has been out for four nights and the shelter is in darkness.',
      category: 'streetlights',
    });

    const dashboard = await municipalAgent.get('/api/admin/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.kpis.totalReports).toBe(3);
    expect(dashboard.body.data.kpis.unassigned).toBe(3);
    expect(dashboard.body.data.kpis.highPriority).toBe(0);
    expect(dashboard.body.data.kpis.hasSlaConfiguration).toBe(true);
    expect(dashboard.body.data.kpis.medianResolutionHours).toBeNull();
    expect(dashboard.body.data.queues.new).toBe(3);
    expect(dashboard.body.data.trend).toHaveLength(30);
    expect(dashboard.body.data.recentReports).toHaveLength(3);
    expect(dashboard.body.data.definitions.totalReports).toContain('selected date range');
    expect(dashboard.body.data.departmentWorkload.length).toBeGreaterThan(0);
    expect(dashboard.body.data.statusDistribution[0]).toMatchObject({
      status: 'Submitted',
      count: 3,
    });

    const analytics = await municipalAgent.get('/api/admin/analytics');
    expect(analytics.status).toBe(200);
    expect(analytics.body.data.kpis.totalReports).toBe(3);
    expect(analytics.body.data.priorityDistribution.length).toBeGreaterThan(0);
    expect(analytics.body.data.sla.configured).toBe(true);
    expect(analytics.body.data.sla.attainmentPercent).toBeNull();
    expect(analytics.body.data.reopened.ratePercent).toBeNull();
    expect(analytics.body.data.definitions.timezone).toContain('UTC');
  });

  it('returns map points and respects report visibility', async () => {
    const created = await createReport();
    const points = await municipalAgent.get('/api/admin/map-points');
    expect(points.status).toBe(200);
    expect(points.body.data.points).toHaveLength(1);
    expect(points.body.data.points[0].reportId).toBe(created.reportId);
    expect(points.body.data.points[0].latitude).toBe(validReport.location.latitude);

    await municipalAgent
      .patch(`/api/reports/${created.reportId}/moderation`)
      .set(CSRF)
      .send({ visible: false, reason: 'Privacy review requested.' });

    const hidden = await municipalAgent.get('/api/admin/map-points');
    expect(hidden.body.data.points).toHaveLength(0);
  });

  it('protects dashboards from citizens', async () => {
    const response = await citizen.get('/api/admin/dashboard');
    expect(response.status).toBe(403);
  });
});

describe('platform configuration', () => {
  it('creates and deactivates departments, categories, routing rules and SLAs with audit entries', async () => {
    const department = await platformAgent
      .post('/api/admin/departments')
      .set(CSRF)
      .send({ name: 'Parks & Trees', description: 'Public green spaces', supportedCategories: ['parks'] });
    expect(department.status).toBe(201);
    const departmentId = department.body.data.id;

    const category = await platformAgent
      .post('/api/admin/categories')
      .set(CSRF)
      .send({ slug: 'street-furniture', label: 'Street Furniture', description: 'Benches and bins' });
    expect(category.status).toBe(201);

    const duplicate = await platformAgent
      .post('/api/admin/categories')
      .set(CSRF)
      .send({ slug: 'street-furniture', label: 'Duplicate' });
    expect(duplicate.status).toBe(409);

    const rule = await platformAgent
      .post('/api/admin/routing-rules')
      .set(CSRF)
      .send({ category: 'parks', departmentId });
    expect(rule.status).toBe(201);

    const sla = await platformAgent
      .post('/api/admin/sla-config')
      .set(CSRF)
      .send({
        category: 'parks',
        priority: 'High',
        targetHours: 36,
        businessCalendar: {
          timezone: 'America/New_York',
          weekdays: [1, 2, 3, 4, 5],
          startHour: 8,
          endHour: 18,
        },
      });
    expect(sla.status).toBe(201);

    const configured = await platformAgent.get('/api/admin/sla-config');
    expect(configured.body.data.some((row: { category: string }) => row.category === 'parks')).toBe(true);

    const forbidden = await municipalAgent
      .post('/api/admin/departments')
      .set(CSRF)
      .send({ name: 'Not Allowed' });
    expect(forbidden.status).toBe(403);

    const deactivated = await platformAgent
      .delete(`/api/admin/departments/${departmentId}`)
      .set(CSRF);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.message).toContain('deactivated');

    const rules = await platformAgent.get('/api/admin/routing-rules');
    const parkRule = rules.body.data.find(
      (row: { category: string }) => row.category === 'parks',
    );
    expect(parkRule.active).toBe(false);

    const logs = await platformAgent.get('/api/admin/audit-logs?pageSize=100');
    expect(logs.status).toBe(200);
    const actions = logs.body.data.map((row: { action: string }) => row.action);
    expect(actions).toContain('department.created');
    expect(actions).toContain('category.created');
    expect(actions).toContain('routing_rule.created');
    expect(actions).toContain('sla.created');
    expect(actions).toContain('department.deactivated');

    const municipalAudit = await municipalAgent.get('/api/admin/audit-logs');
    expect(municipalAudit.status).toBe(403);
  });

  it('manages users, enforces last-administrator and self-modification guards', async () => {
    const created = await platformAgent
      .post('/api/admin/users')
      .set(CSRF)
      .send({
        name: 'New Field Officer',
        email: 'new.field@example.test',
        password: 'FieldPassword123',
        role: 'field_staff',
        departmentIds: [refs.publicWorks.id],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.role).toBe('field_staff');
    expect(created.body.data.departments[0].name).toBe('Public Works');
    expect(JSON.stringify(created.body)).not.toContain('passwordHash');

    const userId = created.body.data.id;
    const updated = await platformAgent
      .patch(`/api/admin/users/${userId}`)
      .set(CSRF)
      .send({ role: 'department_manager' });
    expect(updated.status).toBe(200);

    const stored = await User.findById(userId).lean();
    expect(stored?.role).toBe('department_manager');
    expect(stored?.tokenVersion).toBe(1);

    const selfDeactivate = await platformAgent
      .patch(`/api/admin/users/${platformAdmin.id}`)
      .set(CSRF)
      .send({ active: false });
    expect(selfDeactivate.status).toBe(409);

    const forbidden = await municipalAgent.get('/api/admin/users');
    expect(forbidden.status).toBe(403);

    const clientSearch = await platformAgent.get(
      `/api/admin/users?q=${encodeURIComponent('new.field')}&role=department_manager`,
    );
    expect(clientSearch.status).toBe(200);
    expect(clientSearch.body.pagination.total).toBe(1);

    const logs = await platformAgent.get('/api/admin/audit-logs?action=user.updated');
    expect(logs.status).toBe(200);
    expect(logs.body.data.length).toBeGreaterThan(0);
  });
});

describe('exports and attachments', () => {
  it('exports filtered CSV and audits the export', async () => {
    const created = await createReport();
    const exported = await municipalAgent.get('/api/admin/analytics/export?status=Submitted');
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('Reference');
    expect(exported.text).toContain(created.reportId);
    expect(exported.text).not.toContain('Internal:');

    const forbidden = await citizen.get('/api/admin/analytics/export');
    expect(forbidden.status).toBe(403);

    const logs = await platformAgent.get('/api/admin/audit-logs?action=reports.exported');
    expect(logs.body.data.length).toBe(1);
  });

  it('validates uploads and enforces attachment visibility and ownership', async () => {
    const created = await createReport();

    const uploaded = await citizen
      .post(`/api/reports/${created.reportId}/attachments`)
      .set(CSRF)
      .field('visibility', 'citizen')
      .attach('file', PNG_BYTES, { filename: 'pothole.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    const attachmentId = uploaded.body.data.id;

    const ownerDownload = await citizen.get(`/api/attachments/${attachmentId}`);
    expect(ownerDownload.status).toBe(200);
    expect(ownerDownload.headers['content-type']).toContain('image/png');
    expect(ownerDownload.headers['x-content-type-options']).toBe('nosniff');

    const otherAgent = await registerCitizen('attachment.other@example.test');
    const otherDownload = await otherAgent.get(`/api/attachments/${attachmentId}`);
    expect(otherDownload.status).toBe(404);

    const invalid = await citizen
      .post(`/api/reports/${created.reportId}/attachments`)
      .set(CSRF)
      .attach('file', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });
    expect(invalid.status).toBe(422);

    const internal = await municipalAgent
      .post(`/api/reports/${created.reportId}/attachments`)
      .set(CSRF)
      .field('visibility', 'internal')
      .attach('file', PNG_BYTES, { filename: 'inspection.png', contentType: 'image/png' });
    expect(internal.status).toBe(201);
    const internalId = internal.body.data.id;

    const citizenInternal = await citizen.get(`/api/attachments/${internalId}`);
    expect(citizenInternal.status).toBe(404);
    const adminInternal = await municipalAgent.get(`/api/attachments/${internalId}`);
    expect(adminInternal.status).toBe(200);

    const detail = await municipalAgent.get(`/api/reports/${created.reportId}`);
    expect(detail.body.data.report.attachments).toHaveLength(2);

    const citizenDetail = await citizen.get(`/api/reports/${created.reportId}`);
    expect(citizenDetail.body.data.report.attachments).toHaveLength(1);
    expect(citizenDetail.body.data.report.attachments[0].visibility).toBe('citizen');
  });
});

describe('notifications and preferences', () => {
  it('marks notifications read and persists channel preferences', async () => {
    const created = await createReport();
    await municipalAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Under Review' });

    const list = await citizen.get('/api/notifications');
    expect(list.status).toBe(200);
    expect(list.body.meta.unread).toBeGreaterThan(0);
    const notificationId = list.body.data[0].id;

    const read = await citizen.patch(`/api/notifications/${notificationId}/read`).set(CSRF).send({});
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();

    const readAll = await citizen.patch('/api/notifications/read-all').set(CSRF).send({});
    expect(readAll.status).toBe(200);

    const preferences = await citizen
      .patch('/api/notifications/preferences')
      .set(CSRF)
      .send({ inApp: true, email: false });
    expect(preferences.status).toBe(200);
    expect(preferences.body.data.emailConfigured).toBe(false);

    const fetched = await citizen.get('/api/notifications/preferences');
    expect(fetched.body.data.preferences.inApp).toBe(true);

    const forbidden = await citizen
      .patch('/api/notifications/000000000000000000000000/read')
      .set(CSRF)
      .send({});
    expect(forbidden.status).toBe(404);
  });
});
