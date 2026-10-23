import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ process: vi.fn(), alert: vi.fn(), picker: vi.fn() }))
vi.mock('react-native', () => ({ ActivityIndicator: 'Spinner', Alert: { alert: mocks.alert }, KeyboardAvoidingView: 'KeyboardView', Modal: 'Modal', Platform: { OS: 'android' }, ScrollView: 'ScrollView', StyleSheet: { create: (v: unknown) => v }, Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'Button', View: 'View' }))
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
vi.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: { open: mocks.picker } }))
vi.mock('./tasks', () => ({ processInbox: mocks.process }))
import { InboxProcessing } from '../components/InboxProcessing'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const task = { id: '00000000-0000-4000-8000-000000000001', title: 'Inbox thought', contexts: [], status: 'inbox' as const, updated_at: '2026-10-23T12:00:00.123456Z', scheduled_at: null, due_date: null, delegated_to: null, project_id: null, recurrence_rule: null }
let root: ReactTestRenderer | undefined
const saved = vi.fn(), closed = vi.fn()
beforeEach(async () => { vi.clearAllMocks(); mocks.process.mockResolvedValue(null); await act(async () => { root = create(React.createElement(InboxProcessing, { task, userContexts: ['@custom'], onProcessed: saved, onClose: closed, onReload: vi.fn(), onEdit: vi.fn() })) }) })
afterEach(async () => { await act(async () => { root?.unmount(); root = undefined }) })
async function press(label: string) { await act(async () => { root!.root.findAllByType('Button' as never).find(node => node.props.accessibilityLabel === label || node.findAllByType('Text' as never).some(child => child.props.children === label))!.props.onPress() }) }
async function type(label: string, text: string) { await act(async () => { root!.root.findByProps({ accessibilityLabel: label }).props.onChangeText(text) }) }
async function mine() { await press('Yes'); await press('No — keep processing'); await press('Yes') }
function command() { return mocks.process.mock.calls[0]?.[0] }
describe('native GTD processing matches the web branches', () => {
  it.each(['Trash', 'Notes'])('processes a non-actionable item to %s', async label => {
    await press('No'); await press(label)
    expect(command()).toEqual({ taskId: task.id, version: task.updated_at, action: label.toLowerCase() })
    expect(saved).toHaveBeenCalledOnce()
  })
  it('finishes the two-minute branch directly', async () => {
    await press('Yes'); await press('Yes — do it now')
    expect(command().action).toBe('done')
  })
  it('delegates with a person and contexts', async () => {
    await press('Yes'); await press('No — keep processing'); await press('No — I’m waiting on someone')
    await type('Person, company, or event', 'Alice'); await press('@phone'); await press('Move to Waiting For')
    expect(command()).toMatchObject({ action: 'waiting_for', delegatedTo: 'Alice', contexts: ['@phone'] })
  })
  it('defers to Someday/Maybe without requiring a review date', async () => {
    await mine(); await press('No — defer to Someday/Maybe'); await press('Save to Someday/Maybe')
    expect(command().action).toBe('someday_maybe')
  })
  it('schedules a local date with recurrence', async () => {
    await mine(); await press('Yes — pick a date or time'); await press('Scheduled date')
    await act(async () => { mocks.picker.mock.calls[0][0].onChange({ type: 'set' }, new Date(2026, 10, 2, 12)) })
    await press('weekly'); await press('Add to Calendar')
    expect(command()).toMatchObject({ action: 'calendar', recurrenceRule: 'weekly', scheduledAt: new Date(2026, 10, 2, 9).toISOString() })
  })
  it('creates a concrete next action with contexts and recurrence', async () => {
    await mine(); await press('No — do it as soon as possible'); await press('Yes')
    await type('Next action', 'Call Alice'); await press('@phone'); await press('daily'); await press('Add to Next Actions')
    expect(command()).toMatchObject({ action: 'next_actions', nextActionTitle: 'Call Alice', contexts: ['@phone'], recurrenceRule: 'daily' })
  })
  it('creates a multi-step project with an outcome, plan and first action', async () => {
    await mine(); await press('No — do it as soon as possible'); await press('No — it’s a Project')
    await type('Completion criteria', 'Live'); await type('Rough plan — one step per line', 'Draft\nReview'); await type('First next action', 'Write draft'); await press('Create project')
    expect(command()).toMatchObject({ action: 'project', title: task.title, completionCriteria: 'Live', roughPlanLines: ['Draft', 'Review'], firstStepTitle: 'Write draft' })
  })
  it('navigates back without processing and preserves entered drafts', async () => {
    await mine(); await press('No — defer to Someday/Maybe'); await press('Back')
    expect(mocks.process).not.toHaveBeenCalled()
    expect(root!.root.findAllByType('Text' as never).some(node => node.props.children === 'Does this have a specific date or time?')).toBe(true)
  })
  it('keeps the wizard open and blocks duplicate submits while saving', async () => {
    let reject!: (reason: Error) => void
    mocks.process.mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
    await press('No'); await press('Notes'); await press('Notes')
    expect(mocks.process).toHaveBeenCalledOnce()
    await act(async () => { reject(new Error('Task changed. Reload it.')) })
    expect(saved).not.toHaveBeenCalled()
    expect(root!.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain('Task changed')
  })
})
