import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '../app/routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

describe('routes', () => {
  it.each([
    ['/', /find a time together/i],
    ['/new', /create an event/i],
    ['/e/abc123', /event/i],
    ['/demo', /demo/i],
    ['/privacy', /privacy/i],
    ['/nope', /doesn’t exist/i],
  ])('%s renders its page', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })
})
