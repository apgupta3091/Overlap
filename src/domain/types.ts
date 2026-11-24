// Core domain types. All instants are ISO-8601 UTC strings as produced by Temporal.Instant#toString
// (e.g. "2027-03-14T06:30:00Z"). Local dates are "YYYY-MM-DD"; local times "HH:MM".

export type SlotState = 'available' | 'preferred'
export type EventStatus = 'open' | 'finalized'

/** A candidate range as the organizer entered it, in the event's timezone. */
export interface LocalRangeInput {
  date: string
  start: string
  /** "24:00" means midnight at the end of `date`. */
  end: string
}

export interface EventRange {
  id: string
  /** The candidate date in the event's original timezone. */
  originalLocalDate: string
  startAt: string
  endAt: string
}

export interface EventSlot {
  id: string
  rangeId: string
  startAt: string
  endAt: string
  sortOrder: number
}

/** Sanitized, client-safe event. Never contains token hashes. */
export interface OverlapEvent {
  publicId: string
  title: string
  description: string | null
  organizerName: string
  timezone: string
  durationMinutes: number
  expectedParticipants: number | null
  status: EventStatus
  finalStartAt: string | null
  finalEndAt: string | null
  revision: number
  createdAt: string
  updatedAt: string
  expiresAt: string
  ranges: EventRange[]
  slots: EventSlot[]
}

/** A submitted response. Absence of a slot id in `slots` means unavailable. */
export interface ParticipantResponse {
  id: string
  displayName: string
  noneWork: boolean
  revision: number
  createdAt: string
  updatedAt: string
  slots: Record<string, SlotState>
}

/** A meeting-length run of contiguous slots inside one candidate range. */
export interface MeetingWindow {
  rangeId: string
  slotIds: string[]
  startAt: string
  endAt: string
}

export interface ScoredWindow extends MeetingWindow {
  /** Response ids available (available or preferred) for every slot. */
  availableIds: string[]
  /** Response ids preferring every slot. */
  preferredIds: string[]
  /** Response ids that cannot attend the whole window. */
  unavailableIds: string[]
}
