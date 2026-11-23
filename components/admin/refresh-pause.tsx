'use client'

import { createContext, useContext, useEffect } from 'react'

// Lets any admin screen pause the 30-second auto-refresh while something is open
// (a confirm / not-approved step, the screenshot viewer, the phone menu).
// The provider's function starts a pause and returns the function that ends it.
export const RefreshPauseContext = createContext<() => () => void>(() => () => {})

export function usePauseRefresh(active: boolean) {
  const pause = useContext(RefreshPauseContext)
  useEffect(() => (active ? pause() : undefined), [active, pause])
}
