import { supabase } from './supabase'

const MAGIC_LINK_REDIRECT = 'timeapp://auth'

/**
 * Sends a magic link to the given email.
 * Returns null on success, error message string on failure.
 */
export async function sendMagicLink(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: MAGIC_LINK_REDIRECT,
      shouldCreateUser: true,
    },
  })
  return error ? error.message : null
}

/**
 * Exchanges the token_hash from the magic link URL for a session.
 * Call this when the app opens via the timeapp://auth deep link.
 * Returns null on success, error message string on failure.
 */
export async function verifyMagicLink(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'timeapp:' || parsed.hostname !== 'auth' || (parsed.pathname !== '' && parsed.pathname !== '/') || parsed.username || parsed.password || parsed.port) {
      return 'Invalid magic link URL'
    }
    // PKCE codes only: unsolicited bearer tokens cannot replace the session.
    const code = parsed.searchParams.get('code')
    if (code && !parsed.hash) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      return error ? error.message : null
    }

    return 'No token found in magic link URL'
  } catch {
    return 'Invalid magic link URL'
  }
}

/** Signs the current user out and clears the encrypted session. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** Returns the current session, or null if not logged in. */
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
