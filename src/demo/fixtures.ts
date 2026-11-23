// Fictional demo data. All listings, people, and links are made up and labeled as demo content.
import type { Board, Listing, ListingImage, Member, Note, Tour, Vote } from '../domain/types'
import { normalizeListingUrl } from '../domain/url'

export const DEMO_BOARD_ID = 'demo'
export const DEMO_USER_ID = 'demo-you'
export const DEMO_MAYA_ID = 'demo-maya'
export const DEMO_JORDAN_ID = 'demo-jordan'

export interface DemoState {
  version: 1
  board: Board
  members: Member[]
  listings: Listing[]
  images: ListingImage[]
  votes: Vote[]
  notes: Note[]
  tours: Tour[]
}

const DAY = 24 * 60 * 60 * 1000

function at(now: Date, dayOffset: number, hour = 0, minute = 0): string {
  const d = new Date(now.getTime() + dayOffset * DAY)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

type Seed = Partial<Listing> & Pick<Listing, 'id' | 'listingUrl' | 'baseRentCents'>

const defaults = (now: Date): Omit<Listing, 'id' | 'listingUrl' | 'normalizedListingUrl' | 'baseRentCents'> => ({
  boardId: DEMO_BOARD_ID,
  createdBy: DEMO_USER_ID,
  updatedBy: DEMO_USER_ID,
  title: null,
  address: null,
  neighborhood: null,
  parkingCents: null,
  petFeeCents: null,
  otherMonthlyFeesCents: null,
  utilitiesCents: null,
  securityDepositCents: null,
  oneTimeFeesCents: null,
  leaseMonths: null,
  freeMonths: null,
  bedrooms: null,
  bathrooms: null,
  squareFeet: null,
  laundry: 'unknown',
  pets: 'unknown',
  outdoorSpace: 'unknown',
  elevator: 'unknown',
  commuteMinutes: null,
  availableFrom: null,
  status: 'saved',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
})

export function createDemoSeed(now: Date = new Date()): DemoState {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const make = (s: Seed): Listing => ({
    ...defaults(now),
    ...s,
    normalizedListingUrl: normalizeListingUrl(s.listingUrl),
    updatedAt: s.updatedAt ?? s.createdAt ?? now.toISOString(),
  })

  const listings: Listing[] = [
    make({
      id: 'demo-washington',
      listingUrl: 'https://listings.example.com/hoboken/washington-st-2br-4f',
      title: 'Sunny 2BR off Washington St',
      address: '412 Bloomfield St, Apt 4F',
      neighborhood: 'Hoboken',
      baseRentCents: 365000,
      parkingCents: 0,
      petFeeCents: 0,
      otherMonthlyFeesCents: 0,
      utilitiesCents: 16000,
      securityDepositCents: 365000,
      oneTimeFeesCents: 0,
      leaseMonths: 12,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 880,
      laundry: 'in_unit',
      pets: 'allowed',
      outdoorSpace: 'no',
      elevator: 'no',
      commuteMinutes: 28,
      availableFrom: at(now, 30).slice(0, 10),
      status: 'tour_scheduled',
      createdAt: at(now, -9, 19, 12),
      updatedBy: DEMO_MAYA_ID,
    }),
    make({
      id: 'demo-paulus',
      listingUrl: 'https://listings.example.com/jersey-city/paulus-hook-2br-balcony',
      title: 'Paulus Hook 2BR with balcony',
      address: '88 Sussex St, Unit 1203',
      neighborhood: 'Paulus Hook, Jersey City',
      baseRentCents: 395000,
      parkingCents: null,
      petFeeCents: 5000,
      otherMonthlyFeesCents: 7500,
      utilitiesCents: 18000,
      securityDepositCents: 395000,
      oneTimeFeesCents: 50000,
      leaseMonths: 13,
      freeMonths: 1,
      bedrooms: 2,
      bathrooms: 2,
      squareFeet: 1010,
      laundry: 'in_unit',
      pets: 'allowed',
      outdoorSpace: 'yes',
      elevator: 'yes',
      commuteMinutes: 18,
      status: 'shortlisted',
      createdAt: at(now, -7, 21, 4),
    }),
    make({
      id: 'demo-journal',
      listingUrl: 'https://listings.example.com/jersey-city/journal-square-tower-2br?unit=2814',
      title: 'Journal Square high-rise 2BR',
      address: '30 Journal Square Plaza, #2814',
      neighborhood: 'Journal Square, Jersey City',
      baseRentCents: 315000,
      parkingCents: 25000,
      petFeeCents: null,
      otherMonthlyFeesCents: 10000,
      utilitiesCents: null,
      securityDepositCents: null,
      oneTimeFeesCents: 35000,
      leaseMonths: 14,
      freeMonths: 2,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 930,
      laundry: 'in_building',
      pets: 'unknown',
      outdoorSpace: 'no',
      elevator: 'yes',
      commuteMinutes: 32,
      status: 'saved',
      createdAt: at(now, -5, 12, 40),
      createdBy: DEMO_MAYA_ID,
      updatedBy: DEMO_MAYA_ID,
    }),
    make({
      id: 'demo-heights',
      listingUrl: 'https://listings.example.com/jersey-city/the-heights-garden-2br',
      title: null,
      address: '214 Palisade Ave, Garden Level',
      neighborhood: 'The Heights, Jersey City',
      baseRentCents: 275000,
      petFeeCents: 4000,
      bedrooms: 2,
      bathrooms: 1,
      laundry: 'none',
      pets: 'allowed',
      outdoorSpace: 'yes',
      elevator: 'no',
      commuteMinutes: 41,
      status: 'saved',
      createdAt: at(now, -3, 9, 15),
      createdBy: DEMO_JORDAN_ID,
      updatedBy: DEMO_JORDAN_ID,
    }),
    make({
      id: 'demo-uptown',
      listingUrl: 'https://listings.example.com/hoboken/uptown-3br-walkup',
      title: 'Uptown Hoboken 3BR walk-up',
      address: '1032 Park Ave, 3rd floor',
      neighborhood: 'Uptown Hoboken',
      baseRentCents: 440000,
      parkingCents: 0,
      otherMonthlyFeesCents: 0,
      utilitiesCents: 22000,
      securityDepositCents: 660000,
      oneTimeFeesCents: 0,
      leaseMonths: 12,
      bedrooms: 3,
      bathrooms: 1.5,
      squareFeet: 1150,
      laundry: 'in_building',
      pets: 'not_allowed',
      outdoorSpace: 'no',
      elevator: 'no',
      commuteMinutes: 35,
      status: 'shortlisted',
      createdAt: at(now, -2, 18, 2),
    }),
    make({
      id: 'demo-newport',
      listingUrl: 'https://listings.example.com/jersey-city/newport-doorman-2br',
      title: 'Newport doorman 2BR',
      address: '155 River Dr S, #1706',
      neighborhood: 'Newport, Jersey City',
      baseRentCents: 420000,
      parkingCents: 0,
      petFeeCents: 0,
      otherMonthlyFeesCents: 6000,
      utilitiesCents: 15000,
      securityDepositCents: 420000,
      oneTimeFeesCents: 30000,
      leaseMonths: 12,
      freeMonths: 0,
      bedrooms: 2,
      bathrooms: 2,
      squareFeet: 1040,
      laundry: 'in_unit',
      pets: 'allowed',
      outdoorSpace: 'no',
      elevator: 'yes',
      commuteMinutes: 15,
      status: 'applied',
      createdAt: at(now, -12, 8, 50),
      updatedBy: DEMO_JORDAN_ID,
    }),
    make({
      id: 'demo-grove',
      listingUrl: 'https://listings.example.com/jersey-city/grove-st-1br-flex',
      title: 'Grove St 1BR + flex',
      address: '170 Newark Ave, #5',
      neighborhood: 'Downtown Jersey City',
      baseRentCents: 330000,
      bedrooms: 1,
      bathrooms: 1,
      laundry: 'in_building',
      elevator: 'yes',
      commuteMinutes: 20,
      status: 'rejected',
      createdAt: at(now, -14, 20, 30),
      createdBy: DEMO_JORDAN_ID,
      updatedBy: DEMO_MAYA_ID,
    }),
    make({
      id: 'demo-bergen',
      listingUrl: 'https://listings.example.com/jersey-city/bergen-lafayette-rowhouse',
      title: 'Bergen-Lafayette rowhouse floor',
      address: '61 Monticello Ave, 2nd floor',
      neighborhood: 'Bergen-Lafayette, Jersey City',
      baseRentCents: 290000,
      utilitiesCents: 20000,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
      laundry: 'in_unit',
      outdoorSpace: 'yes',
      elevator: 'no',
      status: 'unavailable',
      createdAt: at(now, -10, 10, 5),
    }),
  ]

  const art: Record<string, string[]> = {
    'demo-washington': ['living-sunny', 'walkup-bedroom'],
    'demo-paulus': ['balcony-view', 'doorman-kitchen'],
    'demo-journal': ['highrise'],
    'demo-heights': ['garden-level'],
    'demo-uptown': ['walkup-bedroom'],
    'demo-newport': ['doorman-kitchen', 'highrise'],
    'demo-grove': ['loft-flex'],
    'demo-bergen': ['rowhouse'],
  }
  const images: ListingImage[] = Object.entries(art).flatMap(([listingId, names]) =>
    names.map((name, i) => ({
      id: `${listingId}-img-${i}`,
      listingId,
      storagePath: `bundled:/demo/${name}.svg`,
      thumbPath: `bundled:/demo/${name}.svg`,
      sortOrder: i,
      createdAt: now.toISOString(),
    })),
  )

  const vote = (listingId: string, userId: string, v: Vote['vote']): Vote => ({
    listingId,
    userId,
    vote: v,
    updatedAt: now.toISOString(),
  })
  const votes: Vote[] = [
    vote('demo-washington', DEMO_USER_ID, 'interested'),
    vote('demo-washington', DEMO_MAYA_ID, 'interested'),
    vote('demo-washington', DEMO_JORDAN_ID, 'interested'),
    vote('demo-paulus', DEMO_USER_ID, 'interested'),
    vote('demo-paulus', DEMO_MAYA_ID, 'maybe'),
    vote('demo-journal', DEMO_MAYA_ID, 'interested'),
    vote('demo-journal', DEMO_JORDAN_ID, 'maybe'),
    vote('demo-uptown', DEMO_USER_ID, 'maybe'),
    vote('demo-uptown', DEMO_MAYA_ID, 'pass'),
    vote('demo-uptown', DEMO_JORDAN_ID, 'interested'),
    vote('demo-newport', DEMO_USER_ID, 'interested'),
    vote('demo-newport', DEMO_MAYA_ID, 'interested'),
    vote('demo-newport', DEMO_JORDAN_ID, 'interested'),
    vote('demo-grove', DEMO_JORDAN_ID, 'pass'),
    vote('demo-grove', DEMO_MAYA_ID, 'pass'),
  ]

  const tours: Tour[] = [
    {
      listingId: 'demo-washington',
      startsAt: at(now, 2, 18, 30),
      timezone: tz,
      note: 'Meet the broker at the side entrance.',
      createdBy: DEMO_MAYA_ID,
      updatedAt: now.toISOString(),
    },
    {
      listingId: 'demo-newport',
      startsAt: at(now, -4, 11, 0),
      timezone: tz,
      note: null,
      createdBy: DEMO_JORDAN_ID,
      updatedAt: now.toISOString(),
    },
  ]

  const note = (id: string, listingId: string, authorId: string, authorName: string, body: string, dayOffset: number): Note => ({
    id,
    listingId,
    authorId,
    authorName,
    body,
    createdAt: at(now, dayOffset, 20, 15),
    editedAt: null,
  })
  const notes: Note[] = [
    note('demo-n1', 'demo-washington', DEMO_MAYA_ID, 'Maya', 'Washer/dryer in the unit! Second bedroom is small but fits a queen.', -8),
    note('demo-n2', 'demo-washington', DEMO_JORDAN_ID, 'Jordan', 'Street parking only — I checked, the permit is cheap.', -6),
    note('demo-n3', 'demo-paulus', DEMO_USER_ID, 'You', 'Concession is 1 month free on a 13-month lease. Amenity fee is $75/mo.', -7),
    note('demo-n4', 'demo-journal', DEMO_JORDAN_ID, 'Jordan', 'Any dealbreakers? Broker didn’t know the deposit yet.', -4),
    note('demo-n5', 'demo-newport', DEMO_MAYA_ID, 'Maya', 'After the tour: great light, quiet hallway. Application submitted.', -3),
    note('demo-n6', 'demo-bergen', DEMO_USER_ID, 'You', 'Broker says it was rented the same day we saw it.', -9),
  ]

  return {
    version: 1,
    board: {
      id: DEMO_BOARD_ID,
      name: 'Our Hoboken / JC hunt',
      locationLabel: 'Hoboken / Jersey City',
      monthlyBudgetCents: 420000,
      currency: 'USD',
      ownerId: DEMO_USER_ID,
      createdAt: at(now, -15, 9, 0),
      updatedAt: now.toISOString(),
    },
    members: [
      { userId: DEMO_USER_ID, displayName: 'You', joinedAt: at(now, -15, 9, 0), isOwner: true },
      { userId: DEMO_MAYA_ID, displayName: 'Maya', joinedAt: at(now, -15, 9, 30), isOwner: false },
      { userId: DEMO_JORDAN_ID, displayName: 'Jordan', joinedAt: at(now, -14, 19, 0), isOwner: false },
    ],
    listings,
    images,
    votes,
    notes,
    tours,
  }
}
