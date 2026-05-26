import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fjbgxzayfcrpnxmwzkko.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Djw-VlceU0MfUddC9ii8jQ_6Q4iHcYh'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (url: RequestInfo | URL, options?: RequestInit) => {
      console.log('[fetch]', typeof url === 'string' ? url : url.toString())
      return fetch(url, options)
    },
  },
})
