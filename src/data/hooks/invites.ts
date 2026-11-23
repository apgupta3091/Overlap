import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepo } from '../RepoContext'
import { qk } from '../queryKeys'
import { track } from '../../lib/analytics'

export function useInvites(boardId: string, enabled: boolean) {
  const repo = useRepo()
  return useQuery({ queryKey: qk.invites(repo.mode, boardId), queryFn: () => repo.listInvites(boardId), enabled })
}

export function useCreateInvite(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => repo.createInvite(boardId),
    onSuccess: () => {
      track({ name: 'invite_created', boardId })
      return qc.invalidateQueries({ queryKey: qk.invites(repo.mode, boardId) })
    },
  })
}

export function useRevokeInvite(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => repo.revokeInvite(boardId, inviteId),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.invites(repo.mode, boardId) }),
  })
}

export function useInviteStatus(token: string) {
  const repo = useRepo()
  return useQuery({
    queryKey: qk.inviteStatus(repo.mode, token),
    queryFn: () => repo.getInviteStatus(token),
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useAcceptInvite() {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => repo.acceptInvite(token),
    onSuccess: (result) => {
      if (!result.alreadyMember) track({ name: 'invite_accepted', boardId: result.boardId })
      return qc.invalidateQueries({ queryKey: qk.boards(repo.mode) })
    },
  })
}
