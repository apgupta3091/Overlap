import { z } from 'zod'
import { centsToInput, parseDollarsToCents } from './money'
import {
  LAUNDRY_VALUES,
  PET_VALUES,
  TRI_STATE_VALUES,
  type Listing,
  type ListingFields,
} from './types'
import { validateListingUrl } from './url'

export const TEXT_LIMITS = {
  title: 120,
  address: 200,
  neighborhood: 80,
  note: 2000,
  tourNote: 280,
  boardName: 80,
  locationLabel: 80,
  displayName: 50,
} as const

export const MAX_RENT_CENTS = 100_000_00 // $100,000/mo — guards against typos
export const MAX_FEE_CENTS = 100_000_00

/** Raw form values: every input is a string so blank can mean "unknown". */
export interface ListingFormValues {
  listingUrl: string
  baseRent: string
  title: string
  address: string
  neighborhood: string
  bedrooms: string
  bathrooms: string
  squareFeet: string
  parking: string
  petFee: string
  otherMonthlyFees: string
  utilities: string
  securityDeposit: string
  oneTimeFees: string
  freeMonths: string
  leaseMonths: string
  laundry: (typeof LAUNDRY_VALUES)[number]
  pets: (typeof PET_VALUES)[number]
  outdoorSpace: (typeof TRI_STATE_VALUES)[number]
  elevator: (typeof TRI_STATE_VALUES)[number]
  commuteMinutes: string
  availableFrom: string
  initialNote: string
}

export const EMPTY_LISTING_FORM: ListingFormValues = {
  listingUrl: '',
  baseRent: '',
  title: '',
  address: '',
  neighborhood: '',
  bedrooms: '',
  bathrooms: '',
  squareFeet: '',
  parking: '',
  petFee: '',
  otherMonthlyFees: '',
  utilities: '',
  securityDeposit: '',
  oneTimeFees: '',
  freeMonths: '',
  leaseMonths: '',
  laundry: 'unknown',
  pets: 'unknown',
  outdoorSpace: 'unknown',
  elevator: 'unknown',
  commuteMinutes: '',
  availableFrom: '',
  initialNote: '',
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === '' ? null : v))

/** Optional non-negative money: blank → null (unknown). */
const optionalMoney = (label: string) =>
  z.string().transform((raw, ctx) => {
    const cents = parseDollarsToCents(raw)
    if (cents === null) return null
    if (Number.isNaN(cents)) {
      ctx.addIssue({ code: 'custom', message: `Enter ${label} as a dollar amount, like 150 or 150.50.` })
      return z.NEVER
    }
    if (cents < 0) {
      ctx.addIssue({ code: 'custom', message: `${label} can’t be negative.` })
      return z.NEVER
    }
    if (cents > MAX_FEE_CENTS) {
      ctx.addIssue({ code: 'custom', message: `${label} looks too large.` })
      return z.NEVER
    }
    return cents
  })

function parseNumber(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(t)) return Number.NaN
  return Number(t)
}

const optionalNumber = (
  label: string,
  opts: { min: number; max: number; step?: 'integer' | 'half'; minExclusive?: boolean },
) =>
  z.string().transform((raw, ctx) => {
    const n = parseNumber(raw)
    if (n === null) return null
    const step = opts.step ?? 'integer'
    const stepOk = step === 'integer' ? Number.isInteger(n) : Number.isInteger(n * 2)
    if (Number.isNaN(n) || !stepOk) {
      ctx.addIssue({
        code: 'custom',
        message: step === 'integer' ? `${label} must be a whole number.` : `${label} must be in steps of 0.5.`,
      })
      return z.NEVER
    }
    if (opts.minExclusive ? n <= opts.min : n < opts.min) {
      ctx.addIssue({
        code: 'custom',
        message: opts.minExclusive ? `${label} must be greater than ${opts.min}.` : `${label} can’t be negative.`,
      })
      return z.NEVER
    }
    if (n > opts.max) {
      ctx.addIssue({ code: 'custom', message: `${label} must be ${opts.max} or less.` })
      return z.NEVER
    }
    return n
  })

