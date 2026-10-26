import { MAX_RESUME_BYTES } from '@everguide/shared'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

export const resumeKeys = {
  all: (userId: string | undefined) => ['resumes', userId] as const,
  detail: (userId: string | undefined, id: string) => ['resumes', userId, id] as const,
}

export function useResumes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: resumeKeys.all(user?.id),
    queryFn: api.listResumes,
    enabled: Boolean(user),
  })
}

export function useResume(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: resumeKeys.detail(user?.id, id),
    queryFn: () => api.getResume(id),
    enabled: Boolean(user),
  })
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Quick checks before uploading; the server repeats every check. */
export function checkResumeFile(file: File): string | null {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
    return 'Please choose a PDF file.'
  if (file.size > MAX_RESUME_BYTES) return 'PDFs can be up to 5 MB.'
  if (file.size === 0) return 'That file is empty.'
  return null
}
