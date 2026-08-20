import { createContext, useContext, useState, type ReactNode } from 'react'
import { typeKey } from './constants'

interface CitationHoverState {
  hoveredType: string | null
  setHoveredType: (type: string | null) => void
  isLit: (type: string) => boolean
}

const CitationHoverContext = createContext<CitationHoverState | null>(null)

export function CitationHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredType, setHoveredType] = useState<string | null>(null)
  const hoveredKey = hoveredType ? typeKey(hoveredType) : null

  const isLit = (type: string) => !hoveredKey || typeKey(type) === hoveredKey

  return (
    <CitationHoverContext.Provider value={{ hoveredType, setHoveredType, isLit }}>
      {children}
    </CitationHoverContext.Provider>
  )
}

export function useCitationHover() {
  const ctx = useContext(CitationHoverContext)
  if (!ctx) {
    return {
      hoveredType: null,
      setHoveredType: () => {},
      isLit: () => true,
    }
  }
  return ctx
}
