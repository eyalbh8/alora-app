import { Outlet } from 'react-router-dom'
import { useBrandKitEdit } from '../context/BrandKitEditContext'
import { ErrorState } from './ErrorState'
import { LoadingSpinner } from './LoadingSpinner'

/** Shell for Brand Kit editor tabs — keeps edit state while navigating. */
export function BrandKitLayout() {
  const { draft, loading, error, retry } = useBrandKitEdit()

  if (loading) return <LoadingSpinner label="Loading Brand Kit…" />
  if (error) return <ErrorState message={error} onRetry={retry} />
  if (!draft) return null

  return (
    <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <Outlet />
    </div>
  )
}
