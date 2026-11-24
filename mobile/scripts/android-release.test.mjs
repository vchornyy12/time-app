import { createRequire } from 'node:module'
import { strict as assert } from 'node:assert'
import test from 'node:test'
const require = createRequire(import.meta.url)
const { removeDebugReleaseSigning } = require('../plugins/with-release-signing.cjs')

test('prebuild removes debug signing only from release and is idempotent', () => {
  const source = 'buildTypes { debug { signingConfig signingConfigs.debug } release { signingConfig signingConfigs.debug } }'
  const changed = removeDebugReleaseSigning(source)
  assert.match(changed, /debug \{ signingConfig signingConfigs.debug/)
  assert.match(changed, /release \{[\s\S]*signingConfig null/)
  assert.equal(removeDebugReleaseSigning(changed), changed)
})
test('prebuild preserves a release configuration injected by EAS', () => {
  const source = 'release { signingConfig signingConfigs.release }'
  assert.equal(removeDebugReleaseSigning(source), source)
})
test('prebuild fails closed if the signing template changes', () => {
  assert.throws(() => removeDebugReleaseSigning('release { otherSigningMechanism() }'))
})
