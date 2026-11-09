import { useSyncExternalStore } from 'react'

const PHONE = '(max-width: 639px)'
const TABLET = '(max-width: 1023px)'

function getLayout(): 'desktop' | 'tablet' | 'phone' {
  if (window.matchMedia(PHONE).matches) return 'phone'
  if (window.matchMedia(TABLET).matches) return 'tablet'
  return 'desktop'
}

function subscribe(onChange: () => void) {
  const lists = [PHONE, TABLET].map((query) => window.matchMedia(query))
  lists.forEach((list) => list.addEventListener('change', onChange))
  return () => lists.forEach((list) => list.removeEventListener('change', onChange))
}

export function useLayout() {
  return useSyncExternalStore(subscribe, getLayout)
}
