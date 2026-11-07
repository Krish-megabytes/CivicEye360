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
import { Report } from '../src/models/Report.js';

let refs: ReferenceData;
let citizen: TestAgent;
let otherCitizen: TestAgent;
let municipalAdmin: { id: string; email: string; name: string; role: string };
let adminAgent: TestAgent;
let fieldStaff: { id: string; email: string; name: string; role: string };
let fieldAgent: TestAgent;

beforeAll(startTestContext);
afterAll(stopTestContext);

beforeEach(async () => {
  await clearDatabase();
  refs = await seedReferenceData();
  citizen = await registerCitizen('citizen.one@example.test');
  otherCitizen = await registerCitizen('citizen.two@example.test');
  municipalAdmin = await createUser({
    email: 'city.admin@example.test',
    role: 'municipal_admin',
  });
  adminAgent = await login(municipalAdmin.email);
  fieldStaff = await createUser({
    email: 'field.one@example.test',
    role: 'field_staff',
    departmentIds: [refs.publicWorks.id],
  });
  fieldAgent = await login(fieldStaff.email);
});

async function submitReport(
  agent: TestAgent,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; reportId: string; trackingCode: string; status: string }> {
  const response = await agent
    .post('/api/reports')
    .set(CSRF)
    .send({ ...validReport, ...overrides });
  if (response.status !== 201) {
    throw new Error(`Report creation failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return {
    id: response.body.data.report.id,
    reportId: response.body.data.report.reportId,
    trackingCode: response.body.data.report.trackingCode,
    status: response.body.data.report.status,
  };
}

describe('report creation and ownership', () => {
  it('persists a report with a reference, routing, timeline and tracking code', async () => {
    const created = await submitReport(citizen);
    expect(created.reportId).toMatch(/^CE-\d{4}-\d{6}$/);
    expect(created.trackingCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);

    const stored = await Report.findOne({ reportId: created.reportId }).lean();
    expect(stored).toBeTruthy();
    expect(String(stored?.departmentId)).toBe(refs.publicWorks.id);
    expect(stored?.status).toBe('Submitted');
    expect(stored?.location.latitude).toBe(validReport.location.latitude);

    const detail = await citizen.get(`/api/reports/${created.reportId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.report.title).toBe(validReport.title);
    expect(detail.body.data.report.department.name).toBe('Public Works');
    expect(detail.body.data.history).toHaveLength(1);
    expect(detail.body.data.actions.canComment).toBe(true);
  });

  it('validates category, minimum description and location pairing', async () => {
    const badCategory = await citizen
      .post('/api/reports')
      .set(CSRF)
      .send({ ...validReport, category: 'not-a-category' });
    expect(badCategory.status).toBe(422);

    const short = await citizen
      .post('/api/reports')
      .set(CSRF)
      .send({ ...validReport, description: 'Too short' });
    expect(short.status).toBe(422);

    const halfCoordinates = await citizen
      .post('/api/reports')
      .set(CSRF)
      .send({
        ...validReport,
        location: { address: '12 Civic Row, Northbridge', latitude: 40.4, longitude: null },
      });
    expect(halfCoordinates.status).toBe(422);
  });

  it('prevents citizens from reading or listing another citizen report', async () => {
    const created = await submitReport(citizen);
    const otherDetail = await otherCitizen.get(`/api/reports/${created.reportId}`);
    expect(otherDetail.status).toBe(404);

    const otherList = await otherCitizen.get('/api/reports/my');
    expect(otherList.status).toBe(200);
    expect(otherList.body.pagination.total).toBe(0);

    const ownList = await citizen.get('/api/reports/my');
    expect(ownList.body.pagination.total).toBe(1);
    expect(ownList.body.data[0].reportId).toBe(created.reportId);
  });

  it('shows submitted reports in the admin queue with filters and pagination', async () => {
    const first = await submitReport(citizen, { title: 'Pothole on Oak Street near the bakery' });
    await submitReport(citizen, { title: 'Second pothole on Elm Street' });
    await submitReport(citizen, {
      title: 'Overflowing bin outside the post office',
      description:
        'A public bin outside the post office has overflowed and rubbish is spread across the pavement.',
      category: 'waste',
    });

    const all = await adminAgent.get('/api/reports?status=Submitted&pageSize=2&page=1');
    expect(all.status).toBe(200);
    expect(all.body.pagination.total).toBe(3);
    expect(all.body.pagination.totalPages).toBe(2);
    expect(all.body.data).toHaveLength(2);

    const byCategory = await adminAgent.get('/api/reports?category=waste');
    expect(byCategory.body.pagination.total).toBe(1);
    expect(byCategory.body.data[0].category).toBe('waste');

    const search = await adminAgent.get(`/api/reports?q=${encodeURIComponent('Oak Street')}`);
    expect(search.body.pagination.total).toBe(1);
    expect(search.body.data[0].reportId).toBe(first.reportId);

    const byReference = await adminAgent.get(`/api/reports?q=${first.reportId}`);
    expect(byReference.body.data[0].reportId).toBe(first.reportId);
  });
});

