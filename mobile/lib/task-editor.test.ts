import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ load: vi.fn(), contexts: vi.fn(), save: vi.fn(), alert: vi.fn() }))
vi.mock('react-native', () => ({ ActivityIndicator: 'Spinner', Alert: { alert: mocks.alert }, KeyboardAvoidingView: 'KeyboardView', Modal: 'Modal', Platform: { OS: 'android' }, ScrollView: 'ScrollView', StyleSheet: { create: (v: unknown) => v }, Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'Button', View: 'View' }))
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
vi.mock('./tasks', () => ({ fetchTaskDetail: mocks.load, fetchUserContexts: mocks.contexts, saveTaskDetail: mocks.save }))
vi.mock('../components/InboxProcessing', () => ({ InboxProcessing: 'Wizard' }))
import { TaskEditor } from '../components/TaskEditor'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const task = { id: 'task', title: 'Read invoice', contexts: ['@office'], status: 'inbox', updated_at: 'version' }
let root: ReactTestRenderer | undefined
const closed = vi.fn(), saved = vi.fn()
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue(task); mocks.contexts.mockResolvedValue(['@custom']); mocks.save.mockResolvedValue({ ...task, status: 'next_actions' }) })
afterEach(async () => { await act(async () => { root?.unmount(); root = undefined }) })
async function mount() { await act(async () => { root = create(React.createElement(TaskEditor, { taskId: 'task', userId: 'owner', onClose: closed, onSaved: saved })) }) }
function button(text: string) { return root!.root.findAllByType('Button' as never).find(node => node.findAllByType('Text' as never).some(child => child.props.children === text))! }

describe('task editor workflow', () => {
  it('opens the GTD guide instead of directly moving an inbox task', async () => {
    await mount()
    await act(async () => { button('Process Inbox item').props.onPress() })
    expect(root!.root.findByType('Wizard' as never).props.task).toEqual(task)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('keeps edits visible after a failed save and does not report success', async () => {
    mocks.save.mockRejectedValueOnce(new Error('stale'))
    await mount()
    await act(async () => { root!.root.findByProps({ accessibilityLabel: 'Task title' }).props.onChangeText('Edited') })
    await act(async () => { button('Save changes').props.onPress() })
    expect(saved).not.toHaveBeenCalled()
    expect(root!.root.findByProps({ accessibilityLabel: 'Task title' }).props.value).toBe('Edited')
    expect(root!.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain('reload')
  })
  it('saves changes to context selection, including a normalized custom context', async () => {
    await mount()
    await act(async () => { root!.root.findByProps({ accessibilityLabel: '@office' }).props.onPress() })
    await act(async () => { root!.root.findByProps({ accessibilityLabel: '@phone' }).props.onPress() })
    await act(async () => { root!.root.findByProps({ accessibilityLabel: 'New task context' }).props.onChangeText('Travel') })
    await act(async () => { root!.root.findByProps({ accessibilityLabel: 'Add context' }).props.onPress() })
    await act(async () => { button('Save changes').props.onPress() })
    expect(mocks.save).toHaveBeenCalledWith('owner', task, { title: task.title, contexts: ['@phone', '@travel'] }, false)
  })
  it('requires confirmation before discarding unsaved work', async () => {
    await mount()
    await act(async () => { root!.root.findByProps({ accessibilityLabel: 'Task title' }).props.onChangeText('Edited') })
    await act(async () => { button('Close').props.onPress() })
    expect(closed).not.toHaveBeenCalled()
    expect(mocks.alert).toHaveBeenCalledWith('Discard changes?', expect.any(String), expect.any(Array))
  })
  it('blocks duplicate submissions and closing while a save is pending', async () => {
    let resolve!: (value: unknown) => void
    mocks.save.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await mount()
    await act(async () => { button('Save changes').props.onPress(); button('Save changes').props.onPress(); button('Close').props.onPress() })
    expect(mocks.save).toHaveBeenCalledOnce()
    expect(closed).not.toHaveBeenCalled()
    await act(async () => { resolve(task) })
    expect(saved).toHaveBeenCalledOnce()
  })
  it('does not save an empty title or silently omit an unadded context', async () => {
    await mount()
    await act(async () => { root!.root.findByProps({ accessibilityLabel: 'Task title' }).props.onChangeText(' ') })
    await act(async () => { button('Save changes').props.onPress() })
    expect(mocks.save).not.toHaveBeenCalled()
    await act(async () => { root!.root.findByProps({ accessibilityLabel: 'Task title' }).props.onChangeText('Valid'); root!.root.findByProps({ accessibilityLabel: 'New task context' }).props.onChangeText('@new') })
    await act(async () => { button('Save changes').props.onPress() })
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('cancels a detail request when the editor closes', async () => {
    mocks.load.mockReturnValueOnce(new Promise(() => {}))
    await mount()
    const signal = mocks.load.mock.calls[0][2] as AbortSignal
    await act(async () => { root?.unmount(); root = undefined })
    expect(signal.aborted).toBe(true)
  })
})
