import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileImage,
  MessageSquare,
  RotateCcw,
  Send,
  Star,
} from 'lucide-react';
import { api, ApiError } from '../../api';
import { useCategories, useReportDetail } from '../../hooks/queries';
import {
  Alert,
  Badge,
  Button,
  ErrorState,
  Field,
  LoadingPanel,
  PageHeader,
  Panel,
  PriorityBadge,
  ReadOnlyValue,
  StatusBadge,
  Textarea,
} from '../../components/ui/base';
import { CopyButton, HelpTip, Modal } from '../../components/ui/overlays';
import { StatusRail, ReportTimeline } from '../../components/reports/ReportTimeline';
import { AttachmentGallery } from '../../components/reports/AttachmentGallery';
import { MAP_ENABLED, MapCanvas } from '../../components/map/MapCanvas';
import { useToast } from '../../components/ui/Toast';
import {
  categoryLabel,
  formatDate,
  formatDateTime,
  formatRelative,
  getErrorMessage,
  isOverdue,
} from '../../utils/format';
import type { MapPoint } from '../../types';

export function CitizenReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const detailQuery = useReportDetail(reportId);
  const categoriesQuery = useCategories();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<{
    status: 'idle' | 'uploading' | 'done' | 'error';
    progress: number;
    error?: string;
  }>({ status: 'idle', progress: 0 });
  const uploadController = useRef<AbortController | null>(null);

  useEffect(() => () => uploadController.current?.abort(), []);

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <LoadingPanel rows={8} label="Loading report" />
      </div>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title="Report not available"
          message={
            detailQuery.error
              ? getErrorMessage(detailQuery.error)
              : 'This report could not be found. It may belong to another account.'
          }
          onRetry={() => void detailQuery.refetch()}
        />
        <div className="mt-4">
          <Link to="/dashboard" className="text-sm font-semibold text-civic hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { report, history, comments, feedback, actions } = detailQuery.data;
  const categories = categoriesQuery.data ?? [];
  const category = categoryLabel(categories, report.category);
  const overdue = isOverdue(report);
  const mapPoint: MapPoint[] =
    typeof report.location.latitude === 'number' && typeof report.location.longitude === 'number'
      ? [
          {
            id: report.id,
            reportId: report.reportId,
            title: report.title,
            category: report.category,
            status: report.status,
            priority: report.priority,
            latitude: report.location.latitude,
            longitude: report.location.longitude,
            address: report.location.address,
            department: report.department?.name ?? null,
            createdAt: report.createdAt,
          },
        ]
      : [];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['report', report.reportId] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    setCommentError('');
    if (!comment.trim()) {
      setCommentError('Write a follow-up before submitting.');
      return;
    }
    setCommentSubmitting(true);
    try {
      await api.reports.comment(report.reportId, {
        body: comment.trim(),
        visibility: 'citizen',
      });
      setComment('');
      toast.success('Follow-up added', 'Authorized staff can now see your update.');
      await refresh();
    } catch (error) {
      setCommentError(error instanceof ApiError ? error.message : getErrorMessage(error));
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function submitFeedback() {
    setFeedbackError('');
    if (rating < 1) {
      setFeedbackError('Choose a rating from 1 to 5.');
      return;
    }
    setFeedbackSubmitting(true);
    try {
      await api.reports.feedback(report.reportId, {
        rating,
        comment: feedbackComment.trim() || undefined,
      });
      setFeedbackOpen(false);
      toast.success('Feedback recorded', 'Thank you. Feedback is stored separately from internal notes.');
      await refresh();
    } catch (error) {
      setFeedbackError(error instanceof ApiError ? error.message : getErrorMessage(error));
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  async function submitReopen() {
    setReopenError('');
    if (reopenNote.trim().length < 10) {
      setReopenError('Explain what is still unresolved (at least 10 characters).');
      return;
    }
    setReopenSubmitting(true);
    try {
      await api.reports.requestReopen(report.reportId, reopenNote.trim());
      setReopenOpen(false);
      setReopenNote('');
      toast.success('Reopening review requested', 'A staff member will review the request.');
      await refresh();
    } catch (error) {
      setReopenError(error instanceof ApiError ? error.message : getErrorMessage(error));
    } finally {
      setReopenSubmitting(false);
    }
  }

  async function uploadFollowUp(selectedFile: File) {
    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    setUploadState({ status: 'uploading', progress: 0 });
    try {
      await api.reports.upload(
        report.id,
        selectedFile,
        'citizen',
        (progress) => setUploadState({ status: 'uploading', progress }),
        controller.signal,
      );
      setUploadState({ status: 'done', progress: 100 });
      setFile(null);
      toast.success('Photo added', 'The image is attached to your report.');
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UPLOAD_ABORTED') return;
      setUploadState({
        status: 'error',
        progress: 0,
        error: error instanceof ApiError ? error.message : 'The image could not be uploaded.',
      });
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: report.reportId }]}
        eyebrow={category}
        title={report.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            <PriorityBadge priority={report.priority} />
            <span className="font-mono text-[11px] text-ink-muted">{report.reportId}</span>
            <span className="text-[11px] text-ink-faint">Submitted {formatDate(report.createdAt)}</span>
          </span>
        }
        actions={
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-semibold text-civic hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" /> All reports
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_318px]">
        <div className="min-w-0 space-y-5">
          <Panel>
            <div className="px-4 pt-4 sm:px-5">
              <StatusRail status={report.status} />
            </div>

            {report.resolutionSummary ? (
              <div className="mx-4 mt-4 border border-good/30 bg-good-soft px-3.5 py-3 sm:mx-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-good">
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  Resolution summary
                </p>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                  {report.resolutionSummary}
                </p>
                {report.resolvedAt ? (
                  <p className="mt-1 text-[10px] text-ink-muted">Recorded {formatDateTime(report.resolvedAt)}</p>
                ) : null}
              </div>
            ) : null}

            {report.reopenRequested ? (
              <div className="mx-4 mt-4 sm:mx-5">
                <Alert tone="info" title="Reopening review requested">
                  Your request was recorded {formatRelative(report.reopenRequestedAt)}. A staff member
                  reviews it before the report status changes. The request itself did not reopen the
                  report.
                </Alert>
              </div>
            ) : null}

            <div className="px-4 py-4 sm:px-5">
              <h2 className="text-sm font-semibold text-ink">What was reported</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-soft">
                {report.description}
              </p>
            </div>
          </Panel>

          <Panel>
            <div className="border-b border-line px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-ink">Location</h2>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <p className="text-sm text-ink">{report.location.address}</p>
              {report.location.latitude !== null && report.location.longitude !== null ? (
                <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                  {report.location.latitude.toFixed(5)}, {report.location.longitude.toFixed(5)}
                </p>
              ) : null}
              {mapPoint.length > 0 ? (
                MAP_ENABLED ? (
                  <div className="mt-3">
                    <MapCanvas points={mapPoint} onSelect={() => undefined} height={230} />
                    <p className="mt-1 text-[10px] text-ink-faint">
                      Private map context. Guest tracking does not show the pin or address.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-ink-muted">
                    Map display is disabled. The address and coordinates above remain available.
                  </p>
                )
              ) : (
                <p className="mt-3 text-[11px] text-ink-muted">
                  No coordinates were provided. Staff will use the written address or landmark.
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <FileImage aria-hidden="true" className="size-4 text-ink-muted" />
                Attachments
                <span className="text-[10px] font-normal text-ink-muted">
                  {report.attachments?.length ?? 0}
                </span>
              </h2>
              {actions.canUpload ? (
                <label className="cursor-pointer text-[11px] font-semibold text-civic hover:underline">
                  Add a photo
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const selected = event.target.files?.[0] ?? null;
                      setFile(selected);
                      setUploadState({ status: 'idle', progress: 0 });
                      if (selected) void uploadFollowUp(selected);
                      event.target.value = '';
                    }}
                  />
                </label>
              ) : null}
            </div>
            <div className="px-4 py-4 sm:px-5">
              {uploadState.status === 'uploading' ? (
                <div className="mb-3 border border-line bg-paper px-3 py-2">
                  <div className="flex justify-between text-[11px] text-ink-muted">
                    <span>Uploading {file?.name ?? 'photo'}…</span>
                    <span>{uploadState.progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden bg-paper-deep">
                    <div
                      className="h-full bg-civic"
                      style={{ width: `${uploadState.progress}%` }}
                      role="progressbar"
                      aria-valuenow={uploadState.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Photo upload progress"
                    />
                  </div>
                </div>
              ) : uploadState.status === 'error' ? (
                <div className="mb-3">
                  <Alert tone="error" title="Photo not uploaded">
                    {uploadState.error}
                  </Alert>
                </div>
              ) : null}
              <AttachmentGallery attachments={report.attachments ?? []} />
              {!actions.canUpload ? (
                <p className="mt-3 text-[10px] text-ink-muted">
                  New follow-up images are not accepted in the current report state.
                </p>
              ) : (
                <p className="mt-3 text-[10px] text-ink-muted">
                  Images are validated and access-controlled. Do not upload faces, documents or
                  unrelated personal information.
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <div className="border-b border-line px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-ink">Status timeline</h2>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                Citizen-visible updates and reasons. Internal staff notes are not shown here.
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <ReportTimeline entries={history} />
            </div>
          </Panel>

          <Panel>
            <div className="border-b border-line px-4 py-3 sm:px-5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <MessageSquare aria-hidden="true" className="size-4 text-ink-muted" />
                Follow-up and messages
                <span className="text-[10px] font-normal text-ink-muted">{comments.length}</span>
              </h2>
            </div>
            <div className="px-4 py-4 sm:px-5">
              {comments.length > 0 ? (
                <ul className="space-y-3">
                  {comments.map((entry) => (
                    <li key={entry.id} className="border-l-2 border-line pl-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[11px] font-semibold text-ink">
                          {entry.author.name}
                          <span className="ml-1.5 font-normal text-ink-muted">
                            {entry.author.roleLabel}
                          </span>
                        </p>
                        <time className="text-[10px] text-ink-faint" dateTime={entry.createdAt}>
                          {formatDateTime(entry.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                        {entry.body}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted">
                  No follow-up messages yet. If you have more information, add it below.
                </p>
              )}

              {actions.canComment ? (
                <form onSubmit={submitComment} className="mt-4 border-t border-line pt-4">
                  <Field
                    label="Add follow-up information"
                    htmlFor="follow-up"
                    error={commentError}
                    hint="Visible to authorized staff. Do not include personal information about other people."
                  >
                    <Textarea
                      id="follow-up"
                      rows={3}
                      maxLength={2000}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Add something that helps the team understand or verify the issue."
                    />
                  </Field>
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      loading={commentSubmitting}
                      disabled={!comment.trim()}
                      icon={<Send aria-hidden="true" className="size-3.5" />}
                    >
                      Add follow-up
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="mt-3 border-t border-line pt-3 text-[10px] text-ink-muted">
                  This report does not currently accept new follow-up messages.
                </p>
              )}
            </div>
          </Panel>

          {(actions.canSubmitFeedback || feedback) ? (
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Star aria-hidden="true" className="size-4 text-ink-muted" />
                  Your feedback
                </h2>
                {feedback ? <Badge tone="good">Submitted</Badge> : null}
              </div>
              <div className="px-4 py-4 sm:px-5">
                {feedback ? (
                  <div>
                    <div className="flex items-center gap-1" aria-label={`Rating ${feedback.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          aria-hidden="true"
                          className={`size-4 ${
                            value <= feedback.rating ? 'fill-accent text-accent' : 'text-line-strong'
                          }`}
                        />
                      ))}
                      <span className="ml-1 text-xs font-semibold text-ink">{feedback.rating}/5</span>
                    </div>
                    {feedback.comment ? (
                      <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                        {feedback.comment}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-ink-faint">
                      Recorded {formatDate(feedback.createdAt)} in a separate feedback record.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-ink-muted">
                      The report is resolved. Tell the service team how the resolution went.
                    </p>
                    <Button size="sm" className="mt-2" onClick={() => setFeedbackOpen(true)}>
                      Share feedback
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Panel>
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Report record</h2>
            </div>
            <dl className="grid gap-3 px-4 py-4">
              <ReadOnlyValue label="Reference" mono>
                {report.reportId}
              </ReadOnlyValue>
              <ReadOnlyValue label="Responsible department">
                {report.department?.name ?? 'Awaiting routing'}
              </ReadOnlyValue>
              <ReadOnlyValue label="Assigned team">
                {report.assignee?.name ?? 'Not yet assigned'}
              </ReadOnlyValue>
              <ReadOnlyValue label="Priority">
                <PriorityBadge priority={report.priority} />
              </ReadOnlyValue>
              <ReadOnlyValue label="Last updated">{formatDateTime(report.updatedAt)}</ReadOnlyValue>
              <div>
                <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                  Service target
                  <HelpTip label="About service targets">
                    A due date appears only when the operating organization has configured an SLA
                    for this category and priority. It is an operational target, not a legal
                    guarantee.
                  </HelpTip>
                </dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-ink">
                  {report.dueAt ? (
                    <>
                      <Clock3 aria-hidden="true" className="size-3.5 text-ink-muted" />
                      {formatDateTime(report.dueAt)}
                      {overdue ? <Badge tone="danger">Past target</Badge> : null}
                    </>
                  ) : (
                    <span className="text-xs text-ink-muted">Not configured for this report</span>
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel>
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Guest tracking</h2>
            </div>
            <div className="px-4 py-4">
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Share the reference and this code only with someone you trust. Guest tracking shows
                status updates, not your address or attachments.
              </p>
              <div className="mt-2.5 space-y-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Reference</p>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <code className="truncate font-mono text-[11px] text-ink">{report.reportId}</code>
                    <CopyButton value={report.reportId} label="Copy" />
                  </div>
                </div>
                {report.trackingCode ? (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Tracking code</p>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <code className="truncate font-mono text-[11px] text-ink">{report.trackingCode}</code>
                      <CopyButton value={report.trackingCode} label="Copy" />
                    </div>
                  </div>
                ) : null}
              </div>
              <Link to="/track" className="mt-3 inline-block text-[10px] font-semibold text-civic hover:underline">
                Open guest tracking
              </Link>
            </div>
          </Panel>

          {actions.canRequestReopen ? (
            <Panel className="border-accent/30 bg-accent-soft/40">
              <div className="p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <RotateCcw aria-hidden="true" className="size-3.5 text-accent" />
                  Is the issue still unresolved?
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Request a reopening review. A staff member reviews your explanation before the
                  status changes.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => setReopenOpen(true)}
                >
                  Request reopening review
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel className="p-4">
            <p className="text-xs font-semibold text-ink">What happens next?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              {report.status === 'Submitted'
                ? 'Your report is waiting for human triage. Staff can correct the category, priority and department.'
                : report.status === 'Under Review' || report.status === 'Reopened'
                  ? 'Staff are reviewing the report. You may receive a request for more information.'
                  : report.status === 'Assigned' || report.status === 'In Progress'
                    ? 'Work is assigned. Public updates and evidence appear in the timeline when staff record them.'
                    : report.status === 'Resolved' || report.status === 'Closed'
                      ? 'You can share feedback or request a reopening review if the issue is not actually fixed.'
                      : report.status === 'Rejected'
                        ? 'The report was not accepted. The recorded reason is visible in the timeline.'
                        : 'The report is being reviewed.'}
            </p>
            <Link to="/help#statuses" className="mt-2 inline-block text-[10px] font-semibold text-civic hover:underline">
              Read status definitions
            </Link>
          </Panel>
        </aside>
      </div>

      <Modal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title="Share feedback on the resolution"
        description="Feedback is stored separately from internal notes and is available to the service team."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFeedbackOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitFeedback} loading={feedbackSubmitting} disabled={rating < 1}>
              Submit feedback
            </Button>
          </>
        }
      >
        <form onSubmit={(event) => { event.preventDefault(); void submitFeedback(); }}>
          {feedbackError ? (
            <Alert tone="error" title="Feedback not submitted">
              {feedbackError}
            </Alert>
          ) : null}
          <fieldset className="mt-2">
            <legend className="label">How would you rate the resolution?</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Resolution rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  onClick={() => setRating(value)}
                  className={`flex items-center gap-1 border px-2.5 py-1.5 text-xs font-semibold ${
                    rating === value
                      ? 'border-civic bg-civic-tint text-civic'
                      : 'border-line bg-surface text-ink-muted hover:border-line-strong'
                  }`}
                >
                  <Star aria-hidden="true" className={`size-3.5 ${rating >= value ? 'fill-accent text-accent' : ''}`} />
                  {value}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-ink-muted">
              1 = very poor, 5 = excellent
            </p>
          </fieldset>
          <div className="mt-3">
            <Field label="Comment" htmlFor="feedback-comment" optional hint="Do not include personal information about other people.">
              <Textarea
                id="feedback-comment"
                rows={3}
                maxLength={1000}
                value={feedbackComment}
                onChange={(event) => setFeedbackComment(event.target.value)}
              />
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        title="Request a reopening review"
        description="Explain what remains unresolved. The report stays resolved until a staff member reviews this request."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReopenOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReopen} loading={reopenSubmitting}>
              Send request
            </Button>
          </>
        }
      >
        <form onSubmit={(event) => { event.preventDefault(); void submitReopen(); }}>
          {reopenError ? (
            <Alert tone="error" title="Request not sent">
              {reopenError}
            </Alert>
          ) : null}
          <Field
            label="What is still wrong?"
            htmlFor="reopen-note"
            hint="At least 10 characters. This is stored with the report and shared with authorized staff."
            error={reopenError}
          >
            <Textarea
              id="reopen-note"
              rows={4}
              maxLength={1000}
              value={reopenNote}
              onChange={(event) => setReopenNote(event.target.value)}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
