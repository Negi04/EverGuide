import { MessageSquarePlus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { Button } from '@/components/ui/button'
import { domainLabels } from '@/config/onboarding'
import { useConversations } from '@/hooks/use-ai'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ConversationSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [search, setSearch] = useState('')
  const query = useDebouncedValue(search.trim())
  const conversations = useConversations(query)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 p-4">
        <Button className="w-full" asChild>
          <Link to="/app/guide" onClick={onNavigate}>
            <MessageSquarePlus aria-hidden /> New conversation
          </Link>
        </Button>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {conversations.isPending ? (
          <ul className="space-y-2 px-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-12 rounded-md bg-surface-muted motion-safe:animate-pulse" />
            ))}
          </ul>
        ) : conversations.isError ? (
          <p className="px-3 text-sm text-danger">{conversations.error.message}</p>
        ) : conversations.data.length === 0 ? (
          <p className="px-3 text-sm text-muted-foreground">
            {query ? 'No conversations match your search.' : 'Your conversations will appear here.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.data.map((conversation) => (
              <li key={conversation.id}>
                <NavLink
                  to={`/app/guide/${conversation.id}`}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2 hover:bg-surface-muted',
                      isActive && 'bg-accent-subtle hover:bg-accent-subtle',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'block truncate text-sm font-medium',
                          isActive ? 'text-accent-fg' : 'text-foreground',
                        )}
                      >
                        {conversation.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {domainLabels[conversation.domain]} ·{' '}
                        {formatRelative(conversation.lastMessageAt)}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  )
}
