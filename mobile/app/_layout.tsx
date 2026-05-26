import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { verifyMagicLink } from '../lib/auth'
import type { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const router = useRouter()
  const segments = useSegments()

  // 1. Restore session on mount and listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // 2. Handle deep links (magic link callback)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.startsWith('timeapp://auth')) return
      const error = await verifyMagicLink(url)
      if (error) console.warn('Magic link verification failed:', error)
      // onAuthStateChange above will update session and trigger redirect
    }

    // Handle URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url)
    })

    // Handle URL while app is already open
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [])

  // 3. Redirect based on auth state (wait until session is resolved)
  useEffect(() => {
    if (session === undefined) return // still loading

    const inTabsGroup = segments[0] === '(tabs)'

    if (session && !inTabsGroup) {
      // Якщо юзер залогінився, але він не в головному меню (наприклад, висить на екрані auth) -> пускаємо в додаток
      router.replace('/(tabs)/')
    } else if (!session && segments[0] !== '(auth)') {
      // Якщо сесії немає і він не на екрані логіну -> кидаємо на логін
      router.replace('/(auth)/login')
    }
  }, [session, segments])

  return <Slot />
}
