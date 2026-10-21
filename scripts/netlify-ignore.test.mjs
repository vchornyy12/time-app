import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldIgnoreBuild } from './netlify-ignore.mjs'
const from = 'a'.repeat(40), to = 'b'.repeat(40)
test('a missing baseline builds instead of comparing a clean tree to itself', () => {
  let compared = false
  assert.equal(shouldIgnoreBuild(undefined, to, () => { compared=true; return 0 }), false)
  assert.equal(compared, false)
})
test('only a successful comparison proving mobile-only changes skips the build', () => {
  assert.equal(shouldIgnoreBuild(from,to,()=>0),true)
  assert.equal(shouldIgnoreBuild(from,to,()=>1),false)
})
test('bad references and Git errors never suppress a security release', () => {
  assert.equal(shouldIgnoreBuild('--bad-option',to,()=>0),false)
  assert.equal(shouldIgnoreBuild(from,to,()=>128),false)
  assert.equal(shouldIgnoreBuild(from,to,()=>null),false)
})
