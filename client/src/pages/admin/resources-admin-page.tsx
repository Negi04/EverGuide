import {
  guidanceDomains,
  RESOURCE_IMAGE_MAX_BYTES,
  RESOURCE_IMAGE_TYPES,
  resourceCreateSchema,
  resourceKinds,
  resourceLevels,
  youtubeId,
  type AdminResource,
  type GuidanceDomain,
  type ResourceKind,
  type ResourceLevel,
  type ResourceStatus,
  type ResourceUpdate,
} from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  BookOpen,
  Eye,
  ImagePlus,
  PencilLine,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { EmptyState } from '@/components/common/empty-state'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { domainLabels } from '@/config/onboarding'
import { resourceKindLabels, resourceLevelLabels, resourceStatusLabels } from '@/config/resources'
import { usePageTitle } from '@/hooks/use-page-title'
import { resourceKeys, useAdminResources } from '@/hooks/use-resources'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'

type FormValues = {
  title: string
  summary: string
  kind: ResourceKind
  domain: GuidanceDomain
  url: string
  sourceName: string
  durationMinutes: string
  level: ResourceLevel
}

const emptyForm: FormValues = {
  title: '',
  summary: '',
  kind: 'article',
  domain: 'career',
  url: '',
  sourceName: '',
  durationMinutes: '',
  level: 'beginner',
}

type ImageState = { publicId: string; previewUrl: string; alt: string } | null
type FormErrors = Partial<Record<keyof FormValues | 'image', string>>

const statusTone: Record<ResourceStatus, 'brand' | 'amber' | 'neutral'> = {
  published: 'brand',
  draft: 'amber',
  archived: 'neutral',
}

