import { useUsage } from '@/hooks/use-ai'

export function Disclaimer() {
  return (
    <p className="text-xs text-muted-foreground">
      AI-generated guidance can be wrong. It isn’t medical, mental-health or financial advice.
    </p>
  )
}

export function UsageNote() {
  const usage = useUsage()
  if (!usage.data) return null
  const { used, limit } = usage.data
  return (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      {used} of {limit} answers used this month
    </p>
  )
}
