import {
  budgetKinds,
  budgetSummary,
  localDate,
  type Budget,
  type BudgetItem,
  type BudgetItemUpdate,
  type BudgetKind,
} from '@everguide/shared'
import { useMutation } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { FormAlert } from '@/components/common/form-alert'
import { Notice } from '@/components/common/notice'
import { PageLoader } from '@/components/common/page-loader'
import { MoneyInput } from '@/components/finance/money-input'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { budgetKindLabels, EDUCATION_NOTICE } from '@/config/finance'
import { useBudget, useSetBudget } from '@/hooks/use-finance'
import { useMe } from '@/hooks/use-me'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { displayTimeZone, formatMonth, formatPaise } from '@/lib/format'
import { cn } from '@/lib/utils'

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number]
  const index = year * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export default function BudgetPage() {
  usePageTitle('Budget')
  const { data: me } = useMe()
  const thisMonth = localDate(displayTimeZone(me?.timezone)).slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const budget = useBudget(month)

  return (
    <div className="space-y-8">
      <Notice>{EDUCATION_NOTICE}</Notice>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <h2 className="min-w-40 text-center text-lg font-semibold text-ink" aria-live="polite">
          {formatMonth(month)}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next month"
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight aria-hidden />
        </Button>
        {month !== thisMonth && (
          <Button variant="link" onClick={() => setMonth(thisMonth)}>
            This month
          </Button>
        )}
      </div>

      {budget.isPending ? (
        <PageLoader label="Loading budget…" />
      ) : budget.isError ? (
        <p className="text-danger">{budget.error.message}</p>
      ) : (
        <BudgetEditor key={month} budget={budget.data} />
      )}
    </div>
  )
}

