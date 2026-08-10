import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { SnapshotProvider } from './context/SnapshotContext'
import { AiCrawlersScreen } from './screens/AiCrawlersScreen'
import { AiTrafficScreen } from './screens/AiTrafficScreen'
import { CompetitorsScreen } from './screens/CompetitorsScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { MentionsScreen } from './screens/MentionsScreen'
import { PromptsScreen } from './screens/PromptsScreen'
import { SentimentScreen } from './screens/SentimentScreen'
import { AnalyticsScreenLayout, GeoScreenLayout } from './screens/ScreenLayout'

export default function App() {
  return (
    <SnapshotProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
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
            <Route element={<AnalyticsScreenLayout title="AI Traffic" />}>
              <Route path="/ai-traffic" element={<AiTrafficScreen />} />
            </Route>
            <Route element={<AnalyticsScreenLayout title="AI Crawlers" />}>
              <Route path="/ai-crawlers" element={<AiCrawlersScreen />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SnapshotProvider>
  )
}
