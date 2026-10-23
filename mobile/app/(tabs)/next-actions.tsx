import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DEFAULT_CONTEXTS } from '../../../lib/constants/contexts'
import { EmptyState } from '../../components/EmptyState'
import { TaskRow } from '../../components/TaskRow'
import { TaskEditor } from '../../components/TaskEditor'
import { completeTask, fetchUserContexts } from '../../lib/tasks'
import { useTaskList } from '../../lib/use-task-list'

export default function NextActionsScreen() {
  const [context, setContext] = useState<string | null>(null)
  const list = useTaskList('next_actions', context)
  const [selected, setSelected] = useState<string | null>(null)
  const [contexts, setContexts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const completing = useRef(new Set<string>())
  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    setContexts([])
    if (list.userId) void fetchUserContexts(list.userId, controller.signal).then(values => {
      if (!controller.signal.aborted) setContexts(values)
    }).catch(() => {})
    return () => controller.abort()
  }, [list.userId]))
  const choices = [...new Set([...DEFAULT_CONTEXTS, ...contexts, ...list.tasks.flatMap(task => task.contexts ?? []), ...(context ? [context] : [])])]
  async function complete(id: string) {
    if (completing.current.has(id)) return
    completing.current.add(id)
    try { await completeTask(list.userId, id); list.remove(id); setError(null) }
    catch { setError('Unable to complete task. Please try again.') }
    finally { completing.current.delete(id) }
  }
  return <SafeAreaView edges={['bottom']} style={styles.container}>
    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {[null, ...choices].map(value => <TouchableOpacity key={value ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: context === value }} onPress={() => setContext(value)} style={[styles.chip, context === value && styles.selected]}><Text style={styles.text}>{value ?? 'All contexts'}</Text></TouchableOpacity>)}
    </ScrollView></View>
    {(error || list.error) && <Text accessibilityRole="alert" style={styles.error}>{error || list.error}</Text>}
    <FlatList data={list.tasks} keyExtractor={task => task.id} contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={list.loading} onRefresh={list.reload} tintColor="#3ECF8E" />}
      initialNumToRender={12} windowSize={7} onEndReachedThreshold={0.3} onEndReached={() => { void list.loadMore() }}
      ListEmptyComponent={list.loading ? null : <EmptyState message={context ? 'No next actions in this context.' : 'Process an inbox item to add your next action.'} />}
      ListFooterComponent={list.loading ? <ActivityIndicator color="#3ECF8E" /> : null}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => <TaskRow title={item.title} context={item.contexts?.join(' · ')} isRecurring={!!item.recurrence_rule} onOpen={() => setSelected(item.id)} onComplete={() => complete(item.id)} />} />
    <TaskEditor taskId={selected} userId={list.userId} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void list.reload() }} />
  </SafeAreaView>
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  filters: { padding: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#242424', borderWidth: 1, borderColor: '#444' },
  selected: { borderColor: '#3ECF8E', backgroundColor: '#16412d' },
  text: { color: '#fff', fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 30, flexGrow: 1 },
  error: { color: '#fca5a5', padding: 12 },
})
