import { createContext, useContext, useState, type ReactNode } from 'react'

interface CompetitorHoverState {
  hoveredCompetitor: string | null
  setHoveredCompetitor: (name: string | null) => void
}

const CompetitorHoverContext = createContext<CompetitorHoverState | null>(null)

export function CompetitorHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredCompetitor, setHoveredCompetitor] = useState<string | null>(null)
  return (
    <CompetitorHoverContext.Provider value={{ hoveredCompetitor, setHoveredCompetitor }}>
      {children}
    </CompetitorHoverContext.Provider>
  )
}

export function useCompetitorHover() {
  const ctx = useContext(CompetitorHoverContext)
  if (!ctx) {
    return { hoveredCompetitor: null, setHoveredCompetitor: () => {} }
  }
  return ctx
}
