import type { Resource, ResourceQuery } from '@everguide/shared'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

type Filters = Omit<ResourceQuery, 'offset'>

export const resourceKeys = {
  list: (filters: Filters) => ['resources', filters] as const,
  detail: (slug: string) => ['resource', slug] as const,
  saved: (userId: string | undefined) => ['saved-resources', userId] as const,
  admin: (userId: string | undefined) => ['admin-resources', userId] as const,
}

/** Published resources, a page at a time; previous results stay while a search loads. */
export function useResourceDirectory(filters: Filters) {
  return useInfiniteQuery({
    queryKey: resourceKeys.list(filters),
    queryFn: ({ pageParam }) => api.listResources({ ...filters, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
  })
}

export function useResource(slug: string) {
  return useQuery({ queryKey: resourceKeys.detail(slug), queryFn: () => api.getResource(slug) })
}

export function useSavedResources() {
  const { user } = useAuth()
  return useQuery({
    queryKey: resourceKeys.saved(user?.id),
    queryFn: api.listSavedResources,
    enabled: Boolean(user),
  })
}

/**
 * Save or unsave with an optimistic update: the shared saved list changes at once (every
 * card and the "Saved" filter read it), is rolled back if the request fails, and is
 * refetched afterwards so it matches the server.
 */
export function useToggleSaved() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const key = resourceKeys.saved(user?.id)
  return useMutation({
    mutationFn: ({ resource, saved }: { resource: Resource; saved: boolean }) =>
      api.setResourceSaved(resource.id, saved),
    onMutate: async ({ resource, saved }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Resource[]>(key)
      queryClient.setQueryData<Resource[]>(key, (old = []) =>
        saved
          ? [resource, ...old.filter((r) => r.id !== resource.id)]
          : old.filter((r) => r.id !== resource.id),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useAdminResources() {
  const { user } = useAuth()
  return useQuery({
    queryKey: resourceKeys.admin(user?.id),
    queryFn: api.adminListResources,
    enabled: Boolean(user),
  })
}
