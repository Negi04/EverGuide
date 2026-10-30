import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useAuth } from '@/auth/use-auth'
import { Button } from '@/components/ui/button'
import { interviewKeys } from '@/hooks/use-interview'
import { api } from '@/lib/api'

export function SaveQuestionButton({
  questionId,
  saved,
  label,
}: {
  questionId: string
  saved: boolean
  label: string
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const toggle = useMutation({
    mutationFn: () => api.setQuestionSaved(questionId, !saved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: interviewKeys.all(user?.id) }),
  })
  const Icon = saved ? BookmarkCheck : Bookmark
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={saved}
      aria-label={`${saved ? 'Unsave' : 'Save'} question: ${label}`}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate()}
      className={saved ? 'text-accent-fg' : 'text-muted-foreground'}
    >
      <Icon aria-hidden />
    </Button>
  )
}