/** Content management for the resource library. The server checks the admin role. */
export default function ResourcesAdminPage() {
  usePageTitle('Manage resources')
  const resources = useAdminResources()
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState<ResourceStatus | ''>('')

  const shown = (resources.data ?? []).filter((r) => !status || r.status === status)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Resources</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only add material you’ve checked. Visitors see published resources; drafts and archived
            ones stay here.
          </p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> New resource
          </Button>
        )}
      </div>

      {creating && <ResourceForm onDone={() => setCreating(false)} />}

      <NativeSelect
        aria-label="Show"
        className="w-48"
        value={status}
        onChange={(e) => setStatus(e.target.value as ResourceStatus | '')}
      >
        <option value="">All statuses</option>
        <option value="draft">Drafts</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </NativeSelect>

      {resources.isPending ? (
        <PageLoader label="Loading resources…" />
      ) : resources.isError ? (
        <p className="text-danger">{resources.error.message}</p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={status ? 'Nothing with this status' : 'No resources yet'}
        >
          <p>Add the first one with “New resource”.</p>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((resource) => (
            <li key={resource.id}>
              <AdminResourceItem resource={resource} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AdminResourceItem({ resource }: { resource: AdminResource }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: resourceKeys.admin(user?.id) })
  const update = useMutation({
    mutationFn: (patch: ResourceUpdate) => api.adminUpdateResource(resource.id, patch),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: () => api.adminDeleteResource(resource.id),
    onSuccess: refresh,
  })
  const error = update.error ?? remove.error

  if (editing) return <ResourceForm resource={resource} onDone={() => setEditing(false)} />

  const { label: kind } = resourceKindLabels[resource.kind]
  return (
    <article
      aria-labelledby={`admin-resource-${resource.id}`}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`admin-resource-${resource.id}`} className="font-semibold text-ink">
            {resource.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kind} · {domainLabels[resource.domain]} · {resource.sourceName} · updated{' '}
            {formatRelative(resource.updatedAt)}
          </p>
        </div>
        <Badge tone={statusTone[resource.status]}>{resourceStatusLabels[resource.status]}</Badge>
      </div>
      {error && <FormAlert tone="error">{error.message}</FormAlert>}
      <div className="mt-3 flex flex-wrap gap-1">
        {resource.status !== 'published' && (
          <Button
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate({ status: 'published' })}
          >
            <Send className="size-4" aria-hidden /> Publish
          </Button>
        )}
        {resource.status === 'published' && (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/resources/${resource.slug}`}>
                <Eye className="size-4" aria-hidden /> View
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate({ status: 'draft' })}
            >
              <Undo2 className="size-4" aria-hidden /> Unpublish
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <PencilLine className="size-4" aria-hidden /> Edit
        </Button>
        {resource.status === 'archived' ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate({ status: 'draft' })}
          >
            <RotateCcw className="size-4" aria-hidden /> Restore as draft
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate({ status: 'archived' })}
          >
            <Archive className="size-4" aria-hidden /> Archive
          </Button>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Delete “{resource.title}”?</DialogTitle>
            <DialogDescription>
              It will be removed from the library and from everyone’s saved list. To keep a record,
              archive it instead.
            </DialogDescription>
            <div className="mt-6 flex justify-end gap-3">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                className="bg-danger hover:bg-danger/90"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                Delete resource
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </article>
  )
}

function ResourceForm({ resource, onDone }: { resource?: AdminResource; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [values, setValues] = useState<FormValues>(
    resource
      ? {
          title: resource.title,
          summary: resource.summary,
          kind: resource.kind,
          domain: resource.domain,
          url: resource.url,
          sourceName: resource.sourceName,
          durationMinutes: resource.durationMinutes ? String(resource.durationMinutes) : '',
          level: resource.level,
        }
      : emptyForm,
  )
  const [image, setImage] = useState<ImageState>(
    resource?.image
      ? {
          publicId: resource.image.publicId,
          previewUrl: resource.image.src,
          alt: resource.image.alt,
        }
      : null,
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const fileInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues({ ...values, [key]: value })

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadResourceImage(file),
    onSuccess: ({ publicId, previewUrl }) =>
      setImage((previous) => ({ publicId, previewUrl, alt: previous?.alt ?? '' })),
  })

  /** Quick checks in the browser; the server checks the uploaded file again with Cloudinary. */
  const pickFile = (file: File | undefined) => {
    if (!file) return
    const problem = !(RESOURCE_IMAGE_TYPES as readonly string[]).includes(file.type)
      ? 'Use a JPG, PNG or WebP image.'
      : file.size > RESOURCE_IMAGE_MAX_BYTES
        ? 'Images can be up to 5 MB.'
        : undefined
    setErrors({ ...errors, image: problem })
    if (!problem) upload.mutate(file)
  }
  const imageInput = image ? { publicId: image.publicId, alt: image.alt } : null

  const save = useMutation({
    mutationFn: async ({ publish }: { publish: boolean }) => {
      const input = {
        ...values,
        durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null,
      }
      if (!resource)
        return api.adminCreateResource({
          ...input,
          image: imageInput,
          status: publish ? 'published' : 'draft',
        })
      // Send only what changed: the audit log then says what was edited, and an old form
      // can't overwrite someone else's newer change to a field you didn't touch.
      const patch = Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) => resource[key as keyof AdminResource] !== value,
        ),
      ) as ResourceUpdate
      if (
        (resource.image?.publicId ?? null) !== (imageInput?.publicId ?? null) ||
        (resource.image?.alt ?? null) !== (imageInput?.alt ?? null)
      )
        patch.image = imageInput
      return Object.keys(patch).length > 0 ? api.adminUpdateResource(resource.id, patch) : resource
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceKeys.admin(user?.id) })
      onDone()
    },
  })

  const submit = (publish: boolean) => (event?: FormEvent) => {
    event?.preventDefault()
    const checked = resourceCreateSchema.safeParse({
      ...values,
      durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null,
      image: imageInput,
    })
    if (!checked.success) {
      const next: FormErrors = {}
      for (const issue of checked.error.issues) {
        const key = issue.path[0] as keyof FormErrors
        next[key] ??= issue.message
      }
      return setErrors(next)
    }
    setErrors({})
    save.mutate({ publish })
  }

  const embed = values.kind === 'video' ? youtubeId(values.url.trim()) : null

  return (
    <form
      onSubmit={submit(false)}
      aria-label={resource ? `Edit ${resource.title}` : 'New resource'}
      className="space-y-4 rounded-lg border border-border bg-surface p-5"
    >
      {save.error && <FormAlert tone="error">{save.error.message}</FormAlert>}
      <FormField label="Title" error={errors.title}>
        <Input
          value={values.title}
          maxLength={160}
          onChange={(e) => set('title', e.target.value)}
        />
      </FormField>
      <FormField
        label="Summary"
        hint={`What it covers and who it helps. ${values.summary.length}/600`}
        error={errors.summary}
      >
        <Textarea
          rows={3}
          value={values.summary}
          maxLength={600}
          onChange={(e) => set('summary', e.target.value)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Type" error={errors.kind}>
          <NativeSelect
            value={values.kind}
            onChange={(e) => set('kind', e.target.value as ResourceKind)}
          >
            {resourceKinds.map((k) => (
              <option key={k} value={k}>
                {resourceKindLabels[k].label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Area" error={errors.domain}>
          <NativeSelect
            value={values.domain}
            onChange={(e) => set('domain', e.target.value as GuidanceDomain)}
          >
            {guidanceDomains.map((d) => (
              <option key={d} value={d}>
                {domainLabels[d]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Level" error={errors.level}>
          <NativeSelect
            value={values.level}
            onChange={(e) => set('level', e.target.value as ResourceLevel)}
          >
            {resourceLevels.map((l) => (
              <option key={l} value={l}>
                {resourceLevelLabels[l]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <FormField
        label="Link"
        hint={embed ? 'YouTube video detected: it will play on the resource page.' : undefined}
        error={errors.url}
      >
        <Input
          type="url"
          inputMode="url"
          placeholder="https://"
          value={values.url}
          onChange={(e) => set('url', e.target.value)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FormField
          label="Source"
          hint="Who made it, e.g. a site or channel name"
          error={errors.sourceName}
        >
          <Input
            value={values.sourceName}
            maxLength={120}
            onChange={(e) => set('sourceName', e.target.value)}
          />
        </FormField>
        <FormField label="Length in minutes (optional)" error={errors.durationMinutes}>
          <Input
            type="number"
            min={1}
            max={6000}
            value={values.durationMinutes}
            onChange={(e) => set('durationMinutes', e.target.value)}
          />
        </FormField>
      </div>

      {/* relative: keeps the visually hidden file input inside this box (an escaped
          sr-only element once widened a page). */}
      <fieldset className="relative space-y-3">
        <legend className="text-sm font-medium">Cover image (optional)</legend>
        {image ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <img
              src={image.previewUrl}
              alt="Cover image preview"
              className="aspect-video w-full rounded-md border border-border object-cover sm:w-56"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <FormField
                label="Describe the image"
                hint="Read aloud by screen readers, e.g. “A person planning a budget at a desk”."
                error={errors.image}
              >
                <Input
                  value={image.alt}
                  maxLength={200}
                  onChange={(e) => setImage({ ...image, alt: e.target.value })}
                />
              </FormField>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={upload.isPending}
                  onClick={() => fileInput.current?.click()}
                >
                  {upload.isPending ? 'Uploading…' : 'Replace'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setImage(null)}>
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden />
              {upload.isPending ? 'Uploading…' : 'Choose image'}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG or WebP, up to 5 MB and at least 400 pixels wide. Landscape works best.
            </p>
            {errors.image && (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.image}
              </p>
            )}
          </div>
        )}
        {upload.error && (
          <p role="alert" className="text-sm text-danger">
            {upload.error.message}
          </p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Cover image file"
          className="sr-only"
          onChange={(e) => {
            pickFile(e.target.files?.[0])
            e.target.value = '' // so choosing the same file again still triggers a change
          }}
        />
      </fieldset>

      <div className="flex flex-wrap gap-2">
        {resource ? (
          <Button type="submit" disabled={save.isPending || upload.isPending}>
            Save changes
          </Button>
        ) : (
          <>
            <Button type="submit" variant="outline" disabled={save.isPending || upload.isPending}>
              Save as draft
            </Button>
            <Button
              type="button"
              disabled={save.isPending || upload.isPending}
              onClick={() => submit(true)()}
            >
              <Send className="size-4" aria-hidden /> Publish
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
