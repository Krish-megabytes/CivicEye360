/**
 * Development seed. All people and reports below are fictional.
 * Run with `npm run seed` (safe) or `npm run seed:reset` (drops app data first).
 * Refuses to run in production unless ALLOW_DEMO_SEED=true is set explicitly.
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './lib/db.js';
import { env } from './config/env.js';
import { hashPassword } from './auth/passwords.js';
import { User } from './models/User.js';
import { Department } from './models/Department.js';
import { Category } from './models/Category.js';
import { RoutingRule } from './models/RoutingRule.js';
import { SlaConfig } from './models/SlaConfig.js';
import { Report, type ReportDocument } from './models/Report.js';
import { StatusHistory } from './models/StatusHistory.js';
import { ReportComment } from './models/ReportComment.js';
import { Notification } from './models/Notification.js';
import { Feedback } from './models/Feedback.js';
import { AuditLog } from './models/AuditLog.js';
import { Counter } from './models/Counter.js';
import { DEFAULT_CATEGORIES, type Priority, type ReportStatus } from './domain/constants.js';
import { addBusinessHours } from './lib/sla.js';

const DEMO_PASSWORD = 'CivicEye!Demo2026';
const reset = process.argv.includes('--reset');

if (env.isProd && process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error('Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=true only for a disposable environment.');
  process.exit(1);
}

const now = new Date();
const daysAgo = (days: number, hours = 9) => {
  const date = new Date(now.getTime() - days * 86_400_000);
  date.setUTCHours(hours, 0, 0, 0);
  return date;
};
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);

async function main() {
  await connectDatabase();

  const existingReports = await Report.countDocuments({});
  if (existingReports > 0 && !reset) {
    console.log(`Database already contains ${existingReports} reports. Use "npm run seed:reset" to replace demo data.`);
    await disconnectDatabase();
    return;
  }

  if (reset) {
    console.log('Resetting application collections (development data only)...');
    await Promise.all([
      Report.deleteMany({}),
      StatusHistory.deleteMany({}),
      ReportComment.deleteMany({}),
      Notification.deleteMany({}),
      Feedback.deleteMany({}),
      AuditLog.deleteMany({}),
      Department.deleteMany({}),
      Category.deleteMany({}),
      RoutingRule.deleteMany({}),
      SlaConfig.deleteMany({}),
      Counter.deleteMany({}),
      User.deleteMany({ email: /@civiceye\.local$/ }),
    ]);
  }

  const categories = await Category.insertMany(
    DEFAULT_CATEGORIES.map((category, index) => ({
      ...category,
      active: true,
      sortOrder: (index + 1) * 10,
    })),
  );
  console.log(`Created ${categories.length} categories.`);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const departments = await Department.insertMany([
    {
      name: 'Public Works',
      description: 'Roads, street lighting, signs and public property (demo department).',
      supportedCategories: ['roads', 'streetlights', 'traffic-signs', 'public-property'],
      active: true,
      memberIds: [],
    },
    {
      name: 'Sanitation',
      description: 'Waste collection, public cleaning and sanitation (demo department).',
      supportedCategories: ['waste', 'sanitation', 'parks'],
      active: true,
      memberIds: [],
    },
    {
      name: 'Water & Drainage',
      description: 'Drainage, water supply and flood response (demo department).',
      supportedCategories: ['drainage', 'water-supply'],
      active: true,
      memberIds: [],
    },
  ]);
  const [publicWorks, sanitation, water] = departments;

  const users = await User.insertMany([
    {
      name: 'Demo Platform Admin',
      email: 'admin@civiceye.local',
      passwordHash,
      role: 'platform_admin',
      departmentIds: [],
      active: true,
    },
    {
      name: 'Demo City Administrator',
      email: 'city.admin@civiceye.local',
      passwordHash,
      role: 'municipal_admin',
      departmentIds: [],
      active: true,
    },
    {
      name: 'Rosa Delgado (Demo)',
      email: 'roads.manager@civiceye.local',
      passwordHash,
      role: 'department_manager',
      departmentIds: [publicWorks._id],
      active: true,
    },
    {
      name: 'Miriam Okafor (Demo)',
      email: 'sanitation.manager@civiceye.local',
      passwordHash,
      role: 'department_manager',
      departmentIds: [sanitation._id],
      active: true,
    },
    {
      name: 'Ali Haddad (Demo)',
      email: 'field.ali@civiceye.local',
      passwordHash,
      role: 'field_staff',
      departmentIds: [publicWorks._id],
      active: true,
    },
    {
      name: 'Mira Chen (Demo)',
      email: 'field.mira@civiceye.local',
      passwordHash,
      role: 'field_staff',
      departmentIds: [publicWorks._id],
      active: true,
    },
    {
      name: 'Jo Mensah (Demo)',
      email: 'field.jo@civiceye.local',
      passwordHash,
      role: 'field_staff',
      departmentIds: [sanitation._id],
      active: true,
    },
    {
      name: 'Demo Citizen',
      email: 'citizen@civiceye.local',
      passwordHash,
      role: 'citizen',
      departmentIds: [],
      active: true,
    },
    {
      name: 'Sam Rivera (Demo)',
      email: 'citizen2@civiceye.local',
      passwordHash,
      role: 'citizen',
      departmentIds: [],
      active: true,
    },
  ]);

  const [admin, cityAdmin, roadsManager, sanitationManager, ali, mira, jo, citizen, citizen2] = users;

  await Department.updateOne(
    { _id: publicWorks._id },
    { $set: { memberIds: [roadsManager._id, ali._id, mira._id] } },
  );
  await Department.updateOne(
    { _id: sanitation._id },
    { $set: { memberIds: [sanitationManager._id, jo._id] } },
  );

  await RoutingRule.insertMany([
    { category: 'roads', departmentId: publicWorks._id, active: true },
    { category: 'streetlights', departmentId: publicWorks._id, active: true },
    { category: 'traffic-signs', departmentId: publicWorks._id, active: true },
    { category: 'public-property', departmentId: publicWorks._id, active: true },
    { category: 'waste', departmentId: sanitation._id, active: true },
    { category: 'sanitation', departmentId: sanitation._id, active: true },
    { category: 'parks', departmentId: sanitation._id, active: true },
    { category: 'drainage', departmentId: water._id, active: true },
    { category: 'water-supply', departmentId: water._id, active: true },
  ]);

  await SlaConfig.insertMany([
    {
      category: '*',
      priority: 'High',
      targetHours: 24,
      businessCalendar: { timezone: 'UTC', weekdays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
      active: true,
      updatedBy: admin._id,
    },
    {
      category: '*',
      priority: 'Urgent',
      targetHours: 8,
      businessCalendar: { timezone: 'UTC', weekdays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
      active: true,
      updatedBy: admin._id,
    },
    {
      category: 'roads',
      priority: '*',
      targetHours: 72,
      businessCalendar: { timezone: 'UTC', weekdays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
      active: true,
      updatedBy: admin._id,
    },
    {
      category: 'waste',
      priority: '*',
      targetHours: 48,
      businessCalendar: { timezone: 'UTC', weekdays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
      active: true,
      updatedBy: admin._id,
    },
  ]);

  interface ReportSeed {
    title: string;
    description: string;
    category: string;
    status: ReportStatus;
    priority: Priority;
    address: string;
    latitude: number;
    longitude: number;
    department: typeof publicWorks | null;
    assignee?: typeof ali | null;
    reporter: typeof citizen;
    createdDaysAgo: number;
    resolutionSummary?: string;
    feedback?: { rating: number; comment: string };
    reopenRequested?: boolean;
    reopenNote?: string;
  }

  const seeds: ReportSeed[] = [
    {
      title: 'Deep pothole on Cedar Avenue near the school crossing',
      description:
        'A pothole about half a metre wide has opened up in the eastbound lane just before the school crossing. Cars are swerving into the opposite lane to avoid it and it becomes hard to see when it rains.',
      category: 'roads',
      status: 'Assigned',
      priority: 'High',
      address: 'Cedar Avenue at 5th Street, Northbridge (demo)',
      latitude: 40.4421,
      longitude: -79.9952,
      department: publicWorks,
      assignee: ali,
      reporter: citizen,
      createdDaysAgo: 4,
    },
    {
      title: 'Streetlight out on Harbour Walk for three nights',
      description:
        'The streetlight between the ferry steps and the playground has been dark for three nights. The path is used by families in the evening and the nearest working light is a block away.',
      category: 'streetlights',
      status: 'In Progress',
      priority: 'High',
      address: 'Harbour Walk, north of Ferry Steps, Northbridge (demo)',
      latitude: 40.4459,
      longitude: -80.0021,
      department: publicWorks,
      assignee: mira,
      reporter: citizen2,
      createdDaysAgo: 6,
    },
    {
      title: 'Overflowing public bins at Market Square',
      description:
        'The two bins beside the Market Square bus stop are overflowing and waste is blowing across the plaza. The Sunday market finished yesterday and the bins have not been emptied.',
      category: 'waste',
      status: 'Resolved',
      priority: 'Medium',
      address: 'Market Square bus stop, Northbridge (demo)',
      latitude: 40.4403,
      longitude: -79.9966,
      department: sanitation,
      assignee: jo,
      reporter: citizen,
      createdDaysAgo: 12,
      resolutionSummary:
        'Bins were emptied and sanitised on the morning route. The collection schedule for Market Square has been noted for a Sunday review.',
      feedback: {
        rating: 4,
        comment: 'Bins were cleared quickly. A second Sunday collection would help.',
      },
    },
    {
      title: 'Blocked storm drain flooding the pedestrian crossing',
      description:
        'Leaves and debris have blocked the storm drain at the corner, so rainwater is pooling across the pedestrian crossing. It is ankle deep after moderate rain and difficult for wheelchair users.',
      category: 'drainage',
      status: 'Submitted',
      priority: 'High',
      address: 'Ash Street and Willow Lane, Northbridge (demo)',
      latitude: 40.4388,
      longitude: -80.001,
      department: water,
      assignee: null,
      reporter: citizen,
      createdDaysAgo: 1,
    },
    {
      title: 'Water leaking from the pavement outside the library',
      description:
        'Water has been seeping up through the pavement outside the public library since Friday. The flow is small but constant and the pavement is becoming uneven. No visible sign of a burst pipe.',
      category: 'water-supply',
      status: 'Under Review',
      priority: 'Medium',
      address: 'Northbridge Central Library, 12 Civic Row, Northbridge (demo)',
      latitude: 40.4435,
      longitude: -79.998,
      department: water,
      assignee: null,
      reporter: citizen2,
      createdDaysAgo: 3,
    },
    {
      title: 'Damaged fence around the Riverside playground',
      description:
        'A section of the low fence beside the toddler play area is bent outward, leaving a gap onto the service road. Children can reach the road through the gap.',
      category: 'parks',
      status: 'Assigned',
      priority: 'Urgent',
      address: 'Riverside Playground, River Road, Northbridge (demo)',
      latitude: 40.4472,
      longitude: -80.0055,
      department: sanitation,
      assignee: jo,
      reporter: citizen,
      createdDaysAgo: 2,
    },
    {
      title: 'Faded school-zone markings on Birch Street',
      description:
        'The painted school-zone chevrons and the 20 km/h marking outside Birch Street School have almost completely faded. Drivers are ignoring the zone during drop-off.',
      category: 'traffic-signs',
      status: 'Resolved',
      priority: 'Medium',
      address: 'Birch Street Primary School, Northbridge (demo)',
      latitude: 40.4369,
      longitude: -79.9907,
      department: publicWorks,
      assignee: ali,
      reporter: citizen2,
      createdDaysAgo: 20,
      resolutionSummary:
        'Markings were repainted overnight and reflective studs replaced at both approaches. The school was notified before the work started.',
    },
    {
      title: 'Missing stop sign at the exit of the community centre',
      description:
        'The stop sign at the car park exit has been missing since a storm two weeks ago. Cars are entering the main road without stopping and visibility is poor.',
      category: 'traffic-signs',
      status: 'Closed',
      priority: 'High',
      address: 'Eastside Community Centre, Northbridge (demo)',
      latitude: 40.4488,
      longitude: -79.9899,
      department: publicWorks,
      assignee: mira,
      reporter: citizen,
      createdDaysAgo: 25,
      resolutionSummary: 'A replacement stop sign was installed and checked by the traffic crew.',
      feedback: { rating: 5, comment: 'Sign was replaced within two days. Thank you.' },
    },
    {
      title: 'Repeated dumping behind the recycling point',
      description:
        'Household furniture and bags of rubbish have been left behind the recycling point for the third time this month. The area smells and attracts pests.',
      category: 'waste',
      status: 'Reopened',
      priority: 'Medium',
      address: 'Lee Street recycling point, Northbridge (demo)',
      latitude: 40.441,
      longitude: -79.9868,
      department: sanitation,
      assignee: jo,
      reporter: citizen2,
      createdDaysAgo: 18,
      resolutionSummary: 'Waste removed and a temporary camera request was submitted to the enforcement team.',
    },
    {
      title: 'Loose paving slabs outside the health clinic',
      description:
        'Three paving slabs in front of the clinic entrance rock when stepped on. One is raised by about two centimetres and a patient tripped last week.',
      category: 'public-property',
      status: 'In Progress',
      priority: 'High',
      address: 'Northbridge Community Health Clinic, Mersey Road, Northbridge (demo)',
      latitude: 40.4348,
      longitude: -80.0041,
      department: publicWorks,
      assignee: ali,
      reporter: citizen,
      createdDaysAgo: 8,
    },
    {
      title: 'Broken bench in the sensory garden',
      description:
        'The wooden bench nearest the garden gate has a cracked seat and a loose armrest. Visitors who need to rest do not have a safe place to sit.',
      category: 'parks',
      status: 'Under Review',
      priority: 'Low',
      address: 'Civic Sensory Garden, Northbridge (demo)',
      latitude: 40.4446,
      longitude: -79.9977,
      department: sanitation,
      assignee: null,
      reporter: citizen2,
      createdDaysAgo: 9,
    },
    {
      title: 'Public toilet at the station closed without notice',
      description:
        'The accessible public toilet on Platform 2 has been locked for six days with no notice. Staff say they do not have a key. This affects travellers with mobility needs.',
      category: 'sanitation',
      status: 'Assigned',
      priority: 'Medium',
      address: 'Northbridge Central Station, Platform 2, Northbridge (demo)',
      latitude: 40.4399,
      longitude: -79.9931,
      department: sanitation,
      assignee: jo,
      reporter: citizen,
      createdDaysAgo: 5,
    },
    {
      title: 'Large branch hanging over the footpath after storm',
      description:
        'A broken branch is hanging over the footpath beside the canal. It has not fallen but is moving in the wind and the path is partly blocked.',
      category: 'parks',
      status: 'Resolved',
      priority: 'High',
      address: 'Canal Path near Lock 4, Northbridge (demo)',
      latitude: 40.4501,
      longitude: -80.0088,
      department: sanitation,
      assignee: jo,
      reporter: citizen2,
      createdDaysAgo: 15,
      resolutionSummary:
        'Branch was removed by the arborist crew and the path was swept. The tree was assessed and no further work is required.',
      feedback: { rating: 5, comment: 'Crew arrived the same afternoon and kept us updated.' },
    },
    {
      title: 'Repeated garbage collection missed on Orchard Terrace',
      description:
        'Green bins on Orchard Terrace have been missed twice in a row. Neighbours have left bins out for two days and animals are tearing the bags.',
      category: 'waste',
      status: 'Rejected',
      priority: 'Low',
      address: 'Orchard Terrace, Northbridge (demo)',
      latitude: 40.4375,
      longitude: -79.9844,
      department: sanitation,
      assignee: null,
      reporter: citizen2,
      createdDaysAgo: 22,
      resolutionSummary: 'Rejected as a duplicate of an existing collection-route report.',
    },
    {
      title: 'Water supply pressure low on Alder Court',
      description:
        'Water pressure has been low on Alder Court for four days, especially in the morning. Two houses at the top of the street have almost no flow.',
      category: 'water-supply',
      status: 'In Progress',
      priority: 'Medium',
      address: 'Alder Court, Northbridge (demo)',
      latitude: 40.4466,
      longitude: -79.9912,
      department: water,
      assignee: null,
      reporter: citizen,
      createdDaysAgo: 11,
    },
    {
      title: 'Graffiti on the pedestrian underpass',
      description:
        'The underpass between the station and the library has been covered in graffiti over the weekend. The lighting is dim and the space feels unsafe in the evening.',
      category: 'public-property',
      status: 'Submitted',
      priority: 'Low',
      address: 'Station-to-library underpass, Northbridge (demo)',
      latitude: 40.4408,
      longitude: -79.9954,
      department: publicWorks,
      assignee: null,
      reporter: citizen2,
      createdDaysAgo: 1,
    },
    {
      title: 'Drain outside the school playground needs clearing',
      description:
        'The drain outside the school playground is blocked with leaves and plastic. Water backs up onto the pavement whenever it rains and children walk through it.',
      category: 'drainage',
      status: 'Closed',
      priority: 'Medium',
      address: 'Birch Street Primary School, Northbridge (demo)',
      latitude: 40.4365,
      longitude: -79.9901,
      department: water,
      assignee: null,
      reporter: citizen,
      createdDaysAgo: 30,
      resolutionSummary: 'Drain was cleared and the grate secured. Routine inspection added to the maintenance list.',
      feedback: { rating: 4, comment: 'Cleared promptly after review.' },
    },
    {
      title: 'Broken swing seat at Harbour playground',
      description:
        'One of the swing seats at the harbour playground has split along the edge. The swing is still in use because the chain remains attached. There is a sharp edge.',
      category: 'parks',
      status: 'Resolved',
      priority: 'High',
      address: 'Harbour Playground, Northbridge (demo)',
      latitude: 40.4451,
      longitude: -80.0034,
      department: sanitation,
      assignee: jo,
      reporter: citizen,
      createdDaysAgo: 7,
      resolutionSummary:
        'The damaged swing was removed and replaced with a spare seat. The equipment was inspected and returned to service.',
      reopenRequested: true,
      reopenNote:
        'The replacement seat is a different shape and the chain is still rubbing. Please check it again before closing the report.',
    },
  ];

  let index = 0;
  const createdReportDocs: Array<{
    report: ReportDocument;
    seed: ReportSeed;
    createdAt: Date;
    resolvedAt: Date | null;
  }> = [];

  for (const seed of seeds) {
    index += 1;
    const createdAt = daysAgo(seed.createdDaysAgo, 9 + (index % 6));
    const reportId = `CE-${now.getUTCFullYear()}-${String(index).padStart(6, '0')}`;
    const dueAt = seed.priority === 'Urgent'
      ? addBusinessHours(createdAt, 8, {
          timezone: 'UTC',
          weekdays: [1, 2, 3, 4, 5],
          startHour: 9,
          endHour: 17,
        })
      : seed.priority === 'High'
        ? addBusinessHours(createdAt, 24, {
            timezone: 'UTC',
            weekdays: [1, 2, 3, 4, 5],
            startHour: 9,
            endHour: 17,
          })
        : addBusinessHours(createdAt, 72, {
            timezone: 'UTC',
            weekdays: [1, 2, 3, 4, 5],
            startHour: 9,
            endHour: 17,
          });

    const resolvedAt = ['Resolved', 'Closed', 'Reopened'].includes(seed.status)
      ? addHours(createdAt, 30 + index)
      : null;

    const report = await Report.create({
      reportId,
      reporterId: seed.reporter._id,
      title: seed.title,
      description: seed.description,
      category: seed.category,
      priority: seed.priority,
      status: seed.status,
      location: {
        address: seed.address,
        latitude: seed.latitude,
        longitude: seed.longitude,
      },
      geo: { type: 'Point', coordinates: [seed.longitude, seed.latitude] },
      departmentId: seed.department?._id ?? null,
      assignedTo: seed.assignee?._id ?? null,
      assignedAt: seed.assignee ? addHours(createdAt, 6) : null,
      firstAssignedAt: seed.assignee ? addHours(createdAt, 6) : null,
      dueAt,
      resolutionSummary: seed.resolutionSummary ?? null,
      resolvedAt,
      closedAt: seed.status === 'Closed' ? addHours(resolvedAt ?? createdAt, 12) : null,
      reopenRequested: Boolean(seed.reopenRequested),
      reopenRequestedAt: seed.reopenRequested ? addHours(createdAt, 80) : null,
      reopenRequestNote: seed.reopenNote ?? null,
      attachmentIds: [],
      moderation: { visible: true },
      createdAt,
      updatedAt: addHours(createdAt, 1),
    });
    createdReportDocs.push({ report, seed, createdAt, resolvedAt });

    const history: Array<{
      status: ReportStatus;
      at: Date;
      actor: typeof citizen;
      visibility: 'citizen' | 'internal';
      note?: string;
      reason?: string;
    }> = [
      { status: 'Submitted', at: createdAt, actor: seed.reporter, visibility: 'citizen', note: 'Report submitted.' },
    ];

    if (seed.status !== 'Submitted') {
      history.push({
        status: 'Under Review',
        at: addHours(createdAt, 2),
        actor: seed.department === publicWorks ? roadsManager : sanitationManager,
        visibility: 'citizen',
        note: 'Report reviewed and routed for triage.',
      });
    }
    if (['Assigned', 'In Progress', 'Resolved', 'Closed', 'Reopened'].includes(seed.status)) {
      history.push({
        status: 'Assigned',
        at: addHours(createdAt, 6),
        actor: seed.department === publicWorks ? roadsManager : sanitationManager,
        visibility: 'citizen',
        note: seed.assignee ? 'Assigned to a field crew.' : 'Assigned to the responsible team.',
      });
    }
    if (['In Progress', 'Resolved', 'Closed', 'Reopened'].includes(seed.status)) {
      history.push({
        status: 'In Progress',
        at: addHours(createdAt, 20),
        actor: seed.assignee ?? jo,
        visibility: 'citizen',
        note: 'Crew has started work on site.',
      });
    }
    if (['Resolved', 'Closed', 'Reopened'].includes(seed.status)) {
      history.push({
        status: 'Resolved',
        at: resolvedAt ?? addHours(createdAt, 40),
        actor: seed.assignee ?? jo,
        visibility: 'citizen',
        note: seed.resolutionSummary ?? 'Work completed and checked.',
      });
    }
    if (seed.status === 'Closed') {
      history.push({
        status: 'Closed',
        at: addHours(resolvedAt ?? createdAt, 12),
        actor: cityAdmin,
        visibility: 'citizen',
        reason: 'Resolution accepted and the report closed.',
      });
    }
    if (seed.status === 'Rejected') {
      history.push({
        status: 'Rejected',
        at: addHours(createdAt, 8),
        actor: sanitationManager,
        visibility: 'citizen',
        reason: 'This duplicates an existing collection-route report. The route team has the active reference.',
      });
    }
    if (seed.status === 'Reopened') {
      history.push({
        status: 'Reopened',
        at: addHours(createdAt, 50),
        actor: roadsManager,
        visibility: 'citizen',
        reason: 'Citizen follow-up shows the waste has returned. Crew to revisit.',
      });
    }

    await StatusHistory.insertMany(
      history.map((entry) => ({
        reportId: report._id,
        fromStatus: null,
        toStatus: entry.status,
        actorId: entry.actor._id,
        visibility: entry.visibility,
        note: entry.note ?? null,
        reason: entry.reason ?? null,
        createdAt: entry.at,
      })),
    );

    if (seed.feedback) {
      await Feedback.create({
        reportId: report._id,
        citizenId: seed.reporter._id,
        rating: seed.feedback.rating,
        comment: seed.feedback.comment,
        createdAt: addHours(resolvedAt ?? createdAt, 14),
      });
    }

    if (index === 1) {
      await ReportComment.insertMany([
        {
          reportId: report._id,
          authorId: seed.reporter._id,
          body: 'The pothole is getting wider. A cone was placed there yesterday but it has already been knocked over.',
          visibility: 'citizen',
          createdAt: addHours(createdAt, 5),
        },
        {
          reportId: report._id,
          authorId: ali._id,
          body: 'Crew scheduled for tomorrow morning. Temporary warning board requested for tonight.',
          visibility: 'internal',
          createdAt: addHours(createdAt, 7),
        },
        {
          reportId: report._id,
          authorId: ali._id,
          body: 'We have scheduled a permanent patch for tomorrow morning. Please keep the area clear.',
          visibility: 'citizen',
          createdAt: addHours(createdAt, 8),
        },
      ]);
    }
    if (index === 5) {
      await ReportComment.create({
        reportId: report._id,
        authorId: seed.reporter._id,
        body: 'The water is still seeping this morning. I have added a photo to the report.',
        visibility: 'citizen',
        createdAt: addHours(createdAt, 15),
      });
    }
  }

  await Counter.create({ _id: `report-${now.getUTCFullYear()}`, seq: seeds.length });

  await Notification.insertMany([
    {
      userId: citizen._id,
      reportId: createdReportDocs[2].report._id,
      type: 'report_resolved' as const,
      message: `Report ${createdReportDocs[2].report.reportId} was marked resolved. Please review the resolution and share feedback.`,
      deliveryStatus: 'in_app' as const,
      dedupeKey: 'seed-notification-1',
      createdAt: new Date(now.getTime() - 3_600_000),
    },
    {
      userId: citizen2._id,
      reportId: createdReportDocs[1].report._id,
      type: 'status_changed' as const,
      message: `Report ${createdReportDocs[1].report.reportId} moved to In Progress.`,
      deliveryStatus: 'in_app' as const,
      dedupeKey: 'seed-notification-2',
      readAt: new Date(),
      createdAt: new Date(now.getTime() - 7_200_000),
    },
    {
      userId: ali._id,
      reportId: createdReportDocs[0].report._id,
      type: 'report_assigned' as const,
      message: `Assigned: report ${createdReportDocs[0].report.reportId} — ${createdReportDocs[0].report.title}`,
      deliveryStatus: 'in_app' as const,
      dedupeKey: 'seed-notification-3',
      createdAt: new Date(now.getTime() - 10_800_000),
    },
    {
      userId: roadsManager._id,
      reportId: createdReportDocs[0].report._id,
      type: 'comment_added' as const,
      message: `New citizen follow-up on report ${createdReportDocs[0].report.reportId}.`,
      deliveryStatus: 'in_app' as const,
      dedupeKey: 'seed-notification-4',
      createdAt: new Date(now.getTime() - 14_400_000),
    },
    {
      userId: cityAdmin._id,
      reportId: createdReportDocs[5].report._id,
      type: 'report_submitted' as const,
      message: `New urgent report ${createdReportDocs[5].report.reportId} needs triage.`,
      deliveryStatus: 'in_app' as const,
      dedupeKey: 'seed-notification-5',
      createdAt: new Date(now.getTime() - 18_000_000),
    },
  ]);

  await AuditLog.insertMany([
    {
      actorId: admin._id,
      actorRole: 'platform_admin',
      action: 'demo.seeded',
      entityType: 'Platform',
      entityId: 'seed',
      metadata: { reports: seeds.length, users: users.length, note: 'Fictional development data' },
    },
    {
      actorId: roadsManager._id,
      actorRole: 'department_manager',
      action: 'report.assigned',
      entityType: 'Report',
      entityId: createdReportDocs[0].report.reportId,
      metadata: { note: 'Seeded assignment history' },
    },
  ]);

  console.log('');
  console.log('CivicEye 360 development data seeded.');
  console.log(`  Categories:  ${categories.length}`);
  console.log(`  Departments: ${departments.length}`);
  console.log(`  Users:       ${users.length}`);
  console.log(`  Reports:     ${seeds.length}`);
  console.log('');
  console.log('DEVELOPMENT-ONLY DEMO ACCOUNTS (replace before any real deployment):');
  console.log(`  Password for all demo accounts: ${DEMO_PASSWORD}`);
  console.log('  admin@civiceye.local            platform administrator');
  console.log('  city.admin@civiceye.local       municipal administrator');
  console.log('  roads.manager@civiceye.local    department manager (Public Works)');
  console.log('  field.ali@civiceye.local        field staff (Public Works)');
  console.log('  field.jo@civiceye.local         field staff (Sanitation)');
  console.log('  citizen@civiceye.local          citizen');
  console.log('');

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
