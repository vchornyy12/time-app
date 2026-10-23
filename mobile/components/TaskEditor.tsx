import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DEFAULT_CONTEXTS } from '../../lib/constants/contexts'
import { contexts as contextsSchema, title as titleSchema } from '../../lib/validation/schemas'
import { fetchTaskDetail, fetchUserContexts, saveTaskDetail, type TaskDetail } from '../lib/tasks'
import { InboxProcessing } from './InboxProcessing'

interface Props { taskId: string | null; userId: string; onClose: () => void; onSaved: () => void; startProcessing?: boolean }
export function TaskEditor(props: Props) {
  if (!props.taskId || !props.userId) return null
  return <Editor key={`${props.userId}:${props.taskId}`} {...props} taskId={props.taskId} />
}
function Editor({ taskId, userId, onClose, onSaved, startProcessing = false }: Props & { taskId: string }) {
  const [processing, setProcessing] = useState(startProcessing)
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [title, setTitle] = useState('')
  const [contexts, setContexts] = useState<string[]>([])
  const [available, setAvailable] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const pending = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null); setTask(null)
    void fetchTaskDetail(userId, taskId, controller.signal).then(value => {
      if (controller.signal.aborted) return
      setTask(value); setTitle(value.title); setContexts(value.contexts ?? [])
    }).catch(() => { if (!controller.signal.aborted) setError('Unable to open task. It may have changed or been removed. Try reloading.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    void fetchUserContexts(userId, controller.signal).then(value => {
      if (!controller.signal.aborted) setAvailable(value)
    }).catch(() => { /* Existing task contexts and defaults remain available. */ })
    return () => controller.abort()
  }, [taskId, userId, revision])

  const dirty = task && (title !== task.title || custom.trim() || JSON.stringify(contexts) !== JSON.stringify(task.contexts ?? []))
  function close() {
    if (pending.current) return
    if (dirty) Alert.alert('Discard changes?', 'Your edits have not been saved.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose },
    ])
    else onClose()
  }
  function reload() {
    if (dirty) Alert.alert('Reload task?', 'This replaces your unsaved edits with the latest saved task.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Reload', onPress: () => setRevision(n => n + 1) },
    ])
    else setRevision(n => n + 1)
  }
  function toggle(context: string) {
    if (contexts.includes(context)) setContexts(contexts.filter(value => value !== context))
    else if (contexts.length < 20) setContexts([...contexts, context])
    else setError('Choose at most 20 contexts.')
  }
  function addContext() {
    const raw = custom.trim()
    if (!raw) return
    const context = (raw.startsWith('@') ? raw : `@${raw}`).toLowerCase()
    if (context.length > 50) { setError('A context can have at most 50 characters.'); return }
    if (!contexts.includes(context)) {
      if (contexts.length >= 20) { setError('Choose at most 20 contexts.'); return }
      setContexts([...contexts, context])
    }
    setCustom(''); setError(null)
  }
  async function save(process: boolean) {
    if (!task || pending.current) return
    if (custom.trim()) { setError('Tap Add to include the new context, or clear its text before saving.'); return }
    const validatedTitle = titleSchema.safeParse(title)
    const validatedContexts = contextsSchema.safeParse(contexts)
    if (!validatedTitle.success || !validatedContexts.success) { setError('Enter a title of 1–500 characters and at most 20 contexts of up to 50 characters.'); return }
    pending.current = true; setSaving(true); setError(null)
    try {
      await saveTaskDetail(userId, task, { title: validatedTitle.data, contexts: validatedContexts.data }, process)
      if (alive.current) onSaved()
    } catch {
      if (alive.current) setError('Unable to save. Check your connection. If the task changed elsewhere or a previous save timed out, reload it before retrying.')
    } finally {
      pending.current = false
      if (alive.current) setSaving(false)
    }
  }
  const choices = [...new Set([...DEFAULT_CONTEXTS, ...available, ...contexts])]
  if (processing && task && task.status === 'inbox') return <InboxProcessing task={task} userContexts={available} onProcessed={onSaved} onClose={onClose} onReload={() => setRevision(n => n + 1)} onEdit={() => setProcessing(false)} />
  return <Modal visible animationType="slide" onRequestClose={close}>
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}><Text style={styles.heading}>Task details</Text><TouchableOpacity accessibilityRole="button" onPress={close} disabled={saving}><Text style={styles.link}>Close</Text></TouchableOpacity></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          {loading && <ActivityIndicator color="#3ECF8E" />}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {!loading && <TouchableOpacity accessibilityRole="button" onPress={reload} disabled={saving}><Text style={styles.link}>Reload latest task</Text></TouchableOpacity>}
          {task && <>
            <Text style={styles.label}>{task.status.replace(/_/g, ' ').toUpperCase()}</Text>
            {task.status === 'inbox' && <Text style={styles.hint}>Save any edits, then process this item with the GTD guide.</Text>}
            <Text style={styles.label}>Title</Text>
            <TextInput accessibilityLabel="Task title" value={title} onChangeText={setTitle} editable={!saving} multiline style={styles.input} placeholderTextColor="#999" />
            <Text style={styles.label}>Contexts</Text>
            <View style={styles.chips}>{choices.map(context => <TouchableOpacity key={context} accessibilityRole="checkbox" accessibilityLabel={context} accessibilityState={{ checked: contexts.includes(context), disabled: saving }} disabled={saving} onPress={() => toggle(context)} style={[styles.chip, contexts.includes(context) && styles.selected]}><Text style={styles.text}>{context}</Text></TouchableOpacity>)}</View>
            <View style={styles.customRow}><TextInput accessibilityLabel="New task context" style={[styles.input, { flex: 1 }]} placeholder="@custom context" placeholderTextColor="#999" value={custom} onChangeText={setCustom} editable={!saving} autoCapitalize="none" onSubmitEditing={addContext} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Add context" onPress={addContext} disabled={saving || !custom.trim()} style={styles.add}><Text style={styles.link}>Add</Text></TouchableOpacity></View>
            <Text style={styles.hint}>New contexts are saved on this task.</Text>
            {task.scheduled_at && <Text style={styles.hint}>Scheduled: {new Date(task.scheduled_at).toLocaleString()}</Text>}
            {task.due_date && <Text style={styles.hint}>Due: {task.due_date}</Text>}
            {task.delegated_to && <Text style={styles.hint}>Waiting for: {task.delegated_to}</Text>}
            {task.recurrence_rule && <Text style={styles.hint}>Repeats: {task.recurrence_rule}</Text>}
            <TouchableOpacity accessibilityRole="button" onPress={() => { void save(false) }} disabled={saving} style={[styles.button, styles.secondary, saving && styles.disabled]}><Text style={styles.text}>Save changes</Text></TouchableOpacity>
            {task.status === 'inbox' && <TouchableOpacity accessibilityRole="button" onPress={() => { if (dirty) { setError('Save your changes before processing this item.'); return } setProcessing(true) }} disabled={saving} style={[styles.button, saving && styles.disabled]}><Text style={styles.primaryText}>Process Inbox item</Text></TouchableOpacity>}
            {saving && <ActivityIndicator color="#3ECF8E" />}
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  heading: { color: '#fff', fontSize: 20, fontWeight: '600' },
  body: { padding: 20, gap: 14, paddingBottom: 40 },
  label: { color: '#bbb', fontSize: 12, fontWeight: '600' },
  hint: { color: '#aaa', lineHeight: 21, fontSize: 14 },
  text: { color: '#fff', fontSize: 15 },
  link: { color: '#3ECF8E', fontSize: 16, paddingVertical: 8 },
  input: { backgroundColor: '#242424', color: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#444', padding: 14, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#242424', borderWidth: 1, borderColor: '#444', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14 },
  selected: { borderColor: '#3ECF8E', backgroundColor: '#16412d' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  add: { padding: 6 },
  button: { backgroundColor: '#3ECF8E', borderRadius: 10, padding: 16, alignItems: 'center' },
  primaryText: { color: '#091c13', fontSize: 16, fontWeight: '600' },
  secondary: { backgroundColor: '#333' },
  disabled: { opacity: 0.5 },
  error: { color: '#fca5a5', lineHeight: 21 },
})
