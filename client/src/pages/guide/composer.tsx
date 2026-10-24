import { ArrowUp, Square } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'

const MAX_LENGTH = 4000

type ComposerProps = {
  onSend: (text: string) => void
  onStop?: () => void
  busy: boolean
  disabled?: boolean
  /** Text to put back in the box, e.g. after the user stops an answer. */
  restore?: { text: string; key: number } | null
  placeholder?: string
}

export function Composer({ onSend, onStop, busy, disabled, restore, placeholder }: ComposerProps) {
  const [text, setText] = useState('')
  const [restoredKey, setRestoredKey] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Put text back (e.g. after Stop) when a new restore request arrives. Adjusting state
  // during render is React's recommended alternative to syncing it in an effect.
  if (restore && restore.key !== restoredKey) {
    setRestoredKey(restore.key)
    setText(restore.text)
  }

  // Grow with the content, up to a limit.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || busy || disabled) return
    onSend(trimmed)
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter adds a new line.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-border-strong bg-surface p-2 shadow-sm focus-within:border-primary"
    >
      <label htmlFor="composer" className="sr-only">
        Your question
      </label>
      <textarea
        id="composer"
        ref={textareaRef}
        rows={1}
        value={text}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? 'Ask about careers, interviews, wellbeing or money…'}
        className="block max-h-[200px] w-full resize-none bg-transparent px-2 py-2 text-[0.95rem] outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed"
      />
      <div className="flex items-center justify-between gap-3 px-2 pt-1">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {text.length > MAX_LENGTH - 400
            ? `${MAX_LENGTH - text.length} characters left`
            : 'Enter to send · Shift+Enter for a new line'}
        </span>
        {/* Separate keys matter: if React reused one <button> and flipped its type from
            "button" to "submit" while the Stop click was still being handled, the browser
            would submit the form and re-send the question that Stop just restored. */}
        {busy ? (
          <Button key="stop" type="button" size="sm" variant="outline" onClick={onStop}>
            <Square aria-hidden /> Stop
          </Button>
        ) : (
          <Button
            key="send"
            type="submit"
            size="sm"
            disabled={!text.trim() || disabled}
            aria-label="Send"
          >
            <ArrowUp aria-hidden /> Send
          </Button>
        )}
      </div>
    </form>
  )
}
