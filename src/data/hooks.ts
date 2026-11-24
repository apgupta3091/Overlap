import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useClient } from './client'
import { getCredentials, updateCredentials } from './credentials'
import { clearDraft } from './drafts'
import { isServiceError } from './errors'
import type { CreateEventInput, EventSnapshot, ResponseInput } from './service'

export const eventKey = (clientId: string, publicId: string) => ['event', clientId, publicId] as const

export function useEventSnapshot(publicId: string) {
  const { id, service } = useClient()
  return useQuery({
    queryKey: eventKey(id, publicId),
    queryFn: () => service.getEvent(publicId),
    retry: (count, err) => !isServiceError(err, 'not_found') && !isServiceError(err, 'forbidden') && count < 2,
  })
}

export function useCreateEvent() {
  const { service, store } = useClient()
  return useMutation({
    mutationFn: (input: CreateEventInput) => service.createEvent(input),
    onSuccess: ({ publicId, adminToken }) => {
      updateCredentials(store, publicId, { adminToken })
    },
  })
}

/** Creates the viewer's response, or updates it if this browser already submitted one. */
export function useSaveResponse(publicId: string) {
  const { id, service, store } = useClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ResponseInput) => {
      const cred = getCredentials(store, publicId)
      if (cred.responseId && cred.editToken) {
        const { response } = await service.updateResponse(publicId, cred.responseId, cred.editToken, input)
        return { response, created: false }
      }
      const { response, editToken } = await service.createResponse(publicId, input)
      updateCredentials(store, publicId, { responseId: response.id, editToken })
      return { response, created: true }
    },
    onSuccess: ({ response }) => {
      clearDraft(store, publicId)
      qc.setQueryData<EventSnapshot>(eventKey(id, publicId), (old) => {
        if (!old) return old
        const others = old.responses.filter((r) => r.id !== response.id)
        return { ...old, responses: [...others, response] }
      })
      void qc.invalidateQueries({ queryKey: eventKey(id, publicId) })
    },
  })
}
