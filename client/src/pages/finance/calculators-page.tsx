import { compoundInterest, loanEmi, sipFutureValue } from '@everguide/shared'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { Notice } from '@/components/common/notice'
import { MoneyInput } from '@/components/finance/money-input'
import { FormField } from '@/components/ui/form-field'
import { Input, NativeSelect } from '@/components/ui/input'
import { EDUCATION_NOTICE } from '@/config/finance'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatRupees } from '@/lib/format'

/** A number input with a unit after it. Takes the id and ARIA props FormField passes in. */
function SuffixInput({ suffix, ...props }: ComponentProps<typeof Input> & { suffix: string }) {
  return (
    <div className="relative">
      <Input {...props} type="number" inputMode="decimal" className="pr-14 tabular-nums" />
      <span
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
        aria-hidden
      >
        {suffix}
      </span>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 'any',
  suffix,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  min: number
  max: number
  step?: string
  suffix: string
}) {
  const n = Number(value)
  const invalid = value !== '' && !(n >= min && n <= max)
  return (
    <FormField label={label} error={invalid ? `Use a number from ${min} to ${max}.` : undefined}>
      <SuffixInput
        suffix={suffix}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  )
}

const inRange = (value: string, min: number, max: number) => {
  const n = Number(value)
  return value !== '' && n >= min && n <= max ? n : null
}

function Calculator({
  title,
  intro,
  children,
}: {
  title: string
  intro: string
  children: ReactNode
}) {
  const id = title.toLowerCase().replace(/\W+/g, '-')
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-surface p-5">
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Results({ label, rows }: { label: string; rows: [string, string, boolean?][] | null }) {
  return (
    <output aria-label={label} className="mt-5 block rounded-md bg-surface-muted p-4 text-sm">
      {rows ? (
        <dl className="space-y-1.5">
          {rows.map(([name, value, strong]) => (
            <div key={name} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{name}</dt>
              <dd
                className={
                  strong ? 'text-base font-semibold text-ink tabular-nums' : 'tabular-nums'
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted-foreground">Fill in all fields to see the result.</p>
      )}
    </output>
  )
}

function SipCalculator() {
  const [monthly, setMonthly] = useState(500_000) // ₹5,000 in paise
  const [rate, setRate] = useState('12')
  const [years, setYears] = useState('10')
  const r = inRange(rate, 0, 30)
  const y = inRange(years, 1, 40)
  const result =
    monthly > 0 && r !== null && y !== null ? sipFutureValue(monthly / 100, r, y) : null
  return (
    <Calculator
      title="SIP calculator"
      intro="What a fixed monthly investment could grow to at a steady yearly return."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Monthly investment">
          <MoneyInput value={monthly} onValueChange={setMonthly} />
        </FormField>
        <NumberField
          label="Expected return (yearly)"
          value={rate}
          onChange={setRate}
          min={0}
          max={30}
          suffix="%"
        />
        <NumberField
          label="Time"
          value={years}
          onChange={setYears}
          min={1}
          max={40}
          step="1"
          suffix="years"
        />
      </div>
      <Results
        label="SIP result"
        rows={
          result && [
            ['You invest', formatRupees(result.invested)],
            ['Estimated growth', formatRupees(result.gains)],
            ['Estimated value', formatRupees(result.value), true],
          ]
        }
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Real returns go up and down and can be negative. This assumes the same return every year,
        which never happens in practice.
      </p>
    </Calculator>
  )
}

function EmiCalculator() {
  const [principal, setPrincipal] = useState(50_000_000) // ₹5,00,000
  const [rate, setRate] = useState('10')
  const [years, setYears] = useState('5')
  const r = inRange(rate, 0, 50)
  const y = inRange(years, 1, 40)
  const result =
    principal > 0 && r !== null && y !== null ? loanEmi(principal / 100, r, y * 12) : null
  return (
    <Calculator
      title="Loan EMI calculator"
      intro="The monthly payment for a loan, and the total interest you’d pay."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Loan amount">
          <MoneyInput value={principal} onValueChange={setPrincipal} />
        </FormField>
        <NumberField
          label="Interest rate (yearly)"
          value={rate}
          onChange={setRate}
          min={0}
          max={50}
          suffix="%"
        />
        <NumberField
          label="Loan term"
          value={years}
          onChange={setYears}
          min={1}
          max={40}
          step="1"
          suffix="years"
        />
      </div>
      <Results
        label="EMI result"
        rows={
          result && [
            ['Monthly EMI', formatRupees(result.emi), true],
            ['Total interest', formatRupees(result.totalInterest)],
            ['Total you repay', formatRupees(result.totalPaid)],
          ]
        }
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Lenders may add processing fees and other charges, and rates can change on floating-rate
        loans. Check the full cost with your lender.
      </p>
    </Calculator>
  )
}

function CompoundCalculator() {
  const [principal, setPrincipal] = useState(10_000_000) // ₹1,00,000
  const [rate, setRate] = useState('7')
  const [years, setYears] = useState('5')
  const [times, setTimes] = useState('4')
  const r = inRange(rate, 0, 30)
  const y = inRange(years, 1, 50)
  const result =
    principal > 0 && r !== null && y !== null
      ? compoundInterest(principal / 100, r, y, Number(times))
      : null
  return (
    <Calculator
      title="Compound interest calculator"
      intro="How a one-time amount grows when interest is added to it regularly."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Amount">
          <MoneyInput value={principal} onValueChange={setPrincipal} />
        </FormField>
        <NumberField
          label="Interest rate (yearly)"
          value={rate}
          onChange={setRate}
          min={0}
          max={30}
          suffix="%"
        />
        <NumberField
          label="Time"
          value={years}
          onChange={setYears}
          min={1}
          max={50}
          step="1"
          suffix="years"
        />
        <FormField label="Interest added">
          <NativeSelect value={times} onChange={(e) => setTimes(e.target.value)}>
            <option value="1">Yearly</option>
            <option value="2">Every 6 months</option>
            <option value="4">Every 3 months</option>
            <option value="12">Monthly</option>
          </NativeSelect>
        </FormField>
      </div>
      <Results
        label="Compound interest result"
        rows={
          result && [
            ['Interest earned', formatRupees(result.interest)],
            ['Final amount', formatRupees(result.amount), true],
          ]
        }
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Before tax. Interest on deposits may be taxable, which lowers what you keep.
      </p>
    </Calculator>
  )
}

export default function CalculatorsPage() {
  usePageTitle('Calculators')
  return (
    <div className="space-y-6">
      <Notice>{EDUCATION_NOTICE}</Notice>
      <SipCalculator />
      <EmiCalculator />
      <CompoundCalculator />
    </div>
  )
}