describe('report workflow', () => {
  it('runs review, assignment, field progress, resolution and citizen feedback', async () => {
    const created = await submitReport(citizen);

    const invalid = await adminAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Resolved', resolutionSummary: 'Skipped required steps entirely.' });
    expect(invalid.status).toBe(409);

    const review = await adminAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Under Review' });
    expect(review.status).toBe(200);
    expect(review.body.data.report.status).toBe('Under Review');

    const assignment = await adminAgent
      .patch(`/api/reports/${created.reportId}/assignment`)
      .set(CSRF)
      .send({ assigneeId: fieldStaff.id, departmentId: refs.publicWorks.id });
    expect(assignment.status).toBe(200);
    expect(assignment.body.data.report.status).toBe('Assigned');
    expect(assignment.body.data.report.assignee.name).toBe(fieldStaff.name);

    const fieldList = await fieldAgent.get('/api/reports/my');
    expect(fieldList.body.pagination.total).toBe(1);

    const progress = await fieldAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'In Progress' });
    expect(progress.status).toBe(200);

    const noSummary = await fieldAgent
      .post(`/api/reports/${created.reportId}/resolution`)
      .set(CSRF)
      .send({ resolutionSummary: 'Done' });
    expect(noSummary.status).toBe(422);

    const resolved = await fieldAgent
      .post(`/api/reports/${created.reportId}/resolution`)
      .set(CSRF)
      .send({
        resolutionSummary:
          'The pothole was cleaned, filled with hot-mix asphalt and compacted. The area was swept and checked.',
        note: 'Internal: crew used the evening lane closure permit.',
      });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.report.status).toBe('Resolved');
    expect(resolved.body.data.report.resolutionSummary).toContain('hot-mix asphalt');

    const citizenDetail = await citizen.get(`/api/reports/${created.reportId}`);
    expect(citizenDetail.body.data.report.status).toBe('Resolved');
    expect(citizenDetail.body.data.actions.canSubmitFeedback).toBe(true);
    const internal = citizenDetail.body.data.history.find(
      (entry: { note: string | null }) => entry.note?.startsWith('Internal:'),
    );
    expect(internal).toBeUndefined();

    const feedback = await citizen
      .post(`/api/reports/${created.reportId}/feedback`)
      .set(CSRF)
      .send({ rating: 5, comment: 'Repaired well and the crew was tidy.' });
    expect(feedback.status).toBe(201);

    const duplicateFeedback = await citizen
      .post(`/api/reports/${created.reportId}/feedback`)
      .set(CSRF)
      .send({ rating: 3 });
    expect(duplicateFeedback.status).toBe(409);

    const notificationResponse = await citizen.get('/api/notifications');
    expect(notificationResponse.status).toBe(200);
    expect(
      notificationResponse.body.data.some(
        (notification: { type: string }) => notification.type === 'report_resolved',
      ),
    ).toBe(true);

    const fieldNotifications = await fieldAgent.get('/api/notifications');
    expect(
      fieldNotifications.body.data.some(
        (notification: { type: string }) => notification.type === 'report_assigned',
      ),
    ).toBe(true);
  });

  it('requires reasons for rejection and rejects invalid transitions', async () => {
    const created = await submitReport(citizen);
    await adminAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Under Review' });

    const noReason = await adminAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Rejected' });
    expect(noReason.status).toBe(422);

    const rejected = await adminAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Rejected', reason: 'This location belongs to the county road authority.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.report.status).toBe('Rejected');

    const detail = await citizen.get(`/api/reports/${created.reportId}`);
    const last = detail.body.data.history.at(-1);
    expect(last.toStatus).toBe('Rejected');
    expect(last.reason).toContain('county road authority');

    const citizenAttempt = await citizen
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Reopened', reason: 'Please reconsider this decision.' });
    expect(citizenAttempt.status).toBe(409);
  });

  it('keeps internal comments out of citizen views and supports information requests', async () => {
    const created = await submitReport(citizen);
    const internal = await adminAgent
      .post(`/api/reports/${created.reportId}/comments`)
      .set(CSRF)
      .send({ body: 'Internal only: check the contractor schedule.', visibility: 'internal' });
    expect(internal.status).toBe(201);

    const publicComment = await adminAgent
      .post(`/api/reports/${created.reportId}/comments`)
      .set(CSRF)
      .send({
        body: 'Could you confirm the nearest junction?',
        visibility: 'citizen',
        requestInformation: true,
      });
    expect(publicComment.status).toBe(201);

    const citizenDetail = await citizen.get(`/api/reports/${created.reportId}`);
    expect(citizenDetail.body.data.comments).toHaveLength(1);
    expect(citizenDetail.body.data.comments[0].body).toContain('nearest junction');

    const adminDetail = await adminAgent.get(`/api/reports/${created.reportId}`);
    expect(adminDetail.body.data.comments).toHaveLength(2);

    const notifications = await citizen.get('/api/notifications');
    expect(
      notifications.body.data.some(
        (notification: { type: string }) => notification.type === 'information_requested',
      ),
    ).toBe(true);

    const citizenInternal = await citizen
      .post(`/api/reports/${created.reportId}/comments`)
      .set(CSRF)
      .send({ body: 'Trying to write an internal note.', visibility: 'internal' });
    expect(citizenInternal.status).toBe(403);
  });

  it('supports owner reopen requests and manager-authored reopening with a reason', async () => {
    const created = await submitReport(citizen);
    await adminAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Under Review' });
    await adminAgent
      .patch(`/api/reports/${created.reportId}/assignment`)
      .set(CSRF)
      .send({ assigneeId: fieldStaff.id, departmentId: refs.publicWorks.id });
    await fieldAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'In Progress' });
    await fieldAgent
      .post(`/api/reports/${created.reportId}/resolution`)
      .set(CSRF)
      .send({ resolutionSummary: 'Filled the pothole and swept the surrounding area.' });

    const reopen = await citizen
      .post(`/api/reports/${created.reportId}/reopen-request`)
      .set(CSRF)
      .send({ note: 'The patch has already started to crumble after two days.' });
    expect(reopen.status).toBe(200);
    expect(reopen.body.data.report.reopenRequested).toBe(true);

    const staffDetail = await adminAgent.get(`/api/reports/${created.reportId}`);
    expect(staffDetail.body.data.report.reopenRequestNote).toContain('started to crumble');

    const withoutReason = await adminAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Reopened' });
    expect(withoutReason.status).toBe(422);

    const reopened = await adminAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Reopened', reason: 'Reopening after the citizen reported a failed patch.' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.report.status).toBe('Reopened');
  });

  it('scopes department managers to their own department', async () => {
    const sanitationField = await createUser({
      email: 'field.sanitation@example.test',
      role: 'field_staff',
      departmentIds: [refs.sanitation.id],
    });
    const publicWorksManager = await createUser({
      email: 'manager.pw@example.test',
      role: 'department_manager',
      departmentIds: [refs.publicWorks.id],
    });
    const sanitationManager = await createUser({
      email: 'manager.san@example.test',
      role: 'department_manager',
      departmentIds: [refs.sanitation.id],
    });
    const pwManagerAgent = await login(publicWorksManager.email);
    const sanManagerAgent = await login(sanitationManager.email);

    const created = await submitReport(citizen);

    const ownList = await pwManagerAgent.get('/api/reports');
    expect(ownList.body.pagination.total).toBe(1);
    expect(ownList.body.data[0].reportId).toBe(created.reportId);

    const otherList = await sanManagerAgent.get('/api/reports');
    expect(otherList.body.pagination.total).toBe(0);

    const otherDetail = await sanManagerAgent.get(`/api/reports/${created.reportId}`);
    expect(otherDetail.status).toBe(404);

    const crossDepartment = await pwManagerAgent
      .patch(`/api/reports/${created.reportId}/assignment`)
      .set(CSRF)
      .send({ assigneeId: sanitationField.id, departmentId: refs.sanitation.id });
    expect(crossDepartment.status).toBe(403);

    const review = await pwManagerAgent
      .patch(`/api/reports/${created.reportId}/status`)
      .set(CSRF)
      .send({ status: 'Under Review' });
    expect(review.status).toBe(200);

    const assignment = await pwManagerAgent
      .patch(`/api/reports/${created.reportId}/assignment`)
      .set(CSRF)
      .send({ assigneeId: fieldStaff.id, departmentId: refs.publicWorks.id });
    expect(assignment.status).toBe(200);

    const unassignedField = await createUser({
      email: 'field.two@example.test',
      role: 'field_staff',
      departmentIds: [refs.publicWorks.id],
    });
    const unassignedAgent = await login(unassignedField.email);
    const hidden = await unassignedAgent.get(`/api/reports/${created.reportId}`);
    expect(hidden.status).toBe(404);
  });
});

