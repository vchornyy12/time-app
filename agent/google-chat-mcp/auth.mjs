#!/usr/bin/env node
// One-time sign-in for the local Google Chat MCP server.
// Stores a refresh token in ~/.config/time24-chat/token.json (mode 600).
//
//   node agent/google-chat-mcp/auth.mjs

import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { loadClient, writeSecretJson, SCOPES, TOKEN_FILE } from './google.mjs'

const PORT = Number(process.env.TIME24_CHAT_PORT || 8765)
const REDIRECT_URI = `http://localhost:${PORT}/callback`

const client = await loadClient()
const state = randomBytes(16).toString('hex')
const verifier = randomBytes(32).toString('base64url')
const challenge = createHash('sha256').update(verifier).digest('base64url')

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
authUrl.search = new URLSearchParams({
  client_id: client.client_id,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPES.join(' '),
  access_type: 'offline',
  prompt: 'consent',
  include_granted_scopes: 'true',
  state,
  code_challenge: challenge,
  code_challenge_method: 'S256',
}).toString()

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI)
  if (url.pathname !== '/callback') {
    res.writeHead(404).end()
    return
  }
  const finish = (status, text) => {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }).end(text)
    server.close()
  }
  if (url.searchParams.get('state') !== state) return finish(400, 'State mismatch. Run the script again.')
  const error = url.searchParams.get('error')
  if (error) {
    console.error(`Google returned: ${error}`)
    process.exitCode = 1
    return finish(400, `Sign-in failed: ${error}`)
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: client.client_id,
        client_secret: client.client_secret,
        code: url.searchParams.get('code'),
        code_verifier: verifier,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    const body = await tokenRes.json()
    if (!tokenRes.ok || !body.refresh_token) {
      throw new Error(body.error_description || body.error || 'No refresh token returned')
    }
    await writeSecretJson(TOKEN_FILE, {
      refresh_token: body.refresh_token,
      scope: body.scope,
      created_at: new Date().toISOString(),
    })
    console.log(`Signed in. Token saved to ${TOKEN_FILE}`)
    console.log(`Granted scopes: ${body.scope}`)
    finish(200, 'Signed in to Google Chat. You can close this tab.')
  } catch (e) {
    console.error(`Token exchange failed: ${e.message}`)
    process.exitCode = 1
    finish(500, `Token exchange failed: ${e.message}`)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Opening the Google sign-in page. If it does not open, visit:\n${authUrl}\n`)
  execFile('open', [authUrl.toString()], () => {})
})
