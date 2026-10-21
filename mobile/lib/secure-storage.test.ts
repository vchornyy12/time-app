import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ secure: new Map<string,string>(), legacy: new Map<string,string>(), fail: false }))
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: async (key: string) => mocks.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { if (mocks.fail && !key.endsWith('secure-index')) throw new Error('locked'); mocks.secure.set(key,value) },
  deleteItemAsync: async (key: string) => { mocks.secure.delete(key) },
}))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => mocks.legacy.get(key) ?? null,
  removeItem: async (key: string) => { mocks.legacy.delete(key) },
} }))
import { secureSessionStorage as storage } from './secure-storage'
beforeEach(() => { mocks.secure.clear(); mocks.legacy.clear(); mocks.fail = false })
describe('encrypted session storage lifecycle', () => {
  it('migrates a large unicode session out of plaintext and removes every encrypted chunk on logout', async () => {
    const value = 'synthetic-session-😀'.repeat(300)
    mocks.legacy.set('session',value)
    expect(await storage.getItem('session')).toBe(value)
    expect(mocks.legacy.has('session')).toBe(false)
    expect(mocks.secure.size).toBeGreaterThan(2)
    await storage.removeItem('session')
    expect(mocks.secure.size).toBe(0)
    expect(await storage.getItem('session')).toBeNull()
  })
  it('keeps the old session readable when encrypted storage rejects a write', async () => {
    await storage.setItem('session','old')
    mocks.fail = true
    await expect(storage.setItem('session','new')).rejects.toThrow('locked')
    expect(await storage.getItem('session')).toBe('old')
  })
  it('serializes refreshes and reads without mixing generations', async () => {
    const first = storage.setItem('session','one'.repeat(1000))
    const second = storage.setItem('session','two'.repeat(1000))
    const read = storage.getItem('session')
    await Promise.all([first,second])
    expect(await read).toBe('two'.repeat(1000))
    const manifest = JSON.parse(mocks.secure.get('session.secure-index')!)
    expect(mocks.secure.size).toBe(manifest.count + 1)
  })
})
