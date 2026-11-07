import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { Category } from '../models/Category.js';
import { Report } from '../models/Report.js';
import { StatusHistory } from '../models/StatusHistory.js';
import { databaseState } from '../lib/db.js';
import { verifyTrackingCode } from '../auth/tokens.js';
import { notFound } from '../lib/errors.js';
import { emailConfigured } from '../services/emailService.js';
import { slaConfigsExist } from '../services/slaService.js';

export async function health(_req: Request, res: Response): Promise<void> {
  const state = databaseState();
  res.status(state === 'connected' ? 200 : 503).json({
    status: state === 'connected' ? 'ok' : 'degraded',
    database: state,
    version: env.version,
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    services: {
      ai: env.openai.configured ? 'configured' : 'rules-fallback',
      email: emailConfigured() ? 'configured' : 'not-configured',
    },
    timezone: 'UTC',
    timestamp: new Date().toISOString(),
  });
}

export async function categories(_req: Request, res: Response): Promise<void> {
  const rows = await Category.find({ active: true })
    .select('slug label description sortOrder')
    .sort({ sortOrder: 1, label: 1 })
    .lean();
  res.json({
    data: rows.map((row) => ({
      slug: row.slug,
      label: row.label,
      description: row.description,
    })),
  });
}

export async function publicConfig(_req: Request, res: Response): Promise<void> {
  res.json({
    data: {
      aiConfigured: env.openai.configured,
      emailConfigured: emailConfigured(),
      slaConfigured: await slaConfigsExist(),
      uploads: { maxMb: env.uploads.maxMb },
      maps: {
        provider: 'OpenStreetMap',
        requiresKey: false,
        note: 'Tile provider can be replaced with VITE_MAP_TILE_URL. Manual address entry always remains available.',
      },
      environment: env.nodeEnv,
      demoMode: !env.openai.configured || !emailConfigured(),
    },
  });
}

export async function track(req: Request, res: Response): Promise<void> {
  const { reportId, trackingCode } = req.body as { reportId: string; trackingCode: string };
  const codeValid = verifyTrackingCode(reportId, trackingCode);
  const report = await Report.findOne({ reportId }).lean();
  if (!report || !codeValid || report.moderation?.visible === false) {
    throw notFound('Report not found, or the reference and tracking code did not match.');
  }

  const history = await StatusHistory.find({ reportId: report._id, visibility: 'citizen' })
    .select('toStatus note reason createdAt')
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    data: {
      reportId: report.reportId,
      title: report.title,
      category: report.category,
      status: report.status,
      priority: report.priority,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      dueAt: report.dueAt ?? null,
      resolvedAt: report.resolvedAt ?? null,
      resolutionSummary: report.resolutionSummary ?? null,
      timeline: history.map((entry) => ({
        toStatus: entry.toStatus,
        note: entry.note ?? null,
        reason: entry.reason ?? null,
        createdAt: entry.createdAt,
      })),
      privacyNote:
        'Guest tracking shows status updates only. Sign in to view addresses, attachments and your full report.',
    },
  });
}
