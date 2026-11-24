import { Link } from 'react-router'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 rounded-lg font-semibold tracking-tight text-ink">
      <svg aria-hidden viewBox="0 0 32 32" className="size-7">
        <rect width="32" height="32" rx="8" fill="#2E5E8C" />
        <circle cx="13" cy="16" r="7" fill="none" stroke="#F8F5EF" strokeWidth="2.5" />
        <circle cx="19" cy="16" r="7" fill="none" stroke="#F8F5EF" strokeWidth="2.5" />
      </svg>
      <span className="text-lg">Overlap</span>
    </Link>
  )
}
