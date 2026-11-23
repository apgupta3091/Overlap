import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepo } from '../RepoContext'
import { qk, refreshInterval } from '../queryKeys'
import type { BoardInput } from '../repository'
import { track } from '../../lib/analytics'

export function useBoards() {
  const repo = useRepo()
  return useQuery({ queryKey: qk.boards(repo.mode), queryFn: () => repo.listBoards() })
}

/** Board, its current members, and the viewer's id. Polls while visible in live mode. */
export function useBoard(boardId: string) {
  const repo = useRepo()
  return useQuery({
    queryKey: qk.boardDetail(repo.mode, boardId),
    queryFn: () => repo.getBoard(boardId),
    refetchInterval: refreshInterval(repo.mode),
  })
}

/** Members come from the board query; this keeps a dedicated name for readability. */
export function useBoardMembers(boardId: string) {
  const query = useBoard(boardId)
  return { ...query, data: query.data?.members }
}

export function useCreateBoard() {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BoardInput) => repo.createBoard(input),
    onSuccess: (board) => {
      track({ name: 'board_created', boardId: board.id })
      return qc.invalidateQueries({ queryKey: qk.boards(repo.mode) })
    },
  })
}

export function useUpdateBoard(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BoardInput) => repo.updateBoard(boardId, input),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.board(repo.mode, boardId) }),
        qc.invalidateQueries({ queryKey: qk.boards(repo.mode) }),
      ]),
  })
}

export function useDeleteBoard(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => repo.deleteBoard(boardId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: qk.board(repo.mode, boardId) })
      return qc.invalidateQueries({ queryKey: qk.boards(repo.mode) })
    },
  })
}

export function useRemoveMember(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => repo.removeMember(boardId, userId),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.board(repo.mode, boardId) }),
  })
}

export function useLeaveBoard(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => repo.leaveBoard(boardId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: qk.board(repo.mode, boardId) })
      return qc.invalidateQueries({ queryKey: qk.boards(repo.mode) })
    },
  })
}

export function useExportBoard(boardId: string) {
  const repo = useRepo()
  return useMutation({ mutationFn: () => repo.exportBoard(boardId) })
}
