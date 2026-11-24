// Product limits. Shared by client validation and the server (which enforces them authoritatively).

export const SLOT_MINUTES = 30
export const MEETING_DURATIONS = [30, 60, 90, 120] as const
export type MeetingDuration = (typeof MEETING_DURATIONS)[number]

export const LIMITS = {
  minDates: 1,
  maxDates: 7,
  /** Maximum days between the first and last selected date (inclusive span of 31 calendar days). */
  maxSpanDays: 30,
  maxRangeMinutes: 12 * 60,
  maxResponses: 50,
  titleMax: 100,
  descriptionMax: 500,
  organizerNameMax: 40,
  participantNameMax: 40,
  expectedMin: 2,
  expectedMax: 50,
  /** Event data expires this many days after the end of the final candidate range. */
  expiryDays: 30,
} as const
