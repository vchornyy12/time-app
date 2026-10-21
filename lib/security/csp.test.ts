import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy } from './csp'
describe('production CSP', () => {
  it('trusts only the app scripts with a nonce and its own Supabase connection', () => {
    const csp = contentSecurityPolicy('unique', 'https://project.supabase.co')
    expect(csp).toContain("'nonce-unique' 'strict-dynamic'")
    expect(csp).toContain('connect-src \'self\' https://project.supabase.co wss://project.supabase.co')
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toContain('*.supabase.co')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })
})
