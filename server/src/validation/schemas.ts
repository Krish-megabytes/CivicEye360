import { z } from 'zod';
import {
  PRIORITIES,
  REPORT_STATUSES,
  ROLES,
  VISIBILITIES,
  type Priority,
  type ReportStatus,
} from '../domain/constants.js';
import { checkPasswordPolicy } from '../auth/passwords.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Select a valid record.');
const slug = z.string().trim().min(1).max(48).regex(/^[a-z0-9-]+$/, 'Invalid category.');
const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);

const password = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'Use 128 characters or fewer.')
  .superRefine((value, ctx) => {
    const check = checkPasswordPolicy(value);
    for (const problem of check.problems) {
      if (problem !== 'Use at least 10 characters.' && problem !== 'Use 128 characters or fewer.') {
        ctx.addIssue({ code: 'custom', message: problem });
      }
    }
  });

const optionalDate = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

const optionalTrimmed = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const csvStatuses = z
  .string()
  .optional()
  .transform((value) =>
    value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(REPORT_STATUSES)).max(8).optional());

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  email,
  password,
});

export const ngoRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Enter your organization name.').max(80),
  email,
  password,
}).strict();

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f\d]{64}$/i, 'This reset link is invalid.'),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    notificationPreferences: z
      .object({
        inApp: z.boolean().optional(),
        email: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'No changes supplied.');

export const listQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: csvStatuses,
  category: slug.optional(),
  priority: z.enum(PRIORITIES).optional(),
  departmentId: objectId.optional(),
  assigneeId: objectId.optional(),
  unassigned: z.enum(['true', 'false']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  from: optionalDate,
  to: optionalDate,
  sort: z.enum(['createdAt', 'updatedAt', 'dueAt', 'reportId']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const publicListQuerySchema = z.object({
  status: csvStatuses,
  category: slug.optional(),
  priority: z.enum(PRIORITIES).optional(),
  departmentId: objectId.optional(),
  assigneeId: objectId.optional(),
  unassigned: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(80).optional(),
  from: optionalDate,
  to: optionalDate,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createReportSchema = z
  .object({
    title: z.string().trim().min(5, 'Add a short title.').max(140),
    description: z
      .string()
      .trim()
      .min(20, 'Describe the issue in at least 20 characters.')
      .max(5000),
    category: slug,
    location: z.object({
      address: z.string().trim().min(5, 'Add an address or landmark.').max(240),
      latitude: z.number().min(-90).max(90).nullable().optional(),
      longitude: z.number().min(-180).max(180).nullable().optional(),
    }),
    aiSuggestion: z
      .object({
        suggestedCategory: slug.optional().nullable(),
        suggestedPriority: z.enum(PRIORITIES).optional().nullable(),
        rationale: z.string().max(500).optional().nullable(),
        source: z.enum(['openai', 'rules']).optional().nullable(),
        confidence: z.number().min(0).max(1).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    const hasLat = typeof value.location.latitude === 'number';
    const hasLng = typeof value.location.longitude === 'number';
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        path: ['location'],
        message: 'Provide both latitude and longitude, or neither.',
      });
    }
  });

export const statusUpdateSchema = z.object({
  status: z.enum(REPORT_STATUSES),
  reason: optionalTrimmed(1000),
  note: optionalTrimmed(2000),
  resolutionSummary: optionalTrimmed(3000),
});

export const resolutionSchema = z.object({
  resolutionSummary: z
    .string()
    .trim()
    .min(10, 'Add a resolution summary of at least 10 characters.')
    .max(3000),
  note: optionalTrimmed(2000),
});

export const assignmentSchema = z.object({
  assigneeId: objectId,
  departmentId: objectId.optional().nullable(),
  reason: optionalTrimmed(1000),
});

export const categoryUpdateSchema = z.object({ category: slug });
export const priorityUpdateSchema = z.object({ priority: z.enum(PRIORITIES) });

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment.').max(2000),
  visibility: z.enum(VISIBILITIES).default('citizen'),
  requestInformation: z.boolean().optional(),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: optionalTrimmed(1000),
});

export const reopenSchema = z.object({
  note: z.string().trim().min(10, 'Explain why the issue is not resolved.').max(1000),
});

export const moderationSchema = z.object({
  visible: z.boolean(),
  reason: optionalTrimmed(500),
});

export const uploadSchema = z.object({
  visibility: z.enum(VISIBILITIES).default('citizen'),
});

export const ngoClaimSchema = z.object({ reportId: z.string().trim().min(1).max(40) });
export const ngoSubmitSchema = z.object({
  summary: z.string().trim().min(10).max(2000),
});
export const ngoReviewSchema = z.object({
  approved: z.boolean(),
  points: z.number().int().min(0).max(1000).optional(),
  feedback: optionalTrimmed(1000),
});

export const classifySchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(4000),
});

