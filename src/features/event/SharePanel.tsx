import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

export function eventUrl(publicId: string): string {
  return `${window.location.origin}/e/${publicId}`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function CopyLinkButton({ url, size = 'md', variant = 'secondary' }: { url: string; size?: 'sm' | 'md'; variant?: 'primary' | 'secondary' }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size={size}
      variant={variant}
      icon={copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      onClick={async () => {
        if (await copyText(url)) {
          setCopied(true)
          toast.success('Link copied')
          setTimeout(() => setCopied(false), 2000)
        } else {
          toast.error('Couldn’t copy automatically. Select the link and copy it.')
        }
      }}
    >
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  )
}

/** Organizer's share box: the link in a selectable field plus a copy button. */
export function SharePanel({ publicId, justCreated, localOnly }: { publicId: string; justCreated: boolean; localOnly: boolean }) {
  const url = eventUrl(publicId)
  return (
    <section aria-labelledby="share-heading" className="rounded-xl border border-accent/25 bg-accent-soft p-4">
      <h2 id="share-heading" className="font-semibold">
        {justCreated ? 'Your event is ready. Share the link with your group.' : 'Share this event'}
      </h2>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="share-url">
          Event link
        </label>
        <input
          id="share-url"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink"
        />
        <CopyLinkButton url={url} variant="primary" />
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        {localOnly
          ? 'Preview build: this event is saved only in this browser, so the link won’t open for others yet. Shared links arrive with the online version.'
          : 'Anyone with the link can add their availability. No accounts needed.'}
      </p>
    </section>
  )
}
