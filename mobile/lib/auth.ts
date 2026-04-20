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
    // Magic link params arrive as hash fragments or query params depending on Supabase version
    const params = new URLSearchParams(
      parsed.hash ? parsed.hash.slice(1) : parsed.search.slice(1)
    )
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      return error ? error.message : null
    }

    // Fallback: PKCE / token_hash flow
    const tokenHash = params.get('token_hash')
    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      })
      return error ? error.message : null
    }

    return 'No token found in magic link URL'
  } catch {
    return 'Invalid magic link URL'
  }
}

/** Signs the current user out and clears the session from AsyncStorage. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** Returns the current session, or null if not logged in. */
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
