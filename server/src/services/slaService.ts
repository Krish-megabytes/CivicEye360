import { SlaConfig, type SlaConfigAttrs } from '../models/SlaConfig.js';
import type { Priority } from '../domain/constants.js';
import { addBusinessHours } from '../lib/sla.js';

/**
 * Selects the most specific active SLA configuration for a category/priority.
 * Specificity: exact category + priority > category + any > any + priority > any.
 */
export async function resolveSlaConfig(
  category: string,
  priority: Priority,
): Promise<SlaConfigAttrs | null> {
  const candidates = await SlaConfig.find({
    active: true,
    category: { $in: [category, '*'] },
    priority: { $in: [priority, '*'] },
  }).lean();

  const score = (candidate: SlaConfigAttrs) =>
    (candidate.category === category ? 2 : 0) + (candidate.priority === priority ? 1 : 0);

  const best = candidates.sort((a, b) => score(b) - score(a))[0];
  return best ?? null;
}

export async function slaConfigsExist(): Promise<boolean> {
  return (await SlaConfig.countDocuments({ active: true })) > 0;
}

export async function computeDueAt(
  category: string,
  priority: Priority,
  from: Date = new Date(),
): Promise<Date | null> {
  const config = await resolveSlaConfig(category, priority);
  if (!config) return null;
  return addBusinessHours(from, config.targetHours, config.businessCalendar);
}
