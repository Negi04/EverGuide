import type { AppNotification } from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useNavigate } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { mentorKeys, useNotifications } from '@/hooks/use-mentors'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const notifications = useNotifications()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const unread = notifications.data?.filter((n) => !n.readAt).length ?? 0

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api.markNotificationsRead(ids),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: mentorKeys.notifications(user?.id) }),
  })

  const open = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate([n.id])
    if (n.linkPath) void navigate(n.linkPath)
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.65rem] font-semibold text-danger-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead.mutate(undefined)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {(notifications.data ?? []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">You’re all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.data!.map((n) => (
                <li key={n.id}>
                  <Popover.Close asChild>
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className={cn(
                        'block w-full px-4 py-3 text-left hover:bg-surface-muted',
                        !n.readAt && 'bg-accent-subtle/60',
                      )}
                    >
                      <span className="block text-sm font-medium text-foreground">{n.title}</span>
                      {n.body && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>
                      )}
                      <span className="mt-1 block text-[0.7rem] text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </span>
                    </button>
                  </Popover.Close>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
