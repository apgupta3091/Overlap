import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ListingImage, ListingSummary } from '../../domain/types'
import { useRepo } from '../RepoContext'
import { qk } from '../queryKeys'
import type { ProcessedImage } from '../repository'

/** Signed URLs expire after an hour; refresh them comfortably before that. */
const IMAGE_URL_STALE_MS = 45 * 60 * 1000

/**
 * Resolve display URLs for a set of images. Keyed by image ids (not paths or URLs), so URLs are
 * not regenerated on every render or poll; they refresh only when stale or after a load error.
 */
export function useImageUrls(boardId: string, images: readonly ListingImage[]) {
  const repo = useRepo()
  const ids = images.map((i) => i.id).join(',')
  return useQuery({
    queryKey: qk.images(repo.mode, boardId, ids),
    queryFn: () => repo.getImageUrls(boardId, [...images]),
    enabled: images.length > 0,
    staleTime: IMAGE_URL_STALE_MS,
    gcTime: IMAGE_URL_STALE_MS,
    refetchOnWindowFocus: false,
  })
}

export function useRefreshImageUrls(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return (images: readonly ListingImage[]) =>
    qc.invalidateQueries({ queryKey: qk.images(repo.mode, boardId, images.map((i) => i.id).join(',')) })
}

export function useUploadImage(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      listingId,
      image,
      onProgress,
    }: {
      listingId: string
      image: ProcessedImage
      onProgress?: (fraction: number) => void
    }) => repo.uploadImage(boardId, listingId, image, onProgress),
    onSuccess: (img) => {
      qc.setQueryData<ListingSummary[]>(qk.listings(repo.mode, boardId), (old) =>
        old?.map((l) => (l.id === img.listingId && !l.images.some((i) => i.id === img.id) ? { ...l, images: [...l.images, img] } : l)),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.listings(repo.mode, boardId) }),
  })
}

export function useDeleteImage(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (image: ListingImage) => repo.deleteImage(boardId, image),
    onSuccess: (_d, image) => {
      qc.setQueryData<ListingSummary[]>(qk.listings(repo.mode, boardId), (old) =>
        old?.map((l) => (l.id === image.listingId ? { ...l, images: l.images.filter((i) => i.id !== image.id) } : l)),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.listings(repo.mode, boardId) }),
  })
}
