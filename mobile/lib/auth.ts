import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'
import { magicLinkCode } from './incoming-link'

const MAGIC_LINK_REDIRECT = 'timeapp://auth'

/** Existing web accounts can use the same password on Android. */
export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const value = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254 || !password) return 'Enter your email and password.'
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: value, password })
    return error ? 'Unable to sign in. Check your email and password.' : null
  } catch { return 'Unable to connect. Please try again.' }
}

/**
 * Sends a magic link to the given email.
 * Returns null on success, error message string on failure.
 */
export async function sendMagicLink(email: string): Promise<string | null> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) return 'Enter a valid email address'
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: MAGIC_LINK_REDIRECT,
        shouldCreateUser: true,
      },
    })
    return error ? error.message : null
  } catch {
    return 'Unable to connect. Please try again.'
  }
}

/**
 * Exchanges a PKCE code from the magic link URL for a session.
 * Call this when the app opens via the timeapp://auth deep link.
 * Returns null on success, error message string on failure.
 */
// A code can arrive twice (the Google browser session and the app's link
// handler both see the redirect on Android); exchange each one only once.
const exchanges = new Map<string, Promise<string | null>>()

export async function verifyMagicLink(url: string): Promise<string | null> {
  try {
    // PKCE codes only: unsolicited bearer tokens cannot replace the session.
    const code = magicLinkCode(url)
    if (!code) return 'No token found in magic link URL'
    let exchange = exchanges.get(code)
    if (!exchange) {
      exchange = supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => error ? error.message : null)
        .catch(() => 'Invalid magic link URL')
      exchanges.set(code, exchange)
    }
    return await exchange
  } catch {
    return 'Invalid magic link URL'
  }
}

/**
 * Signs in with Google through Supabase, like the web app: Google opens in a
 * secure browser session and returns to timeapp://auth with a PKCE code.
 * Returns null on success or when the user closes the browser.
 */
export async function signInWithGoogle(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: MAGIC_LINK_REDIRECT, skipBrowserRedirect: true },
    })
    if (error || !data.url) return 'Unable to start Google sign-in. Please try again.'
    const result = await WebBrowser.openAuthSessionAsync(data.url, MAGIC_LINK_REDIRECT)
    if (result.type !== 'success') return null
    return (await verifyMagicLink(result.url)) ? 'Google sign-in did not finish. Please try again.' : null
  } catch {
    return 'Unable to connect. Please try again.'
  }
}

/** Signs the current user out and clears the encrypted session. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}

/** Returns the current session, or null if not logged in. */
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
