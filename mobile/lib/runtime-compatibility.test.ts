import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('Android runtime compatibility', () => {
  it('uses the exact React version required by the production native renderer', () => {
    // React Native throws during startup on a mismatch, even when npm accepts
    // the peer range and Gradle successfully builds the APK.
    const renderer = readFileSync(require.resolve('react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js'), 'utf8')
    const version = renderer.match(/if \("([^"]+)" !== isomorphicReactPackageVersion\)/)?.[1]
    expect(version).toBeTruthy()
    expect(require('react/package.json').version).toBe(version)
    expect(require('react-dom/package.json').version).toBe(version)
    expect(require('react-test-renderer/package.json').version).toBe(version)
  })
})