export const listingFormSchema = z
  .object({
    listingUrl: z.string().transform((raw, ctx) => {
      const result = validateListingUrl(raw)
      if (!result.ok) {
        ctx.addIssue({ code: 'custom', message: result.reason })
        return z.NEVER
      }
      return raw.trim()
    }),
    baseRent: z.string().transform((raw, ctx) => {
      const cents = parseDollarsToCents(raw)
      if (cents === null) {
        ctx.addIssue({ code: 'custom', message: 'Enter the monthly rent.' })
        return z.NEVER
      }
      if (Number.isNaN(cents)) {
        ctx.addIssue({ code: 'custom', message: 'Enter rent as a dollar amount, like 2450.' })
        return z.NEVER
      }
      if (cents <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Rent must be more than $0.' })
        return z.NEVER
      }
      if (cents > MAX_RENT_CENTS) {
        ctx.addIssue({ code: 'custom', message: 'Rent looks too large — check for typos.' })
        return z.NEVER
      }
      return cents
    }),
    title: optionalText(TEXT_LIMITS.title, 'Title'),
    address: optionalText(TEXT_LIMITS.address, 'Address'),
    neighborhood: optionalText(TEXT_LIMITS.neighborhood, 'Neighborhood'),
    bedrooms: optionalNumber('Bedrooms', { min: 0, max: 20 }),
    bathrooms: optionalNumber('Bathrooms', { min: 0, max: 20, step: 'half' }),
    squareFeet: optionalNumber('Square feet', { min: 0, max: 100_000, minExclusive: true }),
    parking: optionalMoney('Parking'),
    petFee: optionalMoney('Pet fee'),
    otherMonthlyFees: optionalMoney('Other monthly fees'),
    utilities: optionalMoney('Utilities'),
    securityDeposit: optionalMoney('Security deposit'),
    oneTimeFees: optionalMoney('One-time fees'),
    freeMonths: optionalNumber('Free months', { min: 0, max: 24, step: 'half' }),
    leaseMonths: optionalNumber('Lease length', { min: 0, max: 60, minExclusive: true }),
    laundry: z.enum(LAUNDRY_VALUES),
    pets: z.enum(PET_VALUES),
    outdoorSpace: z.enum(TRI_STATE_VALUES),
    elevator: z.enum(TRI_STATE_VALUES),
    commuteMinutes: optionalNumber('Commute', { min: 0, max: 600 }),
    availableFrom: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a valid date.')
      .transform((v) => (v === '' ? null : v)),
    initialNote: optionalText(TEXT_LIMITS.note, 'Note'),
  })
  .superRefine((v, ctx) => {
    if (v.freeMonths !== null && v.freeMonths > 0 && v.leaseMonths === null) {
      ctx.addIssue({ code: 'custom', path: ['leaseMonths'], message: 'Add the lease length to use a free-rent concession.' })
    }
    if (v.freeMonths !== null && v.leaseMonths !== null && v.freeMonths > v.leaseMonths) {
      ctx.addIssue({ code: 'custom', path: ['freeMonths'], message: 'Free months can’t exceed the lease length.' })
    }
  })

export type ListingFormOutput = z.output<typeof listingFormSchema>

export function formOutputToFields(v: ListingFormOutput): { fields: ListingFields; initialNote: string | null } {
  return {
    fields: {
      listingUrl: v.listingUrl,
      title: v.title,
      address: v.address,
      neighborhood: v.neighborhood,
      baseRentCents: v.baseRent,
      parkingCents: v.parking,
      petFeeCents: v.petFee,
      otherMonthlyFeesCents: v.otherMonthlyFees,
      utilitiesCents: v.utilities,
      securityDepositCents: v.securityDeposit,
      oneTimeFeesCents: v.oneTimeFees,
      leaseMonths: v.leaseMonths,
      freeMonths: v.freeMonths,
      bedrooms: v.bedrooms,
      bathrooms: v.bathrooms,
      squareFeet: v.squareFeet,
      laundry: v.laundry,
      pets: v.pets,
      outdoorSpace: v.outdoorSpace,
      elevator: v.elevator,
      commuteMinutes: v.commuteMinutes,
      availableFrom: v.availableFrom,
    },
    initialNote: v.initialNote,
  }
}

const numToInput = (n: number | null) => (n === null ? '' : String(n))

export function listingToFormValues(l: Listing): ListingFormValues {
  return {
    listingUrl: l.listingUrl,
    baseRent: centsToInput(l.baseRentCents),
    title: l.title ?? '',
    address: l.address ?? '',
    neighborhood: l.neighborhood ?? '',
    bedrooms: numToInput(l.bedrooms),
    bathrooms: numToInput(l.bathrooms),
    squareFeet: numToInput(l.squareFeet),
    parking: centsToInput(l.parkingCents),
    petFee: centsToInput(l.petFeeCents),
    otherMonthlyFees: centsToInput(l.otherMonthlyFeesCents),
    utilities: centsToInput(l.utilitiesCents),
    securityDeposit: centsToInput(l.securityDepositCents),
    oneTimeFees: centsToInput(l.oneTimeFeesCents),
    freeMonths: numToInput(l.freeMonths),
    leaseMonths: numToInput(l.leaseMonths),
    laundry: l.laundry,
    pets: l.pets,
    outdoorSpace: l.outdoorSpace,
    elevator: l.elevator,
    commuteMinutes: numToInput(l.commuteMinutes),
    availableFrom: l.availableFrom ?? '',
    initialNote: '',
  }
}

/** Board create/edit form */
export const boardFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the board a name.')
    .max(TEXT_LIMITS.boardName, `Name must be ${TEXT_LIMITS.boardName} characters or fewer.`),
  locationLabel: optionalText(TEXT_LIMITS.locationLabel, 'Location'),
  monthlyBudget: z.string().transform((raw, ctx) => {
    const cents = parseDollarsToCents(raw)
    if (cents === null) return null
    if (Number.isNaN(cents) || cents <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Enter the total monthly budget in dollars, like 4200.' })
      return z.NEVER
    }
    if (cents > MAX_RENT_CENTS) {
      ctx.addIssue({ code: 'custom', message: 'Budget looks too large.' })
      return z.NEVER
    }
    return cents
  }),
})
export type BoardFormValues = z.input<typeof boardFormSchema>
export type BoardFormOutput = z.output<typeof boardFormSchema>

export const noteSchema = z
  .string()
  .trim()
  .min(1, 'Write something first.')
  .max(TEXT_LIMITS.note, `Notes can be up to ${TEXT_LIMITS.note.toLocaleString()} characters.`)
