import { useState, useEffect } from 'react'

export type Locale = 'ko' | 'en'

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('papyrus-locale') as Locale) ?? 'ko'
  })

  useEffect(() => {
    localStorage.setItem('papyrus-locale', locale)
    document.documentElement.setAttribute('lang', locale === 'ko' ? 'ko' : 'en')
  }, [locale])

  const setLocale = (l: Locale) => setLocaleState(l)

  return { locale, setLocale }
}
