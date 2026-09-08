import { useEffect, useSyncExternalStore } from 'react'

export type Locale = 'ko' | 'en'

const KEY = 'papyrus-locale'
const CHANGE_EVENT = 'papyrus-locale-change'

function getLocale(): Locale {
  return localStorage.getItem(KEY) === 'en' ? 'en' : 'ko'
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.storageArea === localStorage && (event.key === KEY || event.key === null)) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function setLocale(locale: Locale) {
  localStorage.setItem(KEY, locale)
  // The native storage event only reaches other windows.
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getLocale)
  useEffect(() => {
    document.documentElement.setAttribute('lang', locale)
  }, [locale])
  return { locale, setLocale }
}
