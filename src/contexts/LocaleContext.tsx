import { createContext, useContext } from 'react'
import type { Translations } from '../i18n'

export const LocaleContext = createContext<Translations | null>(null)

export function useT(): Translations {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useT must be used within LocaleProvider')
  return ctx
}
