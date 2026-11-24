import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getCredentials } from '../../data/credentials'
import { loadDraft } from '../../data/drafts'
import { renderRoute, testClient } from '../../test/render'

async function createEvent(client = testClient()) {
  const user = userEvent.setup()
  const utils = renderRoute('/new', client)
  await user.type(screen.getByLabelText('Event title'), 'Book club')
  await user.type(screen.getByLabelText(/^Your name/), 'Ana')
  await user.selectOptions(screen.getByLabelText('Meeting length'), '30')
  await user.selectOptions(screen.getByLabelText('From'), '09:00')
  await user.selectOptions(screen.getByLabelText('Until'), '10:00')
  await user.click(screen.getByRole('button', { name: 'Create event' }))
  await screen.findByRole('heading', { level: 1, name: 'Book club' })
  return { user, client, ...utils }
}

const cells = () => within(screen.getByRole('table', { name: 'Your availability' })).getAllByRole('button')

describe('create → respond → results', () => {
  it('shows field errors instead of submitting an incomplete form', async () => {
    const user = userEvent.setup()
    renderRoute('/new', testClient())
    await user.click(screen.getByRole('button', { name: 'Create event' }))
    expect(screen.getByText('Give the event a title.')).toBeInTheDocument()
    expect(screen.getByText('Enter a name.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Event title')).toHaveFocus())
  })

  it('explains schedule problems on the date row', async () => {
    const user = userEvent.setup()
    renderRoute('/new', testClient())
    await user.type(screen.getByLabelText('Event title'), 'X')
    await user.type(screen.getByLabelText(/^Your name/), 'Ana')
    await user.selectOptions(screen.getByLabelText('From'), '18:00')
    await user.selectOptions(screen.getByLabelText('Until'), '09:00')
    await user.click(screen.getByRole('button', { name: 'Create event' }))
    expect(screen.getByText(/end time must be after the start time/i)).toBeInTheDocument()
  })

  it('creates an event, then lets the organizer respond and see results', async () => {
    const { user, client, router } = await createEvent()
    const publicId = router.state.location.pathname.split('/').pop()!
    expect(getCredentials(client.store, publicId).adminToken).toBeTruthy()
    expect(screen.getByText(/your event is ready/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Event link')).toHaveValue(`${window.location.origin}/e/${publicId}`)

    // 9:00–10:00 → two half-hour cells.
    expect(cells()).toHaveLength(2)
    await user.type(screen.getAllByLabelText(/^Your name/).at(-1)!, 'Ana')
    await user.click(cells()[0]!)
    expect(cells()[0]).toHaveAccessibleName(/available$/)

    // Switch to Preferred and mark the second cell.
    await user.click(screen.getByLabelText('Preferred'))
    await user.click(cells()[1]!)
    expect(cells()[1]).toHaveAccessibleName(/preferred$/)

    // Draft saved while editing.
    expect(loadDraft(client.store, publicId)?.availability.preferred).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Submit availability' }))
    expect(await screen.findByRole('tab', { name: 'Group results (1)', selected: true })).toBeInTheDocument()
    expect(loadDraft(client.store, publicId)).toBeNull()
    expect(screen.getByText('Top pick')).toBeInTheDocument()
    expect(screen.getAllByText('The 1 respondent is available').length).toBeGreaterThan(0)
    expect(within(screen.getByRole("region", { name: /who’s responded/i })).getByText("Ana (you)")).toBeInTheDocument()

    // Editing reuses the same response.
    await user.click(screen.getByRole('tab', { name: 'Your availability' }))
    await user.click(screen.getByLabelText('Available'))
    await user.click(cells()[0]!) // available → cleared
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('tab', { name: 'Group results (1)', selected: true })).toBeInTheDocument()
  })

  it('requires a time or “none work”, and accepts “none work”', async () => {
    const { user } = await createEvent()
    await user.type(screen.getAllByLabelText(/^Your name/).at(-1)!, 'Ben')
    await user.click(screen.getByRole('button', { name: 'Submit availability' }))
    expect(screen.getByText(/mark at least one time/i)).toBeInTheDocument()

    await user.click(screen.getByLabelText('None of these times work for me'))
    expect(cells()[0]).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Submit availability' }))
    expect(await screen.findByText('No 30-minute stretch works for anyone yet.', { exact: false })).toBeInTheDocument()
  })

  it('supports keyboard: arrows move focus, Space toggles', async () => {
    const { user } = await createEvent()
    cells()[0]!.focus()
    await user.keyboard('{ArrowDown}')
    expect(cells()[1]).toHaveFocus()
    expect(cells()[1]).toHaveAttribute('tabindex', '0')
    expect(cells()[0]).toHaveAttribute('tabindex', '-1')
    await user.keyboard(' ')
    expect(cells()[1]).toHaveAccessibleName(/available$/)
    await user.keyboard('{ArrowUp}{Enter}')
    expect(cells()[0]).toHaveAccessibleName(/available$/)
  })

  it('restores an unsaved draft after a reload, and can discard it', async () => {
    const { user, client, router, unmount } = await createEvent()
    const path = router.state.location.pathname
    await user.type(screen.getAllByLabelText(/^Your name/).at(-1)!, 'Cy')
    await user.click(cells()[0]!)
    unmount()

    renderRoute(path, client)
    expect(await screen.findByText(/restored changes/i)).toBeInTheDocument()
    expect(cells()[0]).toHaveAccessibleName(/available$/)
    expect(screen.getAllByLabelText(/^Your name/).at(-1)).toHaveValue('Cy')
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(cells()[0]).toHaveAccessibleName(/not available$/)
  })
})

describe('demo', () => {
  it('shows ranked suggestions and who can attend each slot', async () => {
    const user = userEvent.setup()
    renderRoute('/demo')
    await screen.findByRole('heading', { level: 1, name: /chem 101/i })
    await user.click(screen.getByRole('tab', { name: 'Group results (5)' }))
    expect(screen.getByText('5 of 6 expected participants have responded.')).toBeInTheDocument()
    expect(screen.getByText('Top pick')).toBeInTheDocument()
    expect(screen.getAllByText(/Can’t make it:/).length).toBeGreaterThan(0)

    const heat = screen.getByRole('table', { name: 'Group availability by time' })
    const first = within(heat).getAllByRole('button')[0]!
    await user.click(first)
    expect(first).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 4, name: /Can’t make it/ })).toBeInTheDocument()
  })

  it('lets a visitor add themselves and updates the results', async () => {
    const user = userEvent.setup()
    renderRoute('/demo')
    await screen.findByRole('heading', { level: 1, name: /chem 101/i })
    await user.type(screen.getAllByLabelText(/^Your name/).at(-1)!, 'Visitor')
    await user.click(cells()[2]!)
    await user.click(cells()[3]!)
    await user.click(screen.getByRole('button', { name: 'Submit availability' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Group results (6)', selected: true })).toBeInTheDocument())
    expect(screen.getByText('6 of 6 expected participants have responded.')).toBeInTheDocument()
  })
})