export const duplicateHintSchema = z
  .object({
    reportId: z.string().trim().min(3).max(40).optional(),
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(5).max(4000).optional(),
    category: slug.optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((value) => Boolean(value.reportId) || Boolean(value.title && value.description), {
    message: 'Provide a report ID or draft title and description.',
  });

export const summarizeSchema = z.object({ reportId: z.string().trim().min(3).max(40) });

export const trackSchema = z.object({
  reportId: z
    .string()
    .trim()
    .regex(/^CE-\d{4}-\d{6}$/i, 'Enter a valid report reference.'),
  trackingCode: z.string().trim().min(8, 'Enter the tracking code.').max(40),
});

export const notificationPreferencesSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).optional().default(''),
  supportedCategories: z.array(slug).max(20).optional().default([]),
  active: z.boolean().optional().default(true),
});

export const categoryAdminSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens.'),
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().default(''),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(999).optional().default(100),
});

export const routingRuleSchema = z.object({
  category: slug,
  departmentId: objectId,
  active: z.boolean().optional().default(true),
});

export const slaSchema = z
  .object({
    category: z.union([slug, z.literal('*')]),
    priority: z.union([z.enum(PRIORITIES), z.literal('*')]),
    targetHours: z.number().min(1).max(2160),
    active: z.boolean().optional().default(true),
    businessCalendar: z
      .object({
        timezone: z.string().min(1).max(80),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        startHour: z.number().int().min(0).max(23),
        endHour: z.number().int().min(1).max(24),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.businessCalendar) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value.businessCalendar.timezone });
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['businessCalendar', 'timezone'],
          message: 'Unknown timezone.',
        });
      }
      if (value.businessCalendar.endHour <= value.businessCalendar.startHour) {
        ctx.addIssue({
          code: 'custom',
          path: ['businessCalendar'],
          message: 'End hour must be after start hour.',
        });
      }
      if (new Set(value.businessCalendar.weekdays).size !== value.businessCalendar.weekdays.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['businessCalendar', 'weekdays'],
          message: 'Weekdays must be unique.',
        });
      }
    }
  });

export const userAdminSchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  departmentIds: z.array(objectId).max(10).optional(),
  name: z.string().trim().min(2).max(80).optional(),
});

export const adminUserCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password,
  role: z.enum(ROLES),
  departmentIds: z.array(objectId).max(10).optional().default([]),
});

export const departmentUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(400).optional(),
  supportedCategories: z.array(slug).max(20).optional(),
  active: z.boolean().optional(),
});

export const categoryUpdateSchemaAdmin = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens.')
    .optional(),
  label: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(240).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const routingRuleUpdateSchema = z.object({
  departmentId: objectId.optional(),
  active: z.boolean().optional(),
});

export const slaUpdateSchema = slaSchema;

export const userListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(ROLES).optional(),
  departmentId: objectId.optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const auditQuerySchema = z.object({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(120).optional(),
  from: optionalDate,
  to: optionalDate,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const analyticsQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
});

export const mapQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
  status: csvStatuses,
  category: slug.optional(),
  priority: z.enum(PRIORITIES).optional(),
});

export const notificationQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const staffQuerySchema = z.object({
  departmentId: objectId.optional(),
});

export type ReportStatusInput = ReportStatus;
export type PriorityInput = Priority;
