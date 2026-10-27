import type { ResourceKind, ResourceLevel, ResourceStatus } from '@everguide/shared'
import type { LucideIcon } from 'lucide-react'
import { FileText, GraduationCap, PlayCircle, Wrench } from 'lucide-react'

export const resourceKindLabels: Record<ResourceKind, { label: string; icon: LucideIcon }> = {
  article: { label: 'Article', icon: FileText },
  video: { label: 'Video', icon: PlayCircle },
  course: { label: 'Course', icon: GraduationCap },
  tool: { label: 'Tool', icon: Wrench },
}

export const resourceLevelLabels: Record<ResourceLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export const resourceStatusLabels: Record<ResourceStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}
