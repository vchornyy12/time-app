import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { verifyMagicLink } from '../lib/auth'
import type { Session } from '@supabase/supabase-js'
import { AppState, Alert } from 'react-native'
import { SessionContext } from '../lib/session'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const router = useRouter()
  const segments = useSegments()

  // 1. Restore session on mount and listen for auth state changes
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(current => current === undefined ? data.session : current)
    }).catch(() => { if (active) setSession(current => current === undefined ? null : current) })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    const refresh = (state: string | null) => {
      if (state === 'active') supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    }
    refresh(AppState.currentState)
    const appState = AppState.addEventListener('change', refresh)
    return () => {
      active = false
      listener.subscription.unsubscribe()
      appState.remove()
      supabase.auth.stopAutoRefresh()
    }
  }, [])

  // 2. Handle deep links (magic link callback)
  useEffect(() => {
    let active = true
    let lastUrl: string | null = null
    const handleUrl = async (url: string) => {
      if (!active || !url.startsWith('timeapp://auth') || url.length > 2048 || lastUrl === url) return
      lastUrl = url
      const error = await verifyMagicLink(url)
      if (error && active) Alert.alert('Sign-in failed', 'Request a new magic link on this device and try again.')
      // onAuthStateChange above will update session and trigger redirect
    }

    // Handle URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url)
    }).catch(() => {})

    // Handle URL while app is already open
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => { active = false; sub.remove() }
  }, [])

  // 3. Redirect based on auth state (wait until session is resolved)
  useEffect(() => {
    if (session === undefined) return // still loading

    const inTabsGroup = segments[0] === '(tabs)'

    if (session && !inTabsGroup) {
      // Якщо юзер залогінився, але він не в головному меню (наприклад, висить на екрані auth) -> пускаємо в додаток
      router.replace('/(tabs)')
    } else if (!session && segments[0] !== '(auth)') {
      // Якщо сесії немає і він не на екрані логіну -> кидаємо на логін
      router.replace('/(auth)/login')
    }
  }, [session, segments, router])

  return <SessionContext.Provider value={session}><Slot /></SessionContext.Provider>
}
