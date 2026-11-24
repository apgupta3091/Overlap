import type { RouteObject } from 'react-router'
import { LandingPage } from '../pages/LandingPage'
import { NewEventPage } from '../pages/NewEventPage'
import { EventPage } from '../pages/EventPage'
import { DemoPage } from '../pages/DemoPage'
import { PrivacyPage } from '../pages/PrivacyPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/new', element: <NewEventPage /> },
  { path: '/e/:publicId', element: <EventPage /> },
  { path: '/demo', element: <DemoPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '*', element: <NotFoundPage /> },
]
