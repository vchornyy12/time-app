import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { DEFAULT_CONTEXTS } from '../../lib/constants/contexts'
import type { RecurrenceRule } from '../../lib/types'
import { inboxCommandSchema, type InboxCommand } from '../../lib/validation/inbox-command'
import { processInbox, type TaskDetail } from '../lib/tasks'

type Step = 'actionable' | 'reference' | 'twoMinutes' | 'mine' | 'delegate' | 'dateSpecific' | 'schedule' | 'someday' | 'singleStep' | 'project' | 'nextAction'
const numbers: Record<Step, number> = { actionable: 1, reference: 1, twoMinutes: 2, mine: 3, delegate: 3, dateSpecific: 4, schedule: 4, someday: 4, singleStep: 5, project: 5, nextAction: 5 }
interface Props { task: TaskDetail; userContexts: string[]; onProcessed: () => void; onClose: () => void; onReload: () => void; onEdit: () => void }
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function InboxProcessing({ task, userContexts, onProcessed, onClose, onReload, onEdit }: Props) {
  const [step, setStep] = useState<Step>('actionable')
  const [history, setHistory] = useState<Step[]>([])
  const [title, setTitle] = useState(task.title)
  const [contexts, setContexts] = useState<string[]>([])
  const [wfContexts, setWFContexts] = useState<string[]>([])
  const [delegatedTo, setDelegatedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [calendarRepeat, setCalendarRepeat] = useState<RecurrenceRule | null>(null)
  const [actionRepeat, setActionRepeat] = useState<RecurrenceRule | null>(null)
  const [projectTitle, setProjectTitle] = useState(task.title)
  const [criteria, setCriteria] = useState('')
  const [plan, setPlan] = useState('')
  const [firstStep, setFirstStep] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const alive = useRef(true)
  // A response may arrive after sign-out or the parent closes the modal.
  // Cleanup is installed below without tying it to wizard navigation.
  const move = (next: Step) => { setHistory([...history, step]); setStep(next); setError(null) }
  function leave(callback: () => void) {
    if (pending.current) return
    if (history.length) Alert.alert('Leave processing?', 'Your processing choices have not been saved.', [{ text: 'Continue', style: 'cancel' }, { text: 'Leave', onPress: callback }])
    else callback()
  }
  async function finish(input: Record<string, unknown>) {
    if (pending.current) return
    let parsed: ReturnType<typeof inboxCommandSchema.safeParse>
    try { parsed = inboxCommandSchema.safeParse({ taskId: task.id, version: task.updated_at, ...input }) }
    catch { setError('Choose a valid date and time.'); return }
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the fields.'); return }
    pending.current = true; setBusy(true); setError(null)
    try { await processInbox(parsed.data); if (alive.current) onProcessed() }
    catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'Unable to process task. Check your connection, then reload before retrying.') }
    finally { pending.current = false; if (alive.current) setBusy(false) }
  }
  useAlive(alive)
  const button = (label: string, onPress: () => void, disabled = false) => <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={onPress} style={[styles.button, (busy || disabled) && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>
  const question = (heading: string, hint: string) => <View style={styles.question}><Text accessibilityRole="header" style={styles.heading}>{heading}</Text><Text style={styles.hint}>{hint}</Text></View>
  const input = (label: string, value: string, onChange: (v: string) => void, multiline = false) => <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!busy} multiline={multiline} style={styles.input} /></View>
  let content
  switch (step) {
    case 'actionable': content = <>{question('Is this actionable?', 'Can you or someone else do something about this?')}{button('Yes', () => move('twoMinutes'))}{button('No', () => move('reference'))}</>; break
    case 'reference': content = <>{question('Where should it go?', 'Non-actionable items live in Trash or Notes for future reference.')}{button('Trash', () => { void finish({ action: 'trash' }) })}{button('Notes', () => { void finish({ action: 'notes' }) })}</>; break
    case 'twoMinutes': content = <>{question('Can you do this in 2 minutes or less?', "If yes, do it right now — it’s faster than tracking it.")}{button('Yes — do it now', () => { void finish({ action: 'done' }) })}{button('No — keep processing', () => move('mine'))}</>; break
    case 'mine': content = <>{question('Is this yours to do?', 'Or should someone else handle it?')}{button('Yes', () => move('dateSpecific'))}{button("No — I’m waiting on someone", () => move('delegate'))}</>; break
    case 'delegate': content = <>{question('Who or what are you waiting on?', 'Capture who needs to act, or what needs to happen.')}{input('Person, company, or event', delegatedTo, setDelegatedTo)}<DateField label="Expected by (optional)" value={dueDate} onChange={setDueDate} disabled={busy} /><Contexts value={wfContexts} onChange={setWFContexts} available={userContexts} disabled={busy} />{button('Move to Waiting For', () => { void finish({ action: 'waiting_for', delegatedTo, dueDate: dueDate || undefined, contexts: wfContexts }) }, !delegatedTo.trim())}</>; break
    case 'dateSpecific': content = <>{question('Does this have a specific date or time?', 'Hard commitments go to Calendar. Other actions can wait until you have the right context.')}{button('Yes — pick a date or time', () => move('schedule'))}{button('No — do it as soon as possible', () => move('singleStep'))}{button('No — defer to Someday/Maybe', () => move('someday'))}</>; break
    case 'schedule': content = <>{question('When should this happen?', 'Pick a date and time — it will appear in your Calendar.')}
      <DateField label="Scheduled date" value={date} onChange={setDate} disabled={busy} />
      {button(`Time: ${time}`, () => DateTimePickerAndroid.open({ mode: 'time', is24Hour: true, value: new Date(`2026-01-01T${time}:00`), onChange: (event, value) => { if (event.type === 'set' && value) setTime(`${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`) } }))}
      <Repeat value={calendarRepeat} onChange={setCalendarRepeat} disabled={busy} />
      {button('Add to Calendar', () => { const scheduled = new Date(`${date}T${time}:00`); if (Number.isNaN(scheduled.getTime())) { setError('Choose a valid date and time.'); return } void finish({ action: 'calendar', scheduledAt: scheduled.toISOString(), recurrenceRule: calendarRepeat }) }, !date)}</>; break
    case 'someday': content = <>{question('When should you review this?', 'Optional — set a date to revisit this idea.')}<DateField label="Review on (optional)" value={reviewDate} onChange={setReviewDate} disabled={busy} />{button('Save to Someday/Maybe', () => { void finish({ action: 'someday_maybe', reviewDate: reviewDate || undefined }) })}</>; break
    case 'singleStep': content = <>{question('Can this be done in a single step?', 'Multiple steps mean a Project. A single step is a Next Action.')}{button('Yes', () => move('nextAction'))}{button("No — it’s a Project", () => move('project'))}</>; break
    case 'project': content = <>{question('Create a project', 'Define the outcome and your first next action.')}{input('Project title', projectTitle, setProjectTitle)}{input('Completion criteria', criteria, setCriteria, true)}{input('Rough plan — one step per line', plan, setPlan, true)}{input('First next action', firstStep, setFirstStep)}{button('Create project', () => { void finish({ action: 'project', title: projectTitle, completionCriteria: criteria, roughPlanLines: plan.split('\n').map(value => value.trim()).filter(Boolean), firstStepTitle: firstStep }) }, !projectTitle.trim() || !firstStep.trim())}</>; break
    case 'nextAction': content = <>{question("What’s the next physical action?", 'Make it concrete — start with a verb. Then choose the context.')}{input('Next action', title, setTitle)}<Contexts value={contexts} onChange={setContexts} available={userContexts} disabled={busy} /><Repeat value={actionRepeat} onChange={setActionRepeat} disabled={busy} />{button('Add to Next Actions', () => { void finish({ action: 'next_actions', nextActionTitle: title, contexts, recurrenceRule: actionRepeat }) }, !title.trim())}</>; break
  }
  return <Modal visible animationType="slide" onRequestClose={() => { if (pending.current) return; if (history.length) { setStep(history[history.length - 1]); setHistory(history.slice(0, -1)) } else onClose() }}><SafeAreaView style={styles.container}><KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><Text style={styles.label}>Process Inbox · Step {numbers[step]} of 5</Text><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => leave(onClose)}><Text style={styles.link}>Close</Text></TouchableOpacity></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
      <Text style={styles.taskTitle}>{task.title}</Text>
      {history.length === 0 && <TouchableOpacity accessibilityRole="button" onPress={onEdit} disabled={busy}><Text style={styles.link}>Edit task details</Text></TouchableOpacity>}
      {error && <View style={styles.field}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{button('Reload latest task', () => leave(onReload))}</View>}
      {content}
      {busy && <ActivityIndicator color="#3ECF8E" />}
      {history.length > 0 && button('Back', () => { setStep(history[history.length - 1]); setHistory(history.slice(0, -1)); setError(null) })}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView></Modal>
}
function useAlive(ref: MutableRefObject<boolean>) { useEffect(() => { ref.current = true; return () => { ref.current = false } }, [ref]) }
function DateField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={disabled} style={styles.input} onPress={() => DateTimePickerAndroid.open({ mode: 'date', value: value ? new Date(`${value}T12:00:00`) : new Date(), onChange: (event, date) => { if (event.type === 'set' && date) onChange(localDate(date)) } })}><Text style={styles.text}>{value || 'Choose date'}</Text></TouchableOpacity>{!!value && <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={() => onChange('')}><Text style={styles.link}>Clear date</Text></TouchableOpacity>}</View>
}
function Repeat({ value, onChange, disabled }: { value: RecurrenceRule | null; onChange: (value: RecurrenceRule | null) => void; disabled: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>Repeat</Text><View style={styles.chips}>{([null, 'daily', 'weekly', 'monthly', 'yearly'] as const).map(rule => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: rule === value }} key={rule ?? 'none'} disabled={disabled} onPress={() => onChange(rule)} style={[styles.chip, value === rule && styles.selected]}><Text style={styles.text}>{rule ?? 'Does not repeat'}</Text></TouchableOpacity>)}</View></View>
}
function Contexts({ value, onChange, available, disabled }: { value: string[]; onChange: (value: string[]) => void; available: string[]; disabled: boolean }) {
  const [custom, setCustom] = useState('')
  const choices = [...new Set([...DEFAULT_CONTEXTS, ...available, ...value])]
  return <View style={styles.field}><Text style={styles.label}>Contexts</Text><View style={styles.chips}>{choices.map(context => <TouchableOpacity key={context} accessibilityRole="checkbox" accessibilityLabel={context} accessibilityState={{ checked: value.includes(context) }} disabled={disabled || (!value.includes(context) && value.length >= 20)} style={[styles.chip, value.includes(context) && styles.selected]} onPress={() => onChange(value.includes(context) ? value.filter(v => v !== context) : [...value, context])}><Text style={styles.text}>{context}</Text></TouchableOpacity>)}</View>
    <TextInput accessibilityLabel="Custom context" placeholder="@custom context" placeholderTextColor="#999" editable={!disabled} style={styles.input} value={custom} onChangeText={setCustom} autoCapitalize="none" maxLength={49} />
    <TouchableOpacity accessibilityRole="button" disabled={disabled || !custom.trim() || value.length >= 20} onPress={() => { const raw = custom.trim().toLowerCase(); const context = raw.startsWith('@') ? raw : `@${raw}`; onChange([...new Set([...value, context])]); setCustom('') }}><Text style={styles.link}>Add context</Text></TouchableOpacity>
  </View>
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#333' },
  body: { padding: 20, gap: 14, paddingBottom: 40 }, taskTitle: { color: '#aaa', fontSize: 15 }, heading: { color: '#fff', fontSize: 23, fontWeight: '600' }, question: { gap: 10, marginVertical: 10 }, hint: { color: '#aaa', lineHeight: 22, fontSize: 15 },
  text: { color: '#fff', fontSize: 15 }, label: { color: '#bbb', fontSize: 14 }, link: { color: '#3ECF8E', fontSize: 16, paddingVertical: 8 },
  field: { gap: 10 }, input: { color: '#fff', fontSize: 16, backgroundColor: '#242424', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#444' },
  button: { padding: 16, backgroundColor: '#16412d', borderWidth: 1, borderColor: '#3ECF8E', borderRadius: 10 }, buttonText: { color: '#fff', fontSize: 16 }, disabled: { opacity: 0.45 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#444', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20 }, selected: { borderColor: '#3ECF8E', backgroundColor: '#16412d' }, error: { color: '#fca5a5', lineHeight: 22 },
})
