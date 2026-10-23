import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  userId: 'owner' as string | undefined,
  fetch: vi.fn(),
  foreground: undefined as undefined | ((state: string) => void),
  remove: vi.fn(),
}))
vi.mock('react-native', () => ({ AppState: { addEventListener: (_: string, listener: (state: string) => void) => {
  mocks.foreground = listener
  return { remove: mocks.remove }
} } }))
vi.mock('expo-router', async () => {
  const react = await import('react')
  return { useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]) }
})
vi.mock('./session', () => ({ useSession: () => mocks.userId ? { user: { id: mocks.userId } } : null }))
vi.mock('./tasks', () => ({ TASK_PAGE_SIZE: 50, fetchTaskPage: mocks.fetch, taskCursor: (task: { id: string }) => ({ value: '2026-10-22T00:00:00.000Z', id: task.id }) }))
import { useTaskList } from './use-task-list'

// React 19 renderer uses this flag for async state-update assertions.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: ReactTestRenderer | undefined
let list: ReturnType<typeof useTaskList>
function Harness() {
  const result = useTaskList('inbox')
  React.useLayoutEffect(() => { list = result })
  return null
}
async function mount() { await act(async () => { root = create(React.createElement(Harness)) }) }
const page = Array.from({ length: 50 }, (_, index) => ({ id: String(index), title: 'Task' }))
beforeEach(() => { mocks.userId = 'owner'; mocks.fetch.mockReset(); mocks.fetch.mockResolvedValue(page) })
afterEach(async () => { await act(async () => { root?.unmount() }); root = undefined })

describe('task list request lifecycle', () => {
  it('does not fetch before session restoration', async () => {
    mocks.userId = undefined
    await mount()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('loads more on demand, deduplicates rows and stops after the last page', async () => {
    await mount()
    mocks.fetch.mockResolvedValueOnce([{ id: '49', title: 'Task' }, { id: '50', title: 'Task' }])
    await act(async () => { await list.loadMore() })
    expect(mocks.fetch.mock.calls[1][2]).toEqual({ value: '2026-10-22T00:00:00.000Z', id: '49' })
    expect(list.tasks).toHaveLength(51)
    await act(async () => { await list.loadMore() })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })
  it('cancels an old load and ignores its late result after refresh', async () => {
    let resolveOld!: (value: unknown[]) => void
    mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    await mount()
    const oldSignal = mocks.fetch.mock.calls[0][3] as AbortSignal
    mocks.fetch.mockResolvedValueOnce([{ id: 'new', title: 'Fresh' }])
    await act(async () => { await list.reload() })
    expect(oldSignal.aborted).toBe(true)
    await act(async () => { resolveOld([{ id: 'stale', title: 'Old' }]) })
    expect(list.tasks.map(task => task.id)).toEqual(['new'])
    expect(list.loading).toBe(false)
  })
  it('keeps loaded tasks and releases loading state when the next request fails', async () => {
    await mount()
    mocks.fetch.mockRejectedValueOnce(new Error('offline'))
    await act(async () => { await list.loadMore() })
    expect(list.tasks).toHaveLength(50)
    expect(list.loading).toBe(false)
    expect(list.error).toBeTruthy()
    mocks.fetch.mockResolvedValueOnce([])
    await act(async () => { await list.loadMore() })
    expect(mocks.fetch.mock.calls[2][2]).toEqual({ value: '2026-10-22T00:00:00.000Z', id: '49' })
    expect(list.error).toBeNull()
  })
  it('prevents concurrent pagination requests and keeps its cursor after completion', async () => {
    await mount()
    await act(async () => { list.remove('0') })
    let resolvePage!: (value: unknown[]) => void
    mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { resolvePage = resolve }))
    let request!: Promise<void>
    await act(async () => { request = list.loadMore(); void list.loadMore() })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.fetch.mock.calls[1][2]).toEqual({ value: '2026-10-22T00:00:00.000Z', id: '49' })
    await act(async () => { resolvePage([]); await request })
  })
  it('reloads on foreground and aborts on unmount', async () => {
    await mount()
    await act(async () => { mocks.foreground?.('active') })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    mocks.fetch.mockImplementationOnce(() => new Promise(() => {}))
    await act(async () => { void list.reload() })
    const signal = mocks.fetch.mock.calls[2][3] as AbortSignal
    await act(async () => { root?.unmount(); root = undefined })
    expect(signal.aborted).toBe(true)
    expect(mocks.remove).toHaveBeenCalled()
  })
})
