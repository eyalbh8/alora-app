import { Outlet } from 'react-router-dom'
import { AnalyticsFilterBar } from '../components/analytics/AnalyticsFilterBar'
import { AnalyticsTabs } from '../components/analytics/AnalyticsTabs'
import { AnalyticsFiltersProvider } from '../context/AnalyticsFiltersContext'
import { useBrandKit } from '../context/BrandKitContext'

function AnalyticsChrome() {
  const { settings } = useBrandKit()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics</h1>
        <div className="flex items-center gap-2">
          {settings?.prompts_count != null && (
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              {settings.prompts_count} answers
            </span>
          )}
        </div>
      </div>

      <AnalyticsTabs />
      <AnalyticsFilterBar />
      <Outlet />
    </div>
  )
}

/** Wraps Analytics sub-tabs (Overview, Visibility, Citations, Sentiment) with shared filters. */
export function AnalyticsLayout() {
  return (
    <AnalyticsFiltersProvider>
      <AnalyticsChrome />
    </AnalyticsFiltersProvider>
  )
}
