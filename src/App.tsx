import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { BrandKitLayout } from './components/BrandKitLayout'
import { Layout } from './components/Layout'
import { BrandKitEditProvider } from './context/BrandKitEditContext'
import { BrandKitProvider } from './context/BrandKitContext'
import { AnalyticsLayout } from './screens/AnalyticsLayout'
import { AudiencesScreen } from './screens/AudiencesScreen'
import { CitationsScreen } from './screens/CitationsScreen'
import { ContentTypesScreen } from './screens/ContentTypesScreen'
import { CustomVariablesScreen } from './screens/CustomVariablesScreen'
import { FoundationsScreen } from './screens/FoundationsScreen'
import { OffsiteScreen } from './screens/OffsiteScreen'
import { OverviewScreen } from './screens/OverviewScreen'
import { PagesScreen } from './screens/PagesScreen'
import { ProductLinesScreen } from './screens/ProductLinesScreen'
import { PromptsScreen } from './screens/PromptsScreen'
import { RegionsScreen } from './screens/RegionsScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { SentimentScreen } from './screens/SentimentScreen'
import { VisibilityScreen } from './screens/VisibilityScreen'
import { VisualGuidelinesScreen } from './screens/VisualGuidelinesScreen'
import { BrandKitOverviewScreen } from './screens/brand-kit/BrandKitOverviewScreen'

export default function App() {
  return (
    <BrandKitProvider>
      <BrandKitEditProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              {/* Insights */}
              <Route element={<AnalyticsLayout />}>
                <Route path="/" element={<OverviewScreen />} />
                <Route path="/visibility" element={<VisibilityScreen />} />
                <Route path="/citations" element={<CitationsScreen />} />
                <Route path="/sentiment" element={<SentimentScreen />} />
              </Route>
              <Route path="/pages" element={<PagesScreen />} />
              <Route path="/prompts" element={<PromptsScreen />} />
              <Route path="/offsite" element={<OffsiteScreen />} />

              {/* Brand Kit editor */}
              <Route path="/brand-kit" element={<BrandKitLayout />}>
                <Route index element={<BrandKitOverviewScreen />} />
                <Route path="foundations" element={<FoundationsScreen />} />
                <Route path="product-lines" element={<ProductLinesScreen />} />
                <Route path="content-types" element={<ContentTypesScreen />} />
                <Route path="audiences" element={<AudiencesScreen />} />
                <Route path="regions" element={<RegionsScreen />} />
                <Route path="visual-guidelines" element={<VisualGuidelinesScreen />} />
                <Route path="custom-variables" element={<CustomVariablesScreen />} />
                <Route path="review" element={<ReviewScreen />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </BrandKitEditProvider>
    </BrandKitProvider>
  )
}
