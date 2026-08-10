import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { GeoMetaProvider } from './context/GeoMetaContext'
import { SnapshotProvider } from './context/SnapshotContext'
import { createQueryClient } from './lib/queryClient'
import { AiCrawlersScreen } from './screens/AiCrawlersScreen'
import { AiTrafficScreen } from './screens/AiTrafficScreen'
import { CompetitorsScreen } from './screens/CompetitorsScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { MentionsScreen } from './screens/MentionsScreen'
import { PromptsScreen } from './screens/PromptsScreen'
import { SentimentScreen } from './screens/SentimentScreen'
import {
  AnalyticsScreenLayout,
  GeoFiltersShell,
  GeoScreenLayout,
} from './screens/ScreenLayout'

const queryClient = createQueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SnapshotProvider>
        <GeoMetaProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route element={<GeoFiltersShell />}>
                  <Route element={<GeoScreenLayout title="Dashboard" />}>
                    <Route path="/" element={<DashboardScreen />} />
                  </Route>
                  <Route element={<GeoScreenLayout title="Prompts" />}>
                    <Route path="/prompts" element={<PromptsScreen />} />
                  </Route>
                  <Route element={<GeoScreenLayout title="Mentions" />}>
                    <Route path="/mentions" element={<MentionsScreen />} />
                  </Route>
                  <Route element={<GeoScreenLayout title="Sentiment" />}>
                    <Route path="/sentiment" element={<SentimentScreen />} />
                  </Route>
                  <Route element={<GeoScreenLayout title="Competitors" />}>
                    <Route path="/competitors" element={<CompetitorsScreen />} />
                  </Route>
                </Route>
                <Route element={<AnalyticsScreenLayout title="AI Traffic" variant="traffic" />}>
                  <Route path="/ai-traffic" element={<AiTrafficScreen />} />
                </Route>
                <Route element={<AnalyticsScreenLayout title="AI Crawlers" variant="crawlers" />}>
                  <Route path="/ai-crawlers" element={<AiCrawlersScreen />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </GeoMetaProvider>
      </SnapshotProvider>
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  )
}
