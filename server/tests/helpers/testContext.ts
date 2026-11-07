import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

export type TestAgent = ReturnType<typeof request.agent>;
import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/auth/passwords.js';
import { User } from '../../src/models/User.js';
import { Category } from '../../src/models/Category.js';
import { Department } from '../../src/models/Department.js';
import { RoutingRule } from '../../src/models/RoutingRule.js';
import { SlaConfig } from '../../src/models/SlaConfig.js';
import { DEFAULT_CATEGORIES, type Role } from '../../src/domain/constants.js';

export const CSRF = { 'X-Requested-With': 'CivicEye360' };
export const TEST_PASSWORD = 'TestPassword123';

let mongo: MongoMemoryServer | null = null;

export const app = createApp();

function localMongoBinary(): string | undefined {
  if (process.env.MONGOMS_SYSTEM_BINARY) return process.env.MONGOMS_SYSTEM_BINARY;
  const candidates = [
    path.resolve(process.cwd(), '../.data/mongodb/bin/mongod.exe'),
    path.resolve(process.cwd(), '../.data/mongodb/bin/mongod'),
    path.resolve(process.cwd(), '.data/mongodb/bin/mongod.exe'),
  ];
  return candidates.find((candidate) => fsSync.existsSync(candidate));
}

export async function startTestContext(): Promise<void> {
  const systemBinary = localMongoBinary();
  mongo = await MongoMemoryServer.create({
    ...(systemBinary ? { binary: { systemBinary } } : { binary: { version: '7.0.14' } }),
  });
  await mongoose.connect(mongo.getUri('civiceye_test'));
}

export async function stopTestContext(): Promise<void> {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
  await fs.rm(path.resolve(process.cwd(), 'test-uploads'), { recursive: true, force: true });
}

export async function clearDatabase(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export interface ReferenceData {
  publicWorks: { id: string; name: string };
  sanitation: { id: string; name: string };
  categories: Array<{ slug: string; label: string }>;
}

export async function seedReferenceData(): Promise<ReferenceData> {
  await Category.insertMany(
    DEFAULT_CATEGORIES.map((category, index) => ({
      ...category,
      active: true,
      sortOrder: index * 10,
    })),
  );
  const [publicWorks, sanitation] = await Department.insertMany([
    {
      name: 'Public Works',
      description: 'Roads and lighting',
      supportedCategories: ['roads', 'streetlights', 'traffic-signs'],
      active: true,
      memberIds: [],
    },
    {
      name: 'Sanitation',
      description: 'Waste services',
      supportedCategories: ['waste'],
      active: true,
      memberIds: [],
    },
  ]);
  await RoutingRule.insertMany([
    { category: 'roads', departmentId: publicWorks._id, active: true },
    { category: 'waste', departmentId: sanitation._id, active: true },
  ]);
  await SlaConfig.create({
    category: '*',
    priority: 'High',
    targetHours: 8,
    active: true,
    businessCalendar: {
      timezone: 'UTC',
      weekdays: [1, 2, 3, 4, 5],
      startHour: 9,
      endHour: 17,
    },
  });
  return {
    publicWorks: { id: String(publicWorks._id), name: publicWorks.name },
    sanitation: { id: String(sanitation._id), name: sanitation.name },
    categories: DEFAULT_CATEGORIES.map((category) => ({
      slug: category.slug,
      label: category.label,
    })),
  };
}

export async function createUser(options: {
  email: string;
  name?: string;
  role?: Role;
  departmentIds?: string[];
  active?: boolean;
}): Promise<{ id: string; email: string; name: string; role: Role }> {
  const user = await User.create({
    name: options.name ?? options.email.split('@')[0],
    email: options.email,
    passwordHash: await hashPassword(TEST_PASSWORD),
    role: options.role ?? 'citizen',
    departmentIds: options.departmentIds ?? [],
    notificationPreferences: { inApp: true, email: false },
    active: options.active ?? true,
    tokenVersion: 0,
  });
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function login(email: string): Promise<TestAgent> {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/login')
    .set(CSRF)
    .send({ email, password: TEST_PASSWORD });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return agent;
}

/** Fetch the CSRF-verified cookie session for a frontend-style flow. */
export async function registerCitizen(
  email: string,
  password = TEST_PASSWORD,
): Promise<TestAgent> {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/register')
    .set(CSRF)
    .send({ name: 'Test Citizen', email, password });
  if (response.status !== 201) {
    throw new Error(`Register failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return agent;
}

export const validReport = {
  title: 'Large pothole beside the library',
  description:
    'A wide pothole has formed next to the library crossing and vehicles are swerving around it every morning.',
  category: 'roads',
  location: {
    address: '12 Civic Row, Northbridge',
    latitude: 40.4435,
    longitude: -79.998,
  },
};