function BudgetEditor({ budget }: { budget: Budget }) {
  const setBudget = useSetBudget()
  const income = useMutation({
    mutationFn: (paise: number) => api.setBudgetIncome(budget.month, paise),
    onSuccess: setBudget,
  })
  const copy = useMutation({
    mutationFn: () => api.copyPreviousBudget(budget.month),
    onSuccess: setBudget,
  })
  const summary = budgetSummary(budget.incomePaise, budget.items)
  const error = income.error ?? copy.error

  return (
    <div className="space-y-8">
      {error && <FormAlert tone="error">{error.message}</FormAlert>}
      {budget.items.length === 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border-strong p-4 text-sm">
          <p className="flex-1">
            No plan for this month yet. Add items below, or start from last month’s plan.
          </p>
          <Button variant="outline" disabled={copy.isPending} onClick={() => copy.mutate()}>
            <Copy className="size-4" aria-hidden /> Use last month’s plan
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <FormField label="Monthly income (take-home)">
            <MoneyInput value={budget.incomePaise} onCommit={(paise) => income.mutate(paise)} />
          </FormField>
        </div>
        <Stat label="Planned" value={summary.totalPlanned} />
        <Stat label="Spent so far" value={summary.totalSpent} />
        <Stat
          label={summary.unplanned < 0 ? 'Planned over income' : 'Left to plan'}
          value={Math.abs(summary.unplanned)}
          tone={summary.unplanned < 0 ? 'danger' : undefined}
        />
      </div>

      {budget.incomePaise > 0 && (
        <section
          aria-labelledby="split-title"
          className="rounded-lg border border-border bg-surface p-5"
        >
          <h3 id="split-title" className="font-semibold text-ink">
            Your plan compared with the 50/30/20 rule of thumb
          </h3>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1.5 font-normal">Category</th>
                <th className="py-1.5 text-right font-normal">Your plan</th>
                <th className="py-1.5 text-right font-normal">Rule of thumb</th>
              </tr>
            </thead>
            <tbody>
              {budgetKinds.map((kind) => (
                <tr key={kind} className="border-t border-border">
                  <th scope="row" className="py-2 text-left font-medium">
                    {budgetKindLabels[kind].label}
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {formatPaise(summary.planned[kind])} (
                    {Math.round((summary.planned[kind] / budget.incomePaise) * 100)}%)
                  </td>
                  <td className="py-2 text-right text-muted-foreground tabular-nums">
                    {formatPaise(summary.guideline[kind])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            The rule of thumb is a common starting point, not a target everyone should hit. Costs
            like rent vary a lot by city.
          </p>
        </section>
      )}

      {budgetKinds.map((kind) => (
        <KindSection
          key={kind}
          kind={kind}
          month={budget.month}
          items={budget.items.filter((i) => i.kind === kind)}
        />
      ))}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold tabular-nums',
          tone === 'danger' ? 'text-danger' : 'text-ink',
        )}
      >
        {formatPaise(value)}
      </p>
    </div>
  )
}

function KindSection({
  kind,
  month,
  items,
}: {
  kind: BudgetKind
  month: string
  items: BudgetItem[]
}) {
  const setBudget = useSetBudget()
  const [label, setLabel] = useState('')
  const [planned, setPlanned] = useState(0)
  const add = useMutation({
    mutationFn: () =>
      api.addBudgetItem(month, { label: label.trim(), kind, plannedPaise: planned }),
    onSuccess: (budget) => {
      setBudget(budget)
      setLabel('')
      setPlanned(0)
    },
  })
  const { label: title, hint } = budgetKindLabels[kind]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (label.trim()) add.mutate()
  }

  return (
    <section aria-labelledby={`kind-${kind}`} className="space-y-3">
      <div>
        <h3 id={`kind-${kind}`} className="text-lg font-semibold text-ink">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {items.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          {/* Column headings on wider screens; on phones each field has its own label. */}
          <div
            aria-hidden
            className={cn(ROW_GRID, 'hidden px-4 pt-3 text-sm text-muted-foreground sm:grid')}
          >
            <span>Item</span>
            <span>Planned</span>
            <span>Spent</span>
          </div>
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
      <form
        onSubmit={submit}
        aria-label={`Add to ${title}`}
        className="flex flex-wrap items-end gap-2"
      >
        <Input
          aria-label={`New ${title.toLowerCase()} item`}
          placeholder="Add an item"
          className="w-full sm:w-56"
          value={label}
          maxLength={80}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="w-36">
          <MoneyInput
            aria-label={`Planned amount for the new ${title.toLowerCase()} item`}
            value={planned}
            onValueChange={setPlanned}
          />
        </div>
        <Button type="submit" variant="outline" disabled={add.isPending}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </form>
      {add.error && <FormAlert tone="error">{add.error.message}</FormAlert>}
    </section>
  )
}

/**
 * Phone: name and delete on the first line, planned and spent below.
 * Wider screens: one line per item. Focus order is name, planned, spent, delete.
 */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem]'
const AUTO_PLACE = 'sm:col-start-auto sm:row-start-auto'

function ItemRow({ item }: { item: BudgetItem }) {
  const setBudget = useSetBudget()
  const update = useMutation({
    mutationFn: (patch: BudgetItemUpdate) => api.updateBudgetItem(item.id, patch),
    onSuccess: setBudget,
  })
  const remove = useMutation({
    mutationFn: () => api.deleteBudgetItem(item.id),
    onSuccess: setBudget,
  })
  const over = item.spentPaise - item.plannedPaise
  const error = update.error ?? remove.error

  return (
    <li className={cn(ROW_GRID, 'items-end px-4 py-3')}>
      <div className={cn('col-span-2 col-start-1 row-start-1 sm:col-span-1', AUTO_PLACE)}>
        <Input
          aria-label={`Name of ${item.label}`}
          defaultValue={item.label}
          maxLength={80}
          className="h-9"
          onBlur={(e) => {
            const next = e.target.value.trim()
            if (next && next !== item.label) update.mutate({ label: next })
          }}
        />
      </div>
      <div className={cn('col-start-1 row-start-2', AUTO_PLACE)}>
        <span aria-hidden className="mb-1 block text-xs text-muted-foreground sm:hidden">
          Planned
        </span>
        <MoneyInput
          aria-label={`Planned for ${item.label}`}
          className="h-9"
          value={item.plannedPaise}
          onCommit={(paise) => update.mutate({ plannedPaise: paise })}
        />
      </div>
      <div className={cn('col-start-2 row-start-2', AUTO_PLACE)}>
        <span aria-hidden className="mb-1 block text-xs text-muted-foreground sm:hidden">
          Spent
        </span>
        <MoneyInput
          aria-label={`Spent on ${item.label}`}
          className={cn('h-9', over > 0 && 'text-danger')}
          value={item.spentPaise}
          onCommit={(paise) => update.mutate({ spentPaise: paise })}
        />
      </div>
      <div className={cn('col-start-3 row-start-1', AUTO_PLACE)}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${item.label}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
      {/* Over-budget is stated in words, not only shown in red. */}
      {over > 0 && (
        <p className="col-span-full text-xs text-danger">Over plan by {formatPaise(over)}</p>
      )}
      {error && (
        <p role="alert" className="col-span-full text-xs text-danger">
          {error.message}
        </p>
      )}
    </li>
  )
}
