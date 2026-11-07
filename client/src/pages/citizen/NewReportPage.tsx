import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Camera,
  Check,
  ImagePlus,
  LocateFixed,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react';
import { api, ApiError } from '../../api';
import { useCategories, usePublicConfig } from '../../hooks/queries';
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Panel,
  Select,
  Textarea,
} from '../../components/ui/base';
import { CopyButton } from '../../components/ui/overlays';
import {
  MAP_ENABLED,
  LocationPicker,
} from '../../components/map/MapCanvas';
import { useToast } from '../../components/ui/Toast';
import {
  categoryLabel,
  formatBytes,
  getErrorMessage,
  getFieldErrors,
} from '../../utils/format';
import type { ClassifyResult, ReportDetail } from '../../types';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface UploadState {
  status: 'idle' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export function NewReportPage() {
  const categoriesQuery = useCategories();
  const configQuery = usePublicConfig();
  const queryClient = useQueryClient();
  const toast = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const categoryId = useId();
  const addressId = useId();
  const photoId = useId();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [fileError, setFileError] = useState('');
  const [geoMessage, setGeoMessage] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [suggestion, setSuggestion] = useState<ClassifyResult | null>(null);
  const [suggestionError, setSuggestionError] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ReportDetail | null>(null);
  const [upload, setUpload] = useState<UploadState>({ status: 'idle', progress: 0 });
  const uploadController = useRef<AbortController | null>(null);

  const maxMb = configQuery.data?.uploads.maxMb ?? 5;

  useEffect(() => {
    if (!file) {
      setFilePreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => () => uploadController.current?.abort(), []);

  function chooseFile(nextFile: File | null) {
    setFileError('');
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(nextFile.type)) {
      setFileError('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (nextFile.size > Math.min(maxMb * 1024 * 1024, MAX_FILE_BYTES)) {
      setFileError(`Choose an image smaller than ${maxMb} MB.`);
      return;
    }
    setFile(nextFile);
  }

  async function suggestCategory() {
    setSuggestionError('');
    if (title.trim().length < 3 || description.trim().length < 5) {
      setSuggestionError('Add a title and a short description before asking for a suggestion.');
      return;
    }
    setSuggesting(true);
    try {
      const result = await api.ai.classify({
        title: title.trim().slice(0, 200),
        description: description.trim().slice(0, 4000),
      });
      setSuggestion(result);
    } catch (error) {
      setSuggestionError(
        error instanceof ApiError
          ? `${error.message} You can continue by choosing a category manually.`
          : 'The suggestion service is unavailable. Choose a category manually and continue.',
      );
    } finally {
      setSuggesting(false);
    }
  }

  function useCurrentLocation() {
    setGeoMessage('');
    if (!navigator.geolocation) {
      setGeoMessage('This browser does not support location lookup. Enter the address manually.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(Number(position.coords.latitude.toFixed(6)));
        setLongitude(Number(position.coords.longitude.toFixed(6)));
        setGeoMessage('Pin placed from your browser location. Check that it matches the issue.');
        setGeoLoading(false);
      },
      () => {
        setGeoMessage(
          'Location permission was not granted or lookup failed. The address and manual pin still work.',
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (title.trim().length < 5) next.title = 'Add a short, specific title (at least 5 characters).';
    if (description.trim().length < 20) {
      next.description = 'Describe the issue in at least 20 characters.';
    }
    if (!category) next.category = 'Choose the closest category.';
    if (address.trim().length < 5) next.address = 'Add an address or a nearby landmark.';
    if ((latitude === null) !== (longitude === null)) {
      next.location = 'Provide both coordinates, or remove the pin.';
    }
    if (fileError) next.file = fileError;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!validate()) {
      setFormError('Please correct the highlighted fields before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const detail = await api.reports.create({
        title: title.trim(),
        description: description.trim(),
        category,
        location: {
          address: address.trim(),
          latitude,
          longitude,
        },
        ...(suggestion
          ? {
              aiSuggestion: {
                suggestedCategory: suggestion.category,
                suggestedPriority: suggestion.suggestedPriority,
                rationale: suggestion.rationale,
                source: suggestion.source,
                confidence: suggestion.confidence,
              },
            }
          : {}),
      });
      setCreated(detail);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (file) {
        void uploadFile(detail.report.id, file);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setErrors(getFieldErrors(error));
      } else {
        setFormError(getErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadFile(reportId: string, selectedFile: File) {
    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    setUpload({ status: 'uploading', progress: 0 });
    try {
      await api.reports.upload(
        reportId,
        selectedFile,
        'citizen',
        (progress) => setUpload({ status: 'uploading', progress }),
        controller.signal,
      );
      setUpload({ status: 'done', progress: 100 });
      toast.success('Photo uploaded', 'The image is attached to your report.');
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UPLOAD_ABORTED') return;
      const message =
        error instanceof ApiError
          ? error.message
          : 'The photo could not be uploaded. Your report itself was saved.';
      setUpload({ status: 'error', progress: 0, error: message });
    }
  }

  function resetForm() {
    setCreated(null);
    setTitle('');
    setDescription('');
    setCategory('');
    setAddress('');
    setLatitude(null);
    setLongitude(null);
    setFile(null);
    setSuggestion(null);
    setUpload({ status: 'idle', progress: 0 });
    setErrors({});
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (created) {
    const report = created.report;
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Report received' }]}
          eyebrow="Submission complete"
          title="Your report has a reference."
          description="The report is stored and visible to the municipal triage team. Nothing was published publicly, and no service deadline is promised unless a target is configured."
        />
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Panel className="border-good/30">
              <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-good-soft text-good">
                  <Check aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-ink">Report {report.reportId}</h2>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Submitted · {categoryLabel(categoriesQuery.data ?? [], report.category)}
                  </p>
                </div>
              </div>
              <div className="space-y-4 px-4 py-4">
                <div>
                  <p className="label">Public reference</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="rounded-[2px] border border-line bg-paper px-2 py-1 font-mono text-sm text-ink">
                      {report.reportId}
                    </code>
                    <CopyButton value={report.reportId} label="Copy reference" />
                  </div>
                </div>
                <div>
                  <p className="label">Secure tracking code</p>
                  <p className="hint mb-1.5">
                    Required for guest tracking. Keep it with the reference; the reference alone is
                    not enough to open the report.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-[2px] border border-line bg-paper px-2 py-1 font-mono text-xs text-ink">
                      {report.trackingCode}
                    </code>
                    {report.trackingCode ? (
                      <CopyButton value={report.trackingCode} label="Copy code" />
                    ) : null}
                  </div>
                </div>
                <div className="rounded-[3px] border border-line bg-paper px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink">Next steps</p>
                  <ol className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-ink-muted">
                    <li>1. A staff member reviews the location, category and priority.</li>
                    <li>2. If the report is routed, a department and assigned team appear on the record.</li>
                    <li>3. You receive in-app notifications when the status changes.</li>
                  </ol>
                </div>
              </div>
            </Panel>

            {file ? (
              <Panel className="p-4">
                <p className="text-sm font-semibold text-ink">Photo upload</p>
                {upload.status === 'uploading' ? (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-ink-muted">
                      <span>Uploading {file.name}</span>
                      <span>{upload.progress}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-deep">
                      <div
                        className="h-full bg-civic transition-[width]"
                        style={{ width: `${upload.progress}%` }}
                        role="progressbar"
                        aria-valuenow={upload.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Photo upload progress"
                      />
                    </div>
                  </div>
                ) : upload.status === 'done' ? (
                  <p className="mt-1 text-xs text-good">
                    Uploaded. The image is attached with citizen visibility.
                  </p>
                ) : upload.status === 'error' ? (
                  <div className="mt-2">
                    <Alert tone="error" title="Photo not uploaded">
                      {upload.error} Your report is safe. You can retry now or add a photo from the
                      report page.
                    </Alert>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={() => void uploadFile(report.id, file)}
                    >
                      Retry upload
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-ink-muted">
                    The photo has not been uploaded yet. You can add it from the report page.
                  </p>
                )}
              </Panel>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <LinkButton to={`/reports/${report.reportId}`}>
                View report <ArrowRight aria-hidden="true" className="size-4" />
              </LinkButton>
              <Button variant="secondary" onClick={resetForm}>
                Report another issue
              </Button>
              <Link
                to="/dashboard"
                className="inline-flex items-center px-2 text-sm font-semibold text-civic hover:underline"
              >
                Back to dashboard
              </Link>
            </div>
          </div>

          <aside className="space-y-3">
            <Alert tone="warning" title="Keep your reference private">
              The tracking code allows limited guest access to this report. Do not post it publicly
              or include personal information in a follow-up comment.
            </Alert>
            <Panel className="p-4">
              <p className="text-xs font-semibold text-ink">What was recorded</p>
              <dl className="mt-2 space-y-2 text-[11px]">
                <div>
                  <dt className="text-ink-muted">Address</dt>
                  <dd className="text-ink">{report.location.address}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Department</dt>
                  <dd className="text-ink">{report.department?.name ?? 'Awaiting routing'}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Service target</dt>
                  <dd className="text-ink">
                    {report.dueAt
                      ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
                          new Date(report.dueAt),
                        )
                      : 'No target configured for this priority'}
                  </dd>
                </div>
              </dl>
            </Panel>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'New report' }]}
        eyebrow="Citizen report"
        title="Report a civic issue"
        description="One issue per report. Describe what is wrong and where. A person will review the report before it is assigned."
        actions={<LinkButton to="/dashboard" variant="secondary">Cancel</LinkButton>}
      />

      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-5 lg:grid-cols-[1fr_318px]">
          <div className="space-y-5">
            {formError ? (
              <Alert tone="error" title="Report not submitted">
                {formError}
              </Alert>
            ) : null}

            <Panel>
              <div className="border-b border-line px-4 py-3 sm:px-5">
                <p className="eyebrow">01 · Issue details</p>
                <h2 className="mt-0.5 text-base font-semibold text-ink">What needs attention?</h2>
              </div>
              <div className="space-y-4 px-4 py-4 sm:px-5">
                <Field
                  label="Title"
                  htmlFor={titleId}
                  error={errors.title}
                  hint="A specific title helps staff find and prioritise the report."
                >
                  <Input
                    id={titleId}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={140}
                    placeholder="Example: Deep pothole on Cedar Avenue near the school crossing"
                    invalid={Boolean(errors.title)}
                  />
                </Field>
                <Field
                  label="Description"
                  htmlFor={descriptionId}
                  error={errors.description}
                  hint={`${description.trim().length}/5000 characters. Include what is wrong, how long it has been there and any safety risk.`}
                >
                  <Textarea
                    id={descriptionId}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={5000}
                    rows={6}
                    invalid={Boolean(errors.description)}
                    placeholder="Describe the issue in plain language. Do not include identity documents, unrelated personal information or the faces of bystanders."
                  />
                </Field>
                <Field label="Category" htmlFor={categoryId} error={errors.category}>
                  <Select
                    id={categoryId}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    invalid={Boolean(errors.category)}
                  >
                    <option value="">Choose the closest category</option>
                    {(categoriesQuery.data ?? []).map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {categoriesQuery.isError ? (
                  <Alert tone="warning" title="Categories unavailable">
                    The category list could not be loaded. Refresh the page before submitting.
                  </Alert>
                ) : null}
              </div>
            </Panel>

            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
                <div>
                  <p className="eyebrow">02 · Location</p>
                  <h2 className="mt-0.5 text-base font-semibold text-ink">Where is it?</h2>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={useCurrentLocation}
                  loading={geoLoading}
                  icon={<LocateFixed aria-hidden="true" className="size-3.5" />}
                >
                  Use my location
                </Button>
              </div>
              <div className="space-y-4 px-4 py-4 sm:px-5">
                <Field
                  label="Address or landmark"
                  htmlFor={addressId}
                  error={errors.address}
                  hint="Required. An address, intersection or recognisable landmark is more useful than coordinates alone."
                >
                  <Input
                    id={addressId}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Example: Cedar Avenue at 5th Street, near the school crossing"
                    invalid={Boolean(errors.address)}
                  />
                </Field>
                {geoMessage ? <p className="text-[11px] text-ink-muted">{geoMessage}</p> : null}
                {MAP_ENABLED ? (
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="hint">Optional: click the map to place a pin, then drag it to adjust.</p>
                      {latitude !== null && longitude !== null ? (
                        <button
                          type="button"
                          onClick={() => {
                            setLatitude(null);
                            setLongitude(null);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-danger hover:underline"
                        >
                          <X aria-hidden="true" className="size-3" />
                          Clear pin
                        </button>
                      ) : null}
                    </div>
                    <LocationPicker
                      latitude={latitude}
                      longitude={longitude}
                      onChange={(lat, lng) => {
                        setLatitude(lat);
                        setLongitude(lng);
                        setErrors((current) => ({ ...current, location: '' }));
                      }}
                    />
                    <p className="mt-1 text-[10px] text-ink-faint">
                      Map tiles: OpenStreetMap. The tile provider receives your network request. The
                      map is optional; manual address entry always works.
                    </p>
                    {errors.location ? (
                      <p className="mt-1 text-xs font-medium text-danger" role="alert">
                        {errors.location}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Alert tone="info" title="Map display is disabled">
                    Address entry and manual coordinates still work. A platform administrator can
                    enable a map tile provider if needed.
                  </Alert>
                )}
                <details className="border border-line bg-[#fbfaf6] px-3 py-2">
                  <summary className="cursor-pointer text-[11px] font-semibold text-ink-soft">
                    Enter coordinates manually
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Latitude" htmlFor="latitude">
                      <Input
                        id="latitude"
                        inputMode="decimal"
                        type="number"
                        step="any"
                        min={-90}
                        max={90}
                        value={latitude ?? ''}
                        onChange={(event) => {
                          const value = event.target.value === '' ? null : Number(event.target.value);
                          setLatitude(Number.isFinite(value as number) ? value : null);
                        }}
                        placeholder="40.4414"
                      />
                    </Field>
                    <Field label="Longitude" htmlFor="longitude">
                      <Input
                        id="longitude"
                        inputMode="decimal"
                        type="number"
                        step="any"
                        min={-180}
                        max={180}
                        value={longitude ?? ''}
                        onChange={(event) => {
                          const value = event.target.value === '' ? null : Number(event.target.value);
                          setLongitude(Number.isFinite(value as number) ? value : null);
                        }}
                        placeholder="-80.0006"
                      />
                    </Field>
                  </div>
                  <p className="mt-1 text-[10px] text-ink-faint">
                    Provide both values or neither. These coordinates are used only for routing and
                    map context.
                  </p>
                </details>
              </div>
            </Panel>

            <Panel>
              <div className="border-b border-line px-4 py-3 sm:px-5">
                <p className="eyebrow">03 · Optional photo</p>
                <h2 className="mt-0.5 text-base font-semibold text-ink">Add a clear image</h2>
              </div>
              <div className="px-4 py-4 sm:px-5">
                {!file ? (
                  <div>
                    <label
                      htmlFor={photoId}
                      className="flex cursor-pointer flex-col items-start gap-2 border border-dashed border-line-strong bg-[#fbfaf6] px-4 py-5 hover:border-civic"
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-civic">
                        <ImagePlus aria-hidden="true" className="size-4" />
                        Choose an image
                      </span>
                      <span className="text-[10px] leading-relaxed text-ink-muted">
                        JPEG, PNG or WebP · maximum {maxMb} MB. Do not include unrelated faces,
                        documents, number plates or personal information.
                      </span>
                    </label>
                    <input
                      id={photoId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="Selected issue preview"
                        className="h-28 w-full border border-line object-cover sm:w-40"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink">{file.name}</p>
                      <p className="mt-0.5 text-[10px] text-ink-muted">
                        {formatBytes(file.size)} · uploads after the report is saved
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <label
                          htmlFor={photoId}
                          className="cursor-pointer text-[11px] font-semibold text-civic hover:underline"
                        >
                          Replace image
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            setFileError('');
                          }}
                          className="text-[11px] font-semibold text-danger hover:underline"
                        >
                          Remove
                        </button>
                        <input
                          id={photoId}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {fileError ? (
                  <p className="mt-2 text-xs font-medium text-danger" role="alert">
                    {fileError}
                  </p>
                ) : null}
              </div>
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-surface px-4 py-3">
              <p className="max-w-md text-[10px] leading-relaxed text-ink-muted">
                Submitting creates a stored report. You will receive a reference number, and the
                report enters the human review queue. This is not an emergency service.
              </p>
              <Button type="submit" loading={submitting} size="lg">
                Submit report
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>

          <aside className="space-y-4">
            <Panel className="border-civic/30">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <Sparkles aria-hidden="true" className="size-4 text-civic" />
                <h2 className="text-sm font-semibold text-ink">Suggestion assistant</h2>
                <Badge tone="neutral">Advisory</Badge>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] leading-relaxed text-ink-muted">
                  Get a suggested category and priority from the title and description. A person
                  makes the final decision. Choose a category manually if the suggestion is wrong.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2.5 w-full"
                  onClick={() => void suggestCategory()}
                  loading={suggesting}
                >
                  Suggest a category
                </Button>
                {suggestionError ? (
                  <p className="mt-2 text-[10px] leading-relaxed text-warn" role="status">
                    {suggestionError}
                  </p>
                ) : null}
                {suggestion ? (
                  <div className="mt-3 border-t border-line pt-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="civic">
                        {suggestion.source === 'openai'
                          ? suggestion.degraded
                            ? 'Rules fallback (AI unavailable)'
                            : 'OpenAI suggestion'
                          : 'Rules-based fallback'}
                      </Badge>
                      <span className="text-[10px] text-ink-muted">
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-ink">
                      {categoryLabel(categoriesQuery.data ?? [], suggestion.category)}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-ink-muted">
                      {suggestion.rationale}
                    </p>
                    <p className="mt-1.5 text-[10px] text-ink-muted">
                      Priority suggestion: <span className="font-semibold text-ink">{suggestion.suggestedPriority}</span>{' '}
                      <span className="text-ink-faint">· staff confirms</span>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => setCategory(suggestion.category)}
                      disabled={category === suggestion.category}
                    >
                      {category === suggestion.category ? 'Category applied' : 'Use suggested category'}
                    </Button>
                    <p className="mt-1.5 text-[9px] text-ink-faint">{suggestion.disclaimer}</p>
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel className="p-4">
              <p className="eyebrow">Before you submit</p>
              <ul className="mt-2 space-y-2">
                {[
                  'Describe one issue, not several unrelated problems.',
                  'Use the closest category; staff can correct it.',
                  'Add a landmark if the address is not precise.',
                  'Do not upload faces, documents or unrelated personal data.',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-muted">
                    <Check aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-good" />
                    {point}
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <MapPin aria-hidden="true" className="size-3.5 text-ink-muted" />
                Location privacy
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                Your address is visible to authorized staff handling the report and to you. Guest
                tracking does not show the address or coordinates.
              </p>
            </Panel>

            <Alert tone="warning" title="Not for emergencies">
              Fire, gas, live wires, crime in progress or medical emergencies should go directly to
              your local emergency service.
            </Alert>

            <Panel className="flex items-center gap-3 bg-[#fbfaf6] p-3">
              <Camera aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
              <p className="text-[10px] leading-relaxed text-ink-muted">
                Upload progress is shown in the confirmation step. If an upload fails, the report is
                still saved and can be retried.
              </p>
            </Panel>
          </aside>
        </div>
      </form>
    </div>
  );
}
