import type { AuthUser } from '../types/auth.js';
import { Report } from '../models/Report.js';
import { getAuthorizedReport } from './reportService.js';
import { similarity } from './aiService.js';
import type { LeanReport } from './reportSerializer.js';

interface HintInput {
  reportId?: string;
  title?: string;
  description?: string;
  category?: string;
  latitude?: number | null;
  longitude?: number | null;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
}

/**
 * Rules-based duplicate candidates. Results are advisory only; nothing is
 * merged or closed automatically and other reporters' identities are never
 * included.
 */
export async function findDuplicateHints(actor: AuthUser, input: HintInput) {
  let base: LeanReport | null = null;
  if (input.reportId) {
    base = await getAuthorizedReport(input.reportId, actor);
  }

  const category = base?.category ?? input.category ?? null;
  const title = base?.title ?? input.title ?? '';
  const description = base?.description ?? input.description ?? '';
  const latitude = base?.location.latitude ?? input.latitude ?? null;
  const longitude = base?.location.longitude ?? input.longitude ?? null;

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const filter: Record<string, unknown> = {
    createdAt: { $gte: since },
    status: { $nin: ['Rejected'] },
  };
  if (base) filter._id = { $ne: base._id };
  if (category) filter.category = category;

  let candidates = await Report.find(filter)
    .select('reportId title description category status priority location createdAt')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  if (candidates.length === 0 && category) {
    candidates = await Report.find({
      ...(base ? { _id: { $ne: base._id } } : {}),
      createdAt: { $gte: since },
      status: { $nin: ['Rejected'] },
    })
      .select('reportId title description category status priority location createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
  }

  const hints = candidates
    .map((candidate) => {
      const textScore = similarity(
        `${title} ${description}`,
        `${candidate.title} ${candidate.description}`,
      );
      const categoryMatch = candidate.category === category ? 0.3 : 0;
      let distance: number | null = null;
      let proximityScore = 0;
      if (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        typeof candidate.location.latitude === 'number' &&
        typeof candidate.location.longitude === 'number'
      ) {
        distance = haversineMeters(
          latitude,
          longitude,
          candidate.location.latitude,
          candidate.location.longitude,
        );
        proximityScore = Math.max(0, 1 - distance / 750) * 0.2;
        if (distance > 750 && categoryMatch === 0) return null;
      }
      const score = categoryMatch + textScore * 0.5 + proximityScore;
      return {
        score,
        distance,
        report: candidate,
      };
    })
    .filter((entry): entry is { score: number; distance: number | null; report: typeof candidates[number] } => Boolean(entry))
    .filter((entry) => entry.score >= 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    method: 'rules-based' as const,
    aiConfigured: false,
    note: 'Potential matches are advisory. Review them manually; CivicEye 360 never merges, closes or rejects reports automatically.',
    hints: hints.map((hint) => ({
      reportId: hint.report.reportId,
      title: hint.report.title,
      category: hint.report.category,
      status: hint.report.status,
      priority: hint.report.priority,
      address: hint.report.location.address,
      createdAt: hint.report.createdAt,
      distanceMeters: hint.distance === null ? null : Math.round(hint.distance),
      matchScore: Math.round(hint.score * 100),
    })),
  };
}
