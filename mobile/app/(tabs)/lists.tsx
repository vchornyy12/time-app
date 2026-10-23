import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Project } from '../../../lib/types'
import { useSession } from '../../lib/session'
import { supabase } from '../../lib/supabase'
import { type TaskStatus } from '../../lib/tasks'
import { useTaskList } from '../../lib/use-task-list'
import { TaskRow } from '../../components/TaskRow'
import { TaskEditor } from '../../components/TaskEditor'
import { EmptyState } from '../../components/EmptyState'
const lists = [ ['waiting_for', 'Waiting For'], ['calendar', 'Calendar'], ['someday_maybe', 'Someday / Maybe'], ['notes', 'Notes'], ['trash', 'Trash'], ['done', 'Done'], ['projects', 'Projects'] ] as const
export default function ListsScreen() {
  const [selected, setSelected] = useState<string>('waiting_for')
  const userId = useSession()?.user.id ?? ''
  return <SafeAreaView edges={['bottom']} style={styles.container}><View><ScrollView horizontal contentContainerStyle={styles.filters}>{lists.map(([status, title]) => <TouchableOpacity accessibilityRole="button" key={status} accessibilityState={{ selected: selected === status }} style={[styles.chip, selected === status && styles.active]} onPress={() => setSelected(status)}><Text style={styles.text}>{title}</Text></TouchableOpacity>)}</ScrollView></View>
    {selected === 'projects' ? <Projects key={userId} userId={userId} /> : <Tasks key={`${userId}:${selected}`} status={selected as TaskStatus} />}
  </SafeAreaView>
}
function Tasks({ status }: { status: TaskStatus }) {
  const list = useTaskList(status, null, true)
  const [selected, setSelected] = useState<string | null>(null)
  const pending = useRef(false)
  async function restore(id: string) {
    if (pending.current) return
    pending.current = true
    try {
      const { error } = await supabase.from('tasks').update({ status: 'inbox' }).eq('id', id).eq('user_id', list.userId).eq('status', 'trash').select('id').single()
      if (error) throw error
      list.remove(id)
    } catch { Alert.alert('Unable to restore', 'Reload the list and try again.') }
    finally { pending.current = false }
  }
  return <View style={styles.container}>
    {list.error && <Text accessibilityRole="alert" style={styles.error}>{list.error}</Text>}
    <FlatList data={list.tasks} keyExtractor={task => task.id} contentContainerStyle={styles.body} initialNumToRender={12} windowSize={7}
      refreshControl={<RefreshControl refreshing={list.loading} onRefresh={list.reload} tintColor="#3ECF8E" />} onEndReached={() => { void list.loadMore() }} onEndReachedThreshold={0.3}
      ListEmptyComponent={list.loading ? null : <EmptyState message="Nothing here yet." />} ListFooterComponent={list.loading ? <ActivityIndicator color="#3ECF8E" /> : null}
      renderItem={({ item }) => <View style={styles.card}>
        <TaskRow title={item.title} context={item.contexts?.join(' · ')} isRecurring={!!item.recurrence_rule} onOpen={() => setSelected(item.id)} />
        {item.scheduled_at && <Text style={styles.meta}>Scheduled: {new Date(item.scheduled_at).toLocaleString()}</Text>}
        {item.delegated_to && <Text style={styles.meta}>Waiting for: {item.delegated_to}</Text>}
        {item.due_date && <Text style={styles.meta}>{status === 'someday_maybe' ? 'Review' : 'Expected'}: {item.due_date}</Text>}
        {status === 'trash' && <TouchableOpacity accessibilityRole="button" onPress={() => { void restore(item.id) }}><Text style={styles.link}>Restore to Inbox</Text></TouchableOpacity>}
      </View>} />
    <TaskEditor taskId={selected} userId={list.userId} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void list.reload() }} />
  </View>
}
function Projects({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const cursor = useRef<Project | null>(null)
  const more = useRef(true)
  const load = useCallback(async (reset: boolean) => {
    if (!userId || (!reset && (request.current || !more.current))) return
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    if (reset) { cursor.current = null; more.current = true }
    setLoading(true)
    try {
      let query = supabase.from('projects').select('id, title, completion_criteria, rough_plan, first_step_task_id, status, created_at, updated_at, user_id').eq('user_id', userId)
      if (cursor.current) query = query.or(`created_at.lt.${cursor.current.created_at},and(created_at.eq.${cursor.current.created_at},id.lt.${cursor.current.id})`)
      const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50).abortSignal(controller.signal)
      if (error) throw error
      if (controller.signal.aborted) return
      const page = (data ?? []) as Project[]
      more.current = page.length === 50
      if (page.length) cursor.current = page[page.length - 1]
      setRows(previous => reset ? page : [...new Map([...previous, ...page].map(p => [p.id, p])).values()]); setError(false)
    } catch { if (!controller.signal.aborted) setError(true) }
    finally { if (request.current === controller) { request.current = null; setLoading(false) } }
  }, [userId])
  useFocusEffect(useCallback(() => { void load(true); return () => { request.current?.abort(); request.current = null } }, [load]))
  return <View style={styles.container}>{error && <Text style={styles.error}>Unable to load projects. Pull to refresh.</Text>}<FlatList data={rows} keyExtractor={project => project.id} contentContainerStyle={styles.body}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(true) }} tintColor="#3ECF8E" />} onEndReached={() => { void load(false) }}
    ListEmptyComponent={loading ? null : <EmptyState message="No projects yet." />} ListFooterComponent={loading ? <ActivityIndicator color="#3ECF8E" /> : null}
    renderItem={({ item }) => <View style={[styles.card, styles.project]}><Text style={styles.projectTitle}>{item.title}</Text><Text style={styles.meta}>{item.status}</Text>{!!item.completion_criteria && <Text style={styles.text}>Outcome: {item.completion_criteria}</Text>}{item.rough_plan.map(step => <Text style={styles.meta} key={step.id}>• {step.text}</Text>)}{item.first_step_task_id && <TouchableOpacity accessibilityRole="button" onPress={() => setSelected(item.first_step_task_id)}><Text style={styles.link}>Open first next action</Text></TouchableOpacity>}</View>} />
    <TaskEditor taskId={selected} userId={userId} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void load(true) }} />
  </View>
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#181818' }, filters: { padding: 16, gap: 8 }, chip: { padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#444' }, active: { borderColor: '#3ECF8E', backgroundColor: '#16412d' }, text: { color: '#fff', fontSize: 15 }, body: { padding: 16, gap: 12, paddingBottom: 40, flexGrow: 1 }, card: { marginBottom: 12, gap: 8 }, meta: { color: '#bbb', fontSize: 14, paddingHorizontal: 12 }, link: { color: '#3ECF8E', padding: 12, fontSize: 15 }, error: { color: '#fca5a5', padding: 12 }, project: { padding: 16, borderWidth: 1, borderColor: '#444', borderRadius: 12 }, projectTitle: { color: '#fff', fontSize: 20, fontWeight: '600' } })
