import 'react-native-url-polyfill/auto'
import { createClient, processLock } from '@supabase/supabase-js'
import { secureSessionStorage } from './secure-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fjbgxzayfcrpnxmwzkko.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Djw-VlceU0MfUddC9ii8jQ_6Q4iHcYh'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
})
