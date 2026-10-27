import type { AdminUser } from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ShieldCheck, ShieldOff, UsersRound } from 'lucide-react'
import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { useAdminUsers } from '@/hooks/use-admin'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function UsersPage() {
  usePageTitle('Users')
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), 300)
  const users = useAdminUsers(q)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles control what people can do. Changes are recorded in the audit log.
        </p>
      </div>
      <div className="relative sm:w-80">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search users"
          placeholder="Search by name or email"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {users.isPending ? (
        <PageLoader label="Loading users…" />
      ) : users.isError ? (
        <p className="text-danger">{users.error.message}</p>
      ) : users.data.length === 0 ? (
        <EmptyState icon={UsersRound} title="No users match">
          <p>Try part of a name or email address.</p>
        </EmptyState>
      ) : (
        <ul
          aria-label="Users"
          className={cn(
            'divide-y divide-border rounded-lg border border-border bg-surface',
            users.isPlaceholderData && 'opacity-60',
          )}
        >
          {users.data.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </ul>
      )}
    </div>
  )
}

function UserRow({ user }: { user: AdminUser }) {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user.roles.includes('admin')
  const isMe = me?.id === user.id
  const change = useMutation({
    mutationFn: () => api.adminSetAdmin(user.id, !isAdmin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })
  const name = user.fullName ?? user.email ?? 'Unnamed user'

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-medium text-ink">
          {name} {isMe && <span className="text-sm text-muted-foreground">(you)</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Joined {formatRelative(user.createdAt)}
          {user.lastSignInAt ? ` · last signed in ${formatRelative(user.lastSignInAt)}` : ''}
        </p>
        {change.error && <FormAlert tone="error">{change.error.message}</FormAlert>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {user.roles.map((role) => (
          <Badge
            key={role}
            tone={role === 'admin' ? 'gold' : role === 'mentor' ? 'blue' : 'neutral'}
          >
            {role}
          </Badge>
        ))}
        {isMe && isAdmin ? (
          <span className="text-xs text-muted-foreground">Another admin can remove your role</span>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={change.isPending}>
                {isAdmin ? (
                  <ShieldOff className="size-4" aria-hidden />
                ) : (
                  <ShieldCheck className="size-4" aria-hidden />
                )}
                {isAdmin ? 'Remove admin' : 'Make admin'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>
                {isAdmin ? `Remove admin from ${name}?` : `Make ${name} an admin?`}
              </DialogTitle>
              <DialogDescription>
                {isAdmin
                  ? 'They will lose access to the admin area straight away.'
                  : 'Admins can verify mentors, publish content, change roles and read the audit log.'}
              </DialogDescription>
              <div className="mt-6 flex justify-end gap-3">
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={() => change.mutate()}>
                    {isAdmin ? 'Remove admin' : 'Make admin'}
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </li>
  )
}
