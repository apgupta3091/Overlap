// The /demo event: a study group a few days out, with five responses. Built relative to "now" so the
// dates are always upcoming, and generated through the real schedule code.
import { buildSchedule } from '../domain/schedule.ts'
import { Temporal, todayIn } from '../domain/time.ts'
import type { OverlapEvent, ParticipantResponse, SlotState } from '../domain/types.ts'
import type { StoredEvent } from '../data/localService'

export const DEMO_ID = 'demo'
export const DEMO_TZ = 'America/New_York'

// One string per date, one character per half-hour: "." unavailable, "a" available, "p" preferred.
const PEOPLE: { name: string; days?: [string, string, string]; noneWork?: boolean }[] = [
  { name: 'Priya', days: ['aappaa..', '..aaaa..', 'aaaaaaaa'] },
  { name: 'Marcus', days: ['..ppaaaa', 'aaaa....', '....aaaa'] },
  { name: 'Lena', days: ['aaaaaa..', '........', '..ppaa..'] },
  { name: 'Jordan', days: ['..aaaa..', '..aapp..', 'aaaa....'] },
  { name: 'Alex', noneWork: true },
]

export function buildDemoEvent(now: Temporal.Instant = Temporal.Now.instant()): StoredEvent {
  const today = todayIn(DEMO_TZ, now)
  const dates = [1, 2, 3].map((d) => today.add({ days: d }).toString())
  const schedule = buildSchedule(
    {
      timezone: DEMO_TZ,
      durationMinutes: 60,
      ranges: [
        { date: dates[0]!, start: '16:00', end: '20:00' },
        { date: dates[1]!, start: '16:00', end: '20:00' },
        { date: dates[2]!, start: '10:00', end: '14:00' },
      ],
    },
    now,
  )
  if (!schedule.ok) throw new Error(`Demo schedule invalid: ${JSON.stringify(schedule.issues)}`)

  const ranges: OverlapEvent['ranges'] = []
  const slots: OverlapEvent['slots'] = []
  schedule.value.ranges.forEach((r, ri) => {
    const rangeId = `demo-r${ri}`
    ranges.push({ id: rangeId, originalLocalDate: r.originalLocalDate, startAt: r.startAt, endAt: r.endAt })
    r.slots.forEach((s, si) => slots.push({ id: `demo-r${ri}-s${si}`, rangeId, startAt: s.startAt, endAt: s.endAt, sortOrder: s.sortOrder }))
  })

  const created = now.subtract({ hours: 26 })
  const responses: ParticipantResponse[] = PEOPLE.map((p, i) => {
    const marked: Record<string, SlotState> = {}
    p.days?.forEach((pattern, ri) =>
      [...pattern].forEach((ch, si) => {
        if (ch === 'a') marked[`demo-r${ri}-s${si}`] = 'available'
        if (ch === 'p') marked[`demo-r${ri}-s${si}`] = 'preferred'
      }),
    )
    const at = created.add({ minutes: 40 * (i + 1) }).toString()
    return { id: `demo-p${i}`, displayName: p.name, noneWork: p.noneWork ?? false, revision: 1, createdAt: at, updatedAt: at, slots: marked }
  })

  const event: OverlapEvent = {
    publicId: DEMO_ID,
    title: 'Chem 101 midterm review',
    description: 'Let’s go through the practice exam together. Library group room or video call, whatever works.',
    organizerName: 'Priya',
    timezone: DEMO_TZ,
    durationMinutes: 60,
    expectedParticipants: 6,
    status: 'open',
    finalStartAt: null,
    finalEndAt: null,
    revision: 1,
    createdAt: created.toString(),
    updatedAt: created.toString(),
    expiresAt: schedule.value.expiresAt,
    ranges,
    slots,
  }
  return { event, responses, adminToken: 'demo-admin', editTokens: {} }
}