describe('tracking, AI fallbacks and moderation', () => {
  it('tracks a report only with a valid derived code and hides moderated records', async () => {
    const created = await submitReport(citizen);

    const valid = await request(app)
      .post('/api/track')
      .set(CSRF)
      .send({ reportId: created.reportId, trackingCode: created.trackingCode });
    expect(valid.status).toBe(200);
    expect(valid.body.data.status).toBe('Submitted');
    expect(valid.body.data.privacyNote).toBeTruthy();

    const invalid = await request(app)
      .post('/api/track')
      .set(CSRF)
      .send({ reportId: created.reportId, trackingCode: 'AAAA-BBBB-CCCC-DDDD' });
    expect(invalid.status).toBe(404);

    const hidden = await adminAgent
      .patch(`/api/reports/${created.reportId}/moderation`)
      .set(CSRF)
      .send({ visible: false, reason: 'Contains personal information; under review.' });
    expect(hidden.status).toBe(200);

    const trackedHidden = await request(app)
      .post('/api/track')
      .set(CSRF)
      .send({ reportId: created.reportId, trackingCode: created.trackingCode });
    expect(trackedHidden.status).toBe(404);

    const ownerDetail = await citizen.get(`/api/reports/${created.reportId}`);
    expect(ownerDetail.status).toBe(200);
  });

  it('uses a labelled rules fallback when no AI key is configured', async () => {
    const classification = await citizen
      .post('/api/ai/classify-report')
      .set(CSRF)
      .send({
        title: 'Pothole and broken asphalt on the crossing',
        description:
          'There is a pothole in the road surface beside the library crossing that is unsafe for cyclists.',
      });
    expect(classification.status).toBe(200);
    expect(classification.body.data.source).toBe('rules');
    expect(classification.body.data.aiConfigured).toBe(false);
    expect(classification.body.data.category).toBe('roads');
    expect(classification.body.data.disclaimer).toBeTruthy();
  });

  it('limits duplicate hints to triage roles and never merges automatically', async () => {
    const first = await submitReport(citizen);
    const created = await submitReport(citizen, {
      title: 'Another deep pothole on the same library crossing',
      description:
        'A second pothole has appeared at the library crossing on Civic Row, close to the first one. It is deep and unsafe.',
    });

    const forbidden = await citizen
      .post('/api/ai/duplicate-hints')
      .set(CSRF)
      .send({ reportId: created.reportId });
    expect(forbidden.status).toBe(403);

    const hints = await adminAgent
      .post('/api/ai/duplicate-hints')
      .set(CSRF)
      .send({ reportId: created.reportId });
    expect(hints.status).toBe(200);
    expect(hints.body.data.method).toBe('rules-based');
    expect(hints.body.data.note).toContain('never merges');
    expect(hints.body.data.hints.length).toBeGreaterThan(0);
    expect(hints.body.data.hints[0].reportId).toBe(first.reportId);

    const summary = await adminAgent
      .post('/api/ai/summarize-report')
      .set(CSRF)
      .send({ reportId: created.reportId });
    expect(summary.status).toBe(200);
    expect(summary.body.data.source).toBe('rules');
    expect(summary.body.data.summary.length).toBeGreaterThan(10);
  });

  it('serves public categories and reports honest service configuration', async () => {
    const categories = await request(app).get('/api/categories');
    expect(categories.status).toBe(200);
    expect(categories.body.data.length).toBeGreaterThanOrEqual(10);
    expect(categories.body.data[0]).not.toHaveProperty('active');

    const config = await request(app).get('/api/public-config');
    expect(config.status).toBe(200);
    expect(config.body.data.aiConfigured).toBe(false);
    expect(config.body.data.emailConfigured).toBe(false);
    expect(config.body.data.demoMode).toBe(true);

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.database).toBe('connected');
    expect(JSON.stringify(health.body)).not.toContain('JWT_SECRET');
  });
});
