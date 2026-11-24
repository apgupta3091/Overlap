import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '../test/render'

describe('routes', () => {
  it.each([
    ['/', /find a time together/i],
    ['/new', /create an event/i],
    ['/privacy', /privacy/i],
    ['/nope', /doesn’t exist/i],
  ])('%s renders its page', (path, heading) => {
    renderRoute(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('/demo renders the demo event', async () => {
    renderRoute('/demo')
    expect(await screen.findByRole('heading', { level: 1, name: /chem 101/i })).toBeInTheDocument()
  })

  it('/e/:id shows a not-found state for unknown events', async () => {
    renderRoute('/e/abc123')
    expect(await screen.findByRole('heading', { level: 1, name: /couldn’t find this event/i })).toBeInTheDocument()
  })
})
