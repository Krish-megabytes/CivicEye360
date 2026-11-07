import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { NGOTask } from '../models/NGOTask.js';
import { Attachment } from '../models/Attachment.js';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import { saveReportAttachment } from '../services/storageService.js';
import { audit } from '../services/auditService.js';

const OPEN = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Reopened'];
type ReportRow = { _id: mongoose.Types.ObjectId; reportId: string; title: string; category: string; description: string; location: { address: string }; priority: string; createdAt: Date };
function pointsFor(priority: string): number { return priority === 'Urgent' ? 100 : priority === 'High' ? 75 : priority === 'Medium' ? 50 : 25; }

function taskView(task: any) {
  return {
    id: String(task._id),
    reportId: task.report?.reportId ?? String(task.reportId),
    title: task.report?.title ?? '',
    category: task.report?.category ?? '',
    description: task.report?.description ?? '',
    address: task.report?.location?.address ?? '',
    priority: task.report?.priority ?? 'Medium',
    status: task.status,
    summary: task.summary,
    points: task.points,
    suggestedPoints: task.suggestedPoints,
    evidenceIds: (task.evidenceIds ?? []).map(String),
    evidence: (task.evidence ?? []).map((a: any) => ({ id: String(a._id), name: a.originalName, url: `/api/attachments/${a._id}` })),
    ngo: task.ngo ? { id: String(task.ngo._id), name: task.ngo.name } : undefined,
    feedback: task.feedback,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function leaderboardPipeline(): mongoose.PipelineStage[] {
  return [
    { $match: { status: 'approved' } },
    { $group: { _id: '$ngoId', completedTasks: { $sum: 1 }, points: { $sum: '$points' } } },
    { $sort: { points: -1, completedTasks: -1 } },
    { $limit: 100 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.active': true, 'user.role': 'ngo' } },
    { $project: { _id: 0, ngoId: { $toString: '$_id' }, name: '$user.name', completedTasks: 1, points: 1 } },
  ];
}

export async function ngoTasks(req: Request, res: Response): Promise<void> {
  if (req.user!.role !== 'ngo') throw forbidden();
  const openReports = await Report.find({ status: { $in: OPEN }, 'moderation.visible': true } as any).select('reportId title category description location priority createdAt').sort({ createdAt: -1 }).limit(200).lean() as unknown as ReportRow[];
  const assigned = await NGOTask.find({ ngoId: req.user!.id }).populate('reportId', 'reportId title category description location status priority createdAt').sort({ updatedAt: -1 }).lean() as unknown as Array<Record<string, any>>;
  const claimedIds = new Set(assigned.map((task) => String(task.reportId?._id ?? task.reportId)));
  const mine = await Promise.all(assigned.map(async (task) => {
    const evidence = await Attachment.find({ _id: { $in: task.evidenceIds }, uploadedBy: req.user!.id }).select('originalName createdAt').sort({ createdAt: 1 }).lean();
    return taskView({ ...task, report: task.reportId, evidence });
  }));
  const available = openReports
    .filter((report) => !claimedIds.has(String(report._id)))
    .map((report) => ({ id: String(report._id), reportId: report.reportId, title: report.title, category: report.category, description: report.description, address: report.location.address, priority: report.priority, suggestedPoints: pointsFor(report.priority), createdAt: report.createdAt }));

  const ranked = await NGOTask.aggregate(leaderboardPipeline());
  const rankIndex = ranked.findIndex((entry) => entry.ngoId === req.user!.id);
  const stats = {
    ngoId: req.user!.id,
    points: mine.filter((task) => task.status === 'approved').reduce((sum, task) => sum + (task.points || 0), 0),
    completedTasks: mine.filter((task) => task.status === 'approved').length,
    activeTasks: mine.filter((task) => task.status === 'claimed').length,
    pendingReview: mine.filter((task) => task.status === 'submitted').length,
    needsCorrections: mine.filter((task) => task.status === 'rejected').length,
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    rankedNgos: ranked.length,
  };

  res.json({ data: { available, mine, stats } });
}

export async function ngoClaim(req: Request, res: Response): Promise<void> {
  if (req.user!.role !== 'ngo') throw forbidden();
  const report = await Report.findOne({ reportId: req.body.reportId, status: { $in: OPEN }, 'moderation.visible': true } as any);
  if (!report) throw notFound('This task is no longer available.');
  try {
    const suggestedPoints = pointsFor(String(report.get('priority')));
    const task = await NGOTask.create({ reportId: report.get('_id'), ngoId: req.user!.id, suggestedPoints });
    await audit({ actorId: req.user!.id, actorRole: 'ngo', action: 'ngo.task_claimed', entityType: 'Report', entityId: String(report.get('reportId')), req });
    res.status(201).json({ data: { id: String(task._id), reportId: String(report.get('reportId')), status: task.status, suggestedPoints } });
  } catch (error) { if ((error as { code?: number }).code === 11000) throw conflict('Another NGO has already claimed this task.'); throw error; }
}

export async function ngoRelease(req: Request, res: Response): Promise<void> {
  if (req.user!.role !== 'ngo') throw forbidden();
  const task = await NGOTask.findOne({ _id: req.params.taskId, ngoId: req.user!.id, status: 'claimed' });
  if (!task) throw notFound('Only a claimed task awaiting work can be released.');
  if (task.evidenceIds.length) throw conflict('Evidence photos are already attached. Submit the task for review instead.');
  await NGOTask.deleteOne({ _id: task._id, status: 'claimed' });
  await audit({ actorId: req.user!.id, actorRole: 'ngo', action: 'ngo.task_released', entityType: 'NGOTask', entityId: String(task._id), req });
  res.json({ data: { id: String(task._id), status: 'available' } });
}

export async function ngoUpload(req: Request, res: Response): Promise<void> {
  if (req.user!.role !== 'ngo') throw forbidden();
  const task = await NGOTask.findOne({ _id: req.params.taskId, ngoId: req.user!.id, status: { $in: ['claimed', 'rejected'] } });
  if (!task) throw notFound('Active task not found.');
  if (!req.file) throw unprocessable('Choose an image to upload.');
  const report = await Report.findById(task.reportId).lean();
  if (!report) throw notFound('Task not found.');
  if (task.evidenceIds.length >= 8) throw conflict('A task can have at most 8 evidence photos.');
  const attachment = await saveReportAttachment({ actor: req.user!, report, file: req.file, visibility: 'internal', req });
  task.evidenceIds.push(attachment._id); await task.save();
  res.status(201).json({ data: { id: String(attachment._id), url: `/api/attachments/${String(attachment._id)}` } });
}

export async function ngoSubmit(req: Request, res: Response): Promise<void> {
  if (req.user!.role !== 'ngo') throw forbidden();
  const task = await NGOTask.findOne({ _id: req.params.taskId, ngoId: req.user!.id, status: { $in: ['claimed', 'rejected'] } });
  if (!task) throw notFound('Active task not found.');
  if (!task.evidenceIds.length) throw unprocessable('Upload at least one evidence photo before submitting.');
  task.summary = req.body.summary; task.status = 'submitted'; await task.save();
  await audit({ actorId: req.user!.id, actorRole: 'ngo', action: 'ngo.task_submitted', entityType: 'NGOTask', entityId: String(task._id), req });
  res.json({ data: { id: String(task._id), status: task.status } });
}

export async function reviewTasks(req: Request, res: Response): Promise<void> {
  if (!['municipal_admin', 'platform_admin'].includes(req.user!.role)) throw forbidden();
  const tasks = await NGOTask.find({ status: 'submitted' }).sort({ updatedAt: 1 }).lean();
  const data = await Promise.all(tasks.map(async (task) => {
    const [report, ngo, evidence] = await Promise.all([Report.findById(task.reportId).select('reportId title category description location priority').lean(), User.findById(task.ngoId).select('name').lean(), Attachment.find({ _id: { $in: task.evidenceIds }, uploadedBy: task.ngoId }).select('originalName createdAt').sort({ createdAt: 1 }).lean()]);
    return taskView({ ...task, report, ngo, evidence });
  }));
  res.json({ data });
}

export async function reviewTask(req: Request, res: Response): Promise<void> {
  if (!['municipal_admin', 'platform_admin'].includes(req.user!.role)) throw forbidden();
  const task = await NGOTask.findOne({ _id: req.params.taskId, status: 'submitted' });
  if (!task) throw notFound('Submitted task not found.');
  if (req.body.approved && !task.evidenceIds.length) throw unprocessable('Task has no evidence photos.');
  const points = req.body.approved ? (req.body.points ?? task.suggestedPoints) : 0;
  const status = req.body.approved ? 'approved' : 'rejected';
  const result = await NGOTask.updateOne({ _id: task._id, status: 'submitted' }, { $set: { status, points, feedback: req.body.feedback ?? null, reviewedBy: new mongoose.Types.ObjectId(req.user!.id), reviewedAt: new Date() } });
  if (!result.modifiedCount) throw conflict('This submission was already reviewed. Refresh the queue.');
  await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: req.body.approved ? 'ngo.task_approved' : 'ngo.task_rejected', entityType: 'NGOTask', entityId: String(task._id), metadata: { points }, req });
  res.json({ data: { id: String(task._id), status, points } });
}

export async function leaderboard(req: Request, res: Response): Promise<void> {
  if (!['ngo', 'municipal_admin', 'platform_admin'].includes(req.user!.role)) throw forbidden();
  const entries = await NGOTask.aggregate(leaderboardPipeline());
  res.json({ data: entries });
}
