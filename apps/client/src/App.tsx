import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@descope/react-sdk'
import { Layout } from './components/Layout'
import { AuthGuard } from './components/AuthGuard'
import { GeoMetaProvider } from './context/GeoMetaContext'
import { SnapshotProvider } from './context/SnapshotContext'
import { createQueryClient } from './lib/queryClient'
import { AiCrawlersScreen } from './screens/AiCrawlersScreen'
import { AiTrafficScreen } from './screens/AiTrafficScreen'
import { CompetitorsScreen } from './screens/CompetitorsScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { LoginScreen } from './screens/LoginScreen'
import { CitationsScreen } from './screens/CitationsScreen'
import { MarketplaceScreen } from './screens/MarketplaceScreen'
import { MentionsScreen } from './screens/MentionsScreen'
import { PromptsScreen } from './screens/PromptsScreen'
import { SentimentScreen } from './screens/SentimentScreen'
import { NotFoundScreen } from './screens/NotFoundScreen'
import {
  AnalyticsScreenLayout,
  GeoFiltersShell,
  GeoScreenLayout,
} from './screens/ScreenLayout'

const queryClient = createQueryClient()
const DESCOPE_PROJECT_ID = import.meta.env.VITE_DESCOPE_PROJECT_ID || ''

export default function App() {
  return (
    <AuthProvider projectId={DESCOPE_PROJECT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route
              path="*"
              element={
                <AuthGuard>
                  <SnapshotProvider>
                    <GeoMetaProvider>
                      <Routes>
                        <Route element={<Layout />}>
                          <Route element={<GeoFiltersShell />}>
                            <Route element={<GeoScreenLayout title="Account Brief" />}>
                              <Route path="/" element={<DashboardScreen />} />
                            </Route>
                            <Route element={<GeoScreenLayout title="Prompts" />}>
                              <Route path="/prompts" element={<PromptsScreen />} />
                            </Route>
                            <Route element={<GeoScreenLayout title="Mentions" />}>
                              <Route path="/mentions" element={<MentionsScreen />} />
                            </Route>
                            <Route element={<GeoScreenLayout title="Citations" />}>
                              <Route path="/citations" element={<CitationsScreen />} />
                              <Route path="/citations/:domain" element={<CitationsScreen />} />
                            </Route>
                            <Route element={<GeoScreenLayout title="Sentiment" />}>
                              <Route path="/sentiment" element={<SentimentScreen />} />
                            </Route>
                            <Route element={<GeoScreenLayout title="Competitors" />}>
                              <Route path="/competitors" element={<CompetitorsScreen />} />
                            </Route>
                            <Route element={<GeoScreenLayout title="Marketplace" />}>
                              <Route path="/marketplace" element={<MarketplaceScreen />} />
                            </Route>
                          </Route>
                          <Route element={<AnalyticsScreenLayout title="AI Traffic" variant="traffic" />}>
                            <Route path="/ai-traffic" element={<AiTrafficScreen />} />
                          </Route>
                          <Route element={<AnalyticsScreenLayout title="AI Crawlers" variant="crawlers" />}>
                            <Route path="/ai-crawlers" element={<AiCrawlersScreen />} />
                          </Route>
                          <Route path="*" element={<NotFoundScreen />} />
                        </Route>
                      </Routes>
                    </GeoMetaProvider>
                  </SnapshotProvider>
                </AuthGuard>
              }
            />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  )
}
