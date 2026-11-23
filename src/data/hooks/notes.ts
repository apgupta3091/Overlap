import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepo } from '../RepoContext'
import { qk, refreshInterval } from '../queryKeys'

export function useNotes(boardId: string, listingId: string) {
  const repo = useRepo()
  return useQuery({
    queryKey: qk.notes(repo.mode, boardId, listingId),
    queryFn: () => repo.listNotes(boardId, listingId),
    refetchInterval: refreshInterval(repo.mode),
  })
}

export function useNoteMutations(boardId: string, listingId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.notes(repo.mode, boardId, listingId) })
  const add = useMutation({ mutationFn: (body: string) => repo.addNote(boardId, listingId, body), onSettled: invalidate })
  const update = useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) => repo.updateNote(boardId, noteId, body),
    onSettled: invalidate,
  })
  const remove = useMutation({ mutationFn: (noteId: string) => repo.deleteNote(boardId, noteId), onSettled: invalidate })
  return { add, update, remove }
}
