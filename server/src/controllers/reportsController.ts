import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createReport,
  getAuthorizedReport,
  getReportDetail,
  listReports,
  normalizedCreateInput,
  reportSummary,
} from '../services/reportService.js';
import {
  addComment,
  assignReport,
  changeReportCategory,
  changeReportPriority,
  moderateReport,
  requestReopen,
  submitFeedback,
  updateReportStatus,
} from '../services/reportWorkflowService.js';
import { saveReportAttachment } from '../services/storageService.js';
import {
  createReportSchema,
  listQuerySchema,
  uploadSchema,
} from '../validation/schemas.js';
import { query } from '../middleware/validate.js';
import { unprocessable } from '../lib/errors.js';
import { toReportFilters } from '../lib/reportFilters.js';
import type { Priority, ReportStatus } from '../domain/constants.js';

type ListQuery = z.infer<typeof listQuerySchema>;

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof createReportSchema>;
  const report = await createReport(req.user!, normalizedCreateInput(input), req);
  const detail = await getReportDetail(report, req.user!);
  res.status(201).json({ data: detail });
}

export async function list(req: Request, res: Response): Promise<void> {
  const result = await listReports(req.user!, toReportFilters(query<ListQuery>(res)));
  res.json({ data: result.data, pagination: result.pagination });
}

export async function myReports(req: Request, res: Response): Promise<void> {
  const result = await listReports(req.user!, toReportFilters(query<ListQuery>(res)));
  res.json({ data: result.data, pagination: result.pagination });
}

export async function summary(req: Request, res: Response): Promise<void> {
  res.json({ data: await reportSummary(req.user!) });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const report = await getAuthorizedReport(req.params.reportId as string, req.user!);
  res.json({ data: await getReportDetail(report, req.user!) });
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const input = req.body as {
    status: ReportStatus;
    reason?: string;
    note?: string;
    resolutionSummary?: string;
  };
  const result = await updateReportStatus(req.user!, req.params.reportId as string, input, req);
  res.json({ data: result });
}

export async function resolve(req: Request, res: Response): Promise<void> {
  const input = req.body as { resolutionSummary: string; note?: string };
  const result = await updateReportStatus(
    req.user!,
    req.params.reportId as string,
    {
      status: 'Resolved',
      resolutionSummary: input.resolutionSummary,
      note: input.note,
    },
    req,
  );
  res.json({ data: result });
}

export async function assign(req: Request, res: Response): Promise<void> {
  const result = await assignReport(
    req.user!,
    req.params.reportId as string,
    req.body as never,
    req,
  );
  res.json({ data: result });
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const result = await changeReportCategory(
    req.user!,
    req.params.reportId as string,
    (req.body as { category: string }).category,
    req,
  );
  res.json({ data: result });
}

export async function updatePriority(req: Request, res: Response): Promise<void> {
  const result = await changeReportPriority(
    req.user!,
    req.params.reportId as string,
    (req.body as { priority: Priority }).priority,
    req,
  );
  res.json({ data: result });
}

export async function moderate(req: Request, res: Response): Promise<void> {
  const result = await moderateReport(
    req.user!,
    req.params.reportId as string,
    req.body as never,
    req,
  );
  res.json({ data: result });
}

export async function comment(req: Request, res: Response): Promise<void> {
  const result = await addComment(
    req.user!,
    req.params.reportId as string,
    req.body as never,
    req,
  );
  res.status(201).json({ data: result });
}

export async function feedback(req: Request, res: Response): Promise<void> {
  const result = await submitFeedback(
    req.user!,
    req.params.reportId as string,
    req.body as never,
    req,
  );
  res.status(201).json({ data: result });
}

export async function reopenRequest(req: Request, res: Response): Promise<void> {
  const result = await requestReopen(
    req.user!,
    req.params.reportId as string,
    (req.body as { note: string }).note,
    req,
  );
  res.json({ data: result });
}

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  if (!req.file) throw unprocessable('Choose an image to upload.');
  const parsed = uploadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw unprocessable(
      'Invalid upload options.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    );
  }
  const report = await getAuthorizedReport(req.params.reportId as string, req.user!);
  const attachment = await saveReportAttachment({
    actor: req.user!,
    report,
    file: req.file,
    visibility: parsed.data.visibility,
    req,
  });
  res.status(201).json({
    data: {
      id: String(attachment._id),
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      visibility: attachment.visibility,
      url: `/api/attachments/${String(attachment._id)}`,
      createdAt: attachment.createdAt,
    },
  });
}
