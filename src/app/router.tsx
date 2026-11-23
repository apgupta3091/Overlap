import { createBrowserRouter } from 'react-router'
import { LandingPage } from '../pages/LandingPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { DemoLayout } from '../features/demo/DemoLayout'
import { BoardPage } from '../features/board/BoardPage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    path: '/demo',
    element: <DemoLayout />,
    children: [{ index: true, element: <BoardPage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
])
