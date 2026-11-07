import type { Request, Response } from 'express';
import { classifyReport, summarizeReport } from '../services/aiService.js';
import { findDuplicateHints } from '../services/duplicateService.js';
import { getAuthorizedReport, managerCoversReport } from '../services/reportService.js';
import { StatusHistory } from '../models/StatusHistory.js';
import { forbidden } from '../lib/errors.js';

export async function classify(req: Request, res: Response): Promise<void> {
  const { title, description } = req.body as { title: string; description: string };
  const result = await classifyReport({ title, description });
  res.json({
    data: {
      ...result,
      disclaimer:
        'AI and rules-based suggestions are advisory. Review the category and priority before submission or triage.',
    },
  });
}

export async function duplicateHints(req: Request, res: Response): Promise<void> {
  const result = await findDuplicateHints(req.user!, req.body as never);
  res.json({ data: result });
}

export async function summarize(req: Request, res: Response): Promise<void> {
  const { reportId } = req.body as { reportId: string };
  const report = await getAuthorizedReport(reportId, req.user!);
  if (!managerCoversReport(report, req.user!)) throw forbidden();

  const history = await StatusHistory.find({
    reportId: report._id,
    visibility: 'citizen',
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .select('toStatus note reason createdAt')
    .lean();

  const result = await summarizeReport({
    title: report.title,
    description: report.description,
    history: history.map(
      (entry) =>
        `${new Date(entry.createdAt).toISOString()} ${entry.toStatus}${entry.note ? `: ${entry.note}` : ''}`,
    ),
  });
  res.json({ data: { ...result, disclaimer: 'Summary generated from stored report text. Verify before acting.' } });
}
