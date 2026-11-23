import { Link } from 'react-router'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 rounded-lg font-semibold tracking-tight text-ink">
      <svg aria-hidden viewBox="0 0 32 32" className="size-7">
        <rect width="32" height="32" rx="7" fill="#B4532A" />
        <path d="M9 15.5 16 9l7 6.5V23a1 1 0 0 1-1 1h-4v-5h-4v5h-4a1 1 0 0 1-1-1z" fill="#FAF7F2" />
      </svg>
      <span className="text-lg">Shortlist</span>
    </Link>
  )
}
