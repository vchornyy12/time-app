import { describe, expect, it } from 'vitest'
import { safeClientRedirect } from './redirect'

describe('safeClientRedirect', () => {
  it('allows https and loopback http callbacks', () => {
    expect(safeClientRedirect('https://claude.ai/api/mcp/auth_callback?code=x')).toBe('https://claude.ai/api/mcp/auth_callback?code=x')
    expect(safeClientRedirect('https://chatgpt.com/connector_platform_oauth_redirect?code=x')).not.toBeNull()
    expect(safeClientRedirect('http://localhost:33418/callback?code=x')).not.toBeNull()
    expect(safeClientRedirect('http://127.0.0.1:5000/cb')).not.toBeNull()
  })
  it('blocks other schemes and remote plain http', () => {
    for (const bad of ['http://evil.example/cb', 'javascript:alert(1)', 'data:text/html,x', 'not a url', 'ftp://x/y']) {
      expect(safeClientRedirect(bad)).toBeNull()
    }
  })
})
