import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Small encrypted chunks avoid platform limits for large Supabase sessions.
// Serialize operations so refresh/get/remove cannot observe a partial write.
const tails = new Map<string, Promise<unknown>>()
function serialized<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve()
  const result = previous.catch(() => {}).then(run)
  const tail = result.catch(() => {}).finally(() => { if (tails.get(key) === tail) tails.delete(key) })
  tails.set(key, tail)
  return result
}
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const indexKey = (key: string) => `${key}.secure-index`
type Index = { version: 1; generation: string; count: number }
async function readIndex(key: string): Promise<Index | null> {
  const raw = await SecureStore.getItemAsync(indexKey(key))
  if (!raw) return null
  const value = JSON.parse(raw)
  if (value.version !== 1 || !/^[a-z0-9-]+$/.test(value.generation) || !Number.isInteger(value.count) || value.count < 1 || value.count > 256) throw new Error('Invalid secure session')
  return value
}
const partKey = (key: string, index: Index, part: number) => `${key}.${index.generation}.${part}`
async function removeParts(key: string, index: Index | null) {
  if (index) await Promise.all(Array.from({ length: index.count }, (_, n) => SecureStore.deleteItemAsync(partKey(key, index, n))))
}
async function write(key: string, value: string) {
  const previous = await readIndex(key)
  const count = Math.max(1, Math.ceil(value.length / 400))
  if (count > 256) throw new Error('Session exceeds secure storage limit')
  const index: Index = { version: 1, generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, count }
  try {
    for (let n = 0; n < count; n++) await SecureStore.setItemAsync(partKey(key, index, n), value.slice(n * 400, (n + 1) * 400), options)
    await SecureStore.setItemAsync(indexKey(key), JSON.stringify(index), options)
  } catch (error) {
    await removeParts(key, index).catch(() => {})
    throw error
  }
  await AsyncStorage.removeItem(key)
  await removeParts(key, previous)
}
export const secureSessionStorage = {
  getItem: (key: string) => serialized(key, async () => {
    const index = await readIndex(key)
    if (!index) {
      const legacy = await AsyncStorage.getItem(key)
      if (legacy !== null) await write(key, legacy)
      return legacy
    }
    const parts = await Promise.all(Array.from({ length: index.count }, (_, n) => SecureStore.getItemAsync(partKey(key, index, n))))
    if (parts.some(part => part === null)) throw new Error('Incomplete secure session')
    return parts.join('')
  }),
  setItem: (key: string, value: string) => serialized(key, () => write(key, value)),
  removeItem: (key: string) => serialized(key, async () => {
    const index = await readIndex(key)
    await AsyncStorage.removeItem(key)
    await SecureStore.deleteItemAsync(indexKey(key))
    await removeParts(key, index)
  }),
}
