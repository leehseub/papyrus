import { lazy, Suspense } from 'react'
import { TooltipLayer } from './components/Tooltip/Tooltip'

const App = lazy(() => import('./App'))
const GraphWindow = lazy(() => import('./GraphWindow').then(module => ({ default: module.GraphWindow })))
const isGraphWindow = new URLSearchParams(window.location.search).has('graphview')

export function AppRoot() {
  return (
    <>
    <TooltipLayer />
    <Suspense fallback={<div role="status" aria-label="Loading">…</div>}>
      {isGraphWindow ? <GraphWindow /> : <App />}
    </Suspense>
    </>
  )
}
