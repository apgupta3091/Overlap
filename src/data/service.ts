// The client's view of the Overlap API. Week 1 uses a local implementation (localService.ts);
// Chunk 9 adds a live implementation backed by the Edge Function with the same contract.
import type { AvailabilityPayload } from '../domain/availability.ts'
import type { LocalRangeInput, OverlapEvent, ParticipantResponse } from '../domain/types.ts'

export interface CreateEventInput {
  title: string
  description: string | null
  organizerName: string
  timezone: string
  durationMinutes: number
  expectedParticipants: number | null
  ranges: LocalRangeInput[]
}

export interface EventSnapshot {
  event: OverlapEvent
  /** Submitted responses only. */
  responses: ParticipantResponse[]
}

export interface ResponseInput {
  displayName: string
  noneWork: boolean
  availability: AvailabilityPayload
}

export interface EventService {
  createEvent(input: CreateEventInput): Promise<{ publicId: string; adminToken: string }>
  getEvent(publicId: string): Promise<EventSnapshot>
  createResponse(publicId: string, input: ResponseInput): Promise<{ response: ParticipantResponse; editToken: string }>
  updateResponse(publicId: string, responseId: string, editToken: string, input: ResponseInput): Promise<{ response: ParticipantResponse }>
}
