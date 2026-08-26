import { createContext, useContext, useEffect, type ReactNode } from 'react'

const ScreenSubheaderContext = createContext<(node: ReactNode | null) => void>(() => {})

export function ScreenSubheaderProvider({
  setSubheader,
  children,
}: {
  setSubheader: (node: ReactNode | null) => void
  children: ReactNode
}) {
  return (
    <ScreenSubheaderContext.Provider value={setSubheader}>
      {children}
    </ScreenSubheaderContext.Provider>
  )
}

/** Renders content between the page title and filter bar (e.g. Competitors tabs). */
export function useScreenSubheader(node: ReactNode | null) {
  const setSubheader = useContext(ScreenSubheaderContext)
  useEffect(() => {
    setSubheader(node)
    return () => setSubheader(null)
  }, [setSubheader, node])
}
