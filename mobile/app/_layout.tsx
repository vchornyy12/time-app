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

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/')
    }
  }, [session, segments])

  return <Slot />
}
