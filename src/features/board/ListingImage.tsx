import { useState } from 'react'
import { Building2 } from 'lucide-react'
import type { ListingImage as ListingImageRecord } from '../../domain/types'
import { useImageUrls, useRefreshImageUrls } from '../../data/hooks/images'

export function PhotoPlaceholder({ label = 'No photo yet', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-sunken text-ink-faint ${className}`}>
      <Building2 aria-hidden className="size-8" strokeWidth={1.5} />
      <span className="text-xs">{label}</span>
    </div>
  )
}

interface ListingPhotoProps {
  boardId: string
  image: ListingImageRecord | undefined
  variant: 'thumb' | 'full'
  alt: string
  className?: string
  eager?: boolean
}

/**
 * Renders a listing photo inside a fixed-aspect container (set by the parent) to avoid layout shift.
 * Signed URLs that expire are refreshed once on load error before falling back to the placeholder.
 */
export function ListingPhoto(props: ListingPhotoProps) {
  // Keyed by image id so failure state resets when the image changes.
  return <ListingPhotoInner key={props.image?.id ?? 'none'} {...props} />
}

function ListingPhotoInner({ boardId, image, variant, alt, className = '', eager = false }: ListingPhotoProps) {
  const images = image ? [image] : []
  const { data, isLoading } = useImageUrls(boardId, images)
  const refresh = useRefreshImageUrls(boardId)
  const [failures, setFailures] = useState(0)
  const url = image ? data?.[image.id]?.[variant] : undefined

  if (!image) return <PhotoPlaceholder className={className} />
  if (isLoading) return <div aria-hidden className={`h-full w-full animate-pulse bg-sunken ${className}`} />
  if (!url || failures > 1) return <PhotoPlaceholder label="Photo unavailable" className={className} />

  return (
    <img
      src={url}
      alt={alt}
      width={variant === 'thumb' ? 480 : 1600}
      height={variant === 'thumb' ? 360 : 1200}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => {
        setFailures((f) => f + 1)
        if (failures === 0) void refresh(images)
      }}
      className={`h-full w-full object-cover ${className}`}
    />
  )
}
