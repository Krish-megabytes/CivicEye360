import type { ReportStatus } from './types';

export const STATUS_DEFINITIONS: Array<{
  status: ReportStatus;
  meaning: string;
  whoActs: string;
}> = [
  {
    status: 'Submitted',
    meaning: 'The report is stored and a reference number has been created.',
    whoActs: 'Citizen',
  },
  {
    status: 'Under Review',
    meaning: 'Staff check the category, location, priority and possible duplicates.',
    whoActs: 'Triage team',
  },
  {
    status: 'Assigned',
    meaning: 'A responsible department and field team have been assigned.',
    whoActs: 'Department manager or administrator',
  },
  {
    status: 'In Progress',
    meaning: 'Work has started. Public updates and evidence can be added as it progresses.',
    whoActs: 'Field staff',
  },
  {
    status: 'Resolved',
    meaning: 'Work is complete and a resolution summary has been recorded.',
    whoActs: 'Field staff with review by a manager',
  },
  {
    status: 'Closed',
    meaning: 'The report has been accepted as complete and formally closed.',
    whoActs: 'Manager or administrator',
  },
  {
    status: 'Rejected',
    meaning: 'The report is outside the service scope or is a duplicate. A reason is retained.',
    whoActs: 'Triage team',
  },
  {
    status: 'Reopened',
    meaning: 'A resolved or closed report is under review again after new information.',
    whoActs: 'Manager or administrator',
  },
];

export const FAQS = [
  {
    question: 'Is this an emergency service?',
    answer:
      'No. CivicEye 360 is for non-emergency civic issues. If there is immediate danger, a gas leak, a live electrical hazard, a fire or a medical emergency, contact your local emergency service directly.',
  },
  {
    question: 'What happens after I submit a report?',
    answer:
      'Your report receives a reference number and enters the Submitted queue. A person reviews it, may ask for more information, routes it to the responsible department and assigns field staff. Every status change is recorded with the actor and time.',
  },
  {
    question: 'Can I track a report without an account?',
    answer:
      'If guest tracking is enabled, you need both the public reference (for example CE-2026-000042) and the secure tracking code shown when the report was created. The reference alone is never enough to view a report.',
  },
  {
    question: 'Does AI decide what happens to my report?',
    answer:
      'No. AI or rules-based assistance may suggest a category, priority or summary. A person confirms the category, makes the priority decision and controls every workflow action. AI failures do not block reporting or resolution.',
  },
  {
    question: 'Can I add a photo or more details later?',
    answer:
      'While the report is open, you can add permitted follow-up comments and a small number of JPEG, PNG or WebP images. File type and size are validated, and every attachment is access-controlled.',
  },
  {
    question: 'Why can’t I see internal notes?',
    answer:
      'Staff use internal notes for operational coordination. Those notes, private contact details and internal evidence are hidden from citizen views. Public updates and resolution summaries are visible when they are recorded.',
  },
  {
    question: 'What does “expected service target” mean?',
    answer:
      'If the operating organization has configured a service-level target for a category and priority, the report may show a due date. If no target is configured, CivicEye 360 does not invent or promise one.',
  },
  {
    question: 'How do I dispute a resolution?',
    answer:
      'On a resolved or closed report, you can request a reopening review and explain what is still wrong. A staff member reviews the request. The report is not automatically reopened.',
  },
];

export const CATEGORY_FALLBACKS = [
  { slug: 'roads', label: 'Roads & Potholes', description: 'Road surface damage, potholes and unsafe paving.' },
  { slug: 'streetlights', label: 'Streetlights', description: 'Outages, damaged poles and dark public spaces.' },
  { slug: 'waste', label: 'Waste & Garbage', description: 'Missed collection, illegal dumping and overflowing bins.' },
  { slug: 'drainage', label: 'Drainage', description: 'Blocked drains, flooding and standing water.' },
  { slug: 'water-supply', label: 'Water Supply', description: 'Leaks, outages and water quality concerns.' },
  { slug: 'sanitation', label: 'Sanitation', description: 'Public toilets, cleaning and hygiene issues.' },
  { slug: 'public-property', label: 'Public Property', description: 'Damage to civic buildings, furniture and equipment.' },
  { slug: 'parks', label: 'Parks & Public Spaces', description: 'Playgrounds, trees, benches and shared spaces.' },
  { slug: 'traffic-signs', label: 'Traffic Signs', description: 'Missing, damaged or obscured signs and markings.' },
  { slug: 'other', label: 'Other', description: 'Issues that do not fit another category.' },
];
