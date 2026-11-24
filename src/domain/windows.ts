/**
 * Meeting-window suggestions.
 *
 * Algorithm (simple and deterministic):
 * 1. Enumerate windows: within each candidate range, every run of `duration / 30` consecutive slots
 *    whose timestamps are exactly contiguous. Windows never cross a range boundary or a gap.
 * 2. Score each window. A respondent can attend only if they are available or preferred for *every*
 *    slot in it, and prefers it only if *every* slot is preferred. "None of these times work"
 *    responses can't attend anything.
 * 3. Rank by: (a) attendees desc, (b) preferrers desc, (c) earliest UTC start.
 * 4. Pick suggestions greedily: take the top window, then walk down the ranking taking only windows
 *    that don't overlap any already-picked suggestion, up to 3. Fewer are returned if no further
 *    non-overlapping window exists. Windows nobody can attend are never suggested.
 */
import { SLOT_MINUTES } from './limits.ts'
import { stateOf } from './results.ts'
import { instantMs } from './time.ts'
import type { EventSlot, MeetingWindow, ParticipantResponse, ScoredWindow } from './types.ts'

export const MAX_SUGGESTIONS = 3

function byStart(a: EventSlot, b: EventSlot) {
  return instantMs(a.startAt) - instantMs(b.startAt)
}

export function enumerateWindows(slots: readonly EventSlot[], durationMinutes: number): MeetingWindow[] {
  const size = durationMinutes / SLOT_MINUTES
  if (!Number.isInteger(size) || size < 1) return []
  const byRange = new Map<string, EventSlot[]>()
  for (const s of slots) {
    const list = byRange.get(s.rangeId) ?? []
    list.push(s)
    byRange.set(s.rangeId, list)
  }
  const windows: MeetingWindow[] = []
  for (const [rangeId, list] of byRange) {
    list.sort(byStart)
    for (let i = 0; i + size <= list.length; i++) {
      const run = list.slice(i, i + size)
      const contiguous = run.every((s, k) => k === 0 || instantMs(run[k - 1]!.endAt) === instantMs(s.startAt))
      if (!contiguous) continue
      windows.push({ rangeId, slotIds: run.map((s) => s.id), startAt: run[0]!.startAt, endAt: run[run.length - 1]!.endAt })
    }
  }
  return windows.sort((a, b) => instantMs(a.startAt) - instantMs(b.startAt))
}

export function scoreWindow(window: MeetingWindow, responses: readonly ParticipantResponse[]): ScoredWindow {
  const availableIds: string[] = []
  const preferredIds: string[] = []
  const unavailableIds: string[] = []
  for (const r of responses) {
    const states = window.slotIds.map((id) => stateOf(r, id))
    if (states.every((s) => s !== null)) {
      availableIds.push(r.id)
      if (states.every((s) => s === 'preferred')) preferredIds.push(r.id)
    } else {
      unavailableIds.push(r.id)
    }
  }
  return { ...window, availableIds, preferredIds, unavailableIds }
}

export function compareScored(a: ScoredWindow, b: ScoredWindow): number {
  return (
    b.availableIds.length - a.availableIds.length ||
    b.preferredIds.length - a.preferredIds.length ||
    instantMs(a.startAt) - instantMs(b.startAt)
  )
}

export function rankWindows(windows: readonly MeetingWindow[], responses: readonly ParticipantResponse[]): ScoredWindow[] {
  return windows.map((w) => scoreWindow(w, responses)).sort(compareScored)
}

export function windowsOverlap(a: Pick<MeetingWindow, 'startAt' | 'endAt'>, b: Pick<MeetingWindow, 'startAt' | 'endAt'>): boolean {
  return instantMs(a.startAt) < instantMs(b.endAt) && instantMs(b.startAt) < instantMs(a.endAt)
}

export function suggestWindows(
  slots: readonly EventSlot[],
  responses: readonly ParticipantResponse[],
  durationMinutes: number,
  max = MAX_SUGGESTIONS,
): ScoredWindow[] {
  if (responses.length === 0) return []
  const ranked = rankWindows(enumerateWindows(slots, durationMinutes), responses)
  const picked: ScoredWindow[] = []
  for (const w of ranked) {
    if (picked.length >= max) break
    if (w.availableIds.length === 0) break // ranked: nothing better follows
    if (picked.some((p) => windowsOverlap(p, w))) continue
    picked.push(w)
  }
  return picked
}

/**
 * Find the valid meeting window starting at `startAt` (used to validate an organizer's manual
 * choice and the server's finalize request). Returns null if it isn't a full, contiguous window.
 */
export function findWindow(slots: readonly EventSlot[], startAt: string, durationMinutes: number): MeetingWindow | null {
  const target = instantMs(startAt)
  return enumerateWindows(slots, durationMinutes).find((w) => instantMs(w.startAt) === target) ?? null
}
