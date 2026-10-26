import {
  journalEntryCreateSchema,
  localDate,
  MAX_JOURNAL_CHARS,
  type JournalEntry,
  type JournalEntryCreate,
} from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookLock, PencilLine, Plus, Search, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { EmptyState } from '@/components/common/empty-state'
import { FormAlert } from '@/components/common/form-alert'
import { Notice } from '@/components/common/notice'
import { PageLoader } from '@/components/common/page-loader'
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
import { Input, Textarea } from '@/components/ui/input'
import { moodLabel, moods } from '@/config/wellness'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useMe } from '@/hooks/use-me'
import { usePageTitle } from '@/hooks/use-page-title'
import { useJournal, wellnessKeys } from '@/hooks/use-wellness'
import { api } from '@/lib/api'
import { displayTimeZone, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function JournalPage() {
  usePageTitle('Journal')
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), 300)
  const journal = useJournal(q)
  const [writing, setWriting] = useState(false)
  const [lowMood, setLowMood] = useState(false)
  const entries = journal.data?.pages.flatMap((p) => p.entries) ?? []

  return (
    <div className="space-y-8">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <BookLock className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
        Only you can read your journal. EverGuide’s admin tools never show journal entries, and
        they’re never used for AI or analytics.
      </p>

      {lowMood && (
        <Notice>
          Thanks for writing that down. If things feel heavy, you don’t have to manage alone:{' '}
          <Link to="/app/wellness/support" className="font-medium underline">
            see support options
          </Link>
          .
        </Notice>
      )}

      {writing ? (
        <EntryForm
          onDone={(saved) => {
            setWriting(false)
            setLowMood(saved?.mood === 1)
          }}
        />
      ) : (
        <Button onClick={() => setWriting(true)}>
          <Plus className="size-4" aria-hidden /> New entry
        </Button>
      )}

      <section aria-labelledby="entries-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="entries-title" className="text-lg font-semibold text-ink">
            Your entries
          </h2>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Search your journal"
              placeholder="Search entries"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {journal.isPending ? (
          <PageLoader label="Loading your journal…" />
        ) : journal.isError ? (
          <p className="text-danger">{journal.error.message}</p>
        ) : entries.length === 0 ? (
          <EmptyState icon={PencilLine} title={q ? 'No entries match' : 'No entries yet'}>
            <p>
              {q
                ? 'Try different words.'
                : 'Write a few lines about your day, what’s on your mind, or something you’re grateful for.'}
            </p>
          </EmptyState>
        ) : (
          <ul
            aria-busy={journal.isPlaceholderData}
            className={cn(
              'space-y-4 transition-opacity',
              journal.isPlaceholderData && 'opacity-60',
            )}
          >
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} />
              </li>
            ))}
          </ul>
        )}

        {journal.hasNextPage && (
          <Button
            variant="outline"
            onClick={() => void journal.fetchNextPage()}
            disabled={journal.isFetchingNextPage}
          >
            {journal.isFetchingNextPage ? 'Loading…' : 'Show older entries'}
          </Button>
        )}
      </section>
    </div>
  )
}

function EntryCard({ entry }: { entry: JournalEntry }) {
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const remove = useMutation({
    mutationFn: () => api.deleteJournalEntry(entry.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wellnessKeys.journal(user?.id) }),
  })

  if (editing) return <EntryForm entry={entry} onDone={() => setEditing(false)} />

  const mood = moodLabel(entry.mood)
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">{formatDate(entry.entryDate)}</p>
          {entry.title && <h3 className="mt-1 text-base font-semibold text-ink">{entry.title}</h3>}
        </div>
        {mood && <span className="text-xs text-muted-foreground">Mood: {mood}</span>}
      </header>
      <p className="mt-3 leading-relaxed whitespace-pre-wrap text-foreground">{entry.body}</p>
      {remove.error && <FormAlert tone="error">{remove.error.message}</FormAlert>}
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <PencilLine className="size-4" aria-hidden /> Edit
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Delete this entry?</DialogTitle>
            <DialogDescription>
              The entry from {formatDate(entry.entryDate)} will be deleted permanently.
            </DialogDescription>
            <div className="mt-6 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Keep it</Button>
              </DialogClose>
              <Button
                className="bg-danger hover:bg-danger/90"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                Delete entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </article>
  )
}

function EntryForm({
  entry,
  onDone,
}: {
  entry?: JournalEntry
  onDone: (saved?: JournalEntry) => void
}) {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [values, setValues] = useState({
    entryDate: entry?.entryDate ?? localDate(displayTimeZone(me?.timezone)),
    mood: entry?.mood ?? null,
    title: entry?.title ?? '',
    body: entry?.body ?? '',
  })
  const [problem, setProblem] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (input: JournalEntryCreate) =>
      entry ? api.updateJournalEntry(entry.id, input) : api.createJournalEntry(input),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: wellnessKeys.journal(user?.id) })
      onDone(saved)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const checked = journalEntryCreateSchema.safeParse(values)
    if (!checked.success) return setProblem(checked.error.issues[0]?.message ?? 'Check the entry.')
    setProblem(null)
    save.mutate(values)
  }

  return (
    <form
      onSubmit={submit}
      aria-label={entry ? 'Edit journal entry' : 'New journal entry'}
      className="space-y-5 rounded-lg border border-border bg-surface p-5"
    >
      {(problem ?? save.error) && (
        <FormAlert tone="error">{problem ?? save.error?.message}</FormAlert>
      )}
      <div className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <FormField label="Date">
          <Input
            type="date"
            value={values.entryDate}
            onChange={(e) => setValues({ ...values, entryDate: e.target.value })}
          />
        </FormField>
        <FormField label="Title (optional)">
          <Input
            value={values.title}
            maxLength={120}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
          />
        </FormField>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">How are you feeling? (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {moods.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={values.mood === m.value}
              onClick={() =>
                setValues({ ...values, mood: values.mood === m.value ? null : m.value })
              }
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm',
                values.mood === m.value
                  ? 'border-primary bg-blue-50 text-blue-700'
                  : 'border-border hover:border-border-strong',
              )}
            >
              <span aria-hidden>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <FormField
        label="Entry"
        hint={`${values.body.length.toLocaleString('en-IN')} / ${MAX_JOURNAL_CHARS.toLocaleString('en-IN')}`}
      >
        <Textarea
          rows={8}
          value={values.body}
          maxLength={MAX_JOURNAL_CHARS}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : entry ? 'Save changes' : 'Save entry'}
        </Button>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
