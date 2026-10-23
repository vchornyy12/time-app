import { useState, useRef } from 'react'
import { View, SectionList, TouchableOpacity, Text, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TaskRow } from '../../components/TaskRow'
import { EmptyState } from '../../components/EmptyState'
import { CaptureModal } from '../../components/CaptureModal'
import { TaskEditor } from '../../components/TaskEditor'
import { useTaskList } from '../../lib/use-task-list'
import { completeTask } from '../../lib/tasks'

export default function TodayScreen() {
  const calendar = useTaskList('calendar')
  const nextActions = useTaskList('next_actions')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)
  const completing = useRef(new Set<string>())
  const sections = [
    { title: 'TODAY', data: calendar.tasks, remove: calendar.remove },
    { title: 'NEXT ACTIONS', data: nextActions.tasks, remove: nextActions.remove },
  ].filter(section => section.data.length > 0)
  const error = completionError || calendar.error || nextActions.error
  async function refresh() {
    await Promise.all([calendar.reload(), nextActions.reload()])
  }

  async function handleCompleteTask(taskId: string, remove: (id: string) => void) {
    if (completing.current.has(taskId)) return
    completing.current.add(taskId)
    try {
      await completeTask(calendar.userId, taskId)
      remove(taskId)
      setCompletionError(null)
    } catch { setCompletionError('Unable to complete task. Please try again.') }
    finally { completing.current.delete(taskId) }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {error && <Text style={styles.errorBanner}>{error}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={task => task.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={calendar.loading || nextActions.loading} onRefresh={refresh} tintColor="#3ECF8E" />}
        onEndReached={() => { void calendar.loadMore(); void nextActions.loadMore() }}
        onEndReachedThreshold={0.3}
        initialNumToRender={12}
        windowSize={7}
        ListEmptyComponent={calendar.loading || nextActions.loading ? null : <EmptyState message="Nothing here yet." />}
        ListFooterComponent={calendar.loading || nextActions.loading ? <ActivityIndicator color="#3ECF8E" /> : null}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item, section }) => (
          <TaskRow
            title={item.title}
            onOpen={() => setSelected(item.id)}
            time={section.title === 'TODAY' && item.scheduled_at ? new Date(item.scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : undefined}
            synced={section.title === 'TODAY' ? !!item.google_calendar_event_id : undefined}
            context={item.contexts?.[0] ?? null}
            isRecurring={!!item.recurrence_rule}
            onComplete={() => handleCompleteTask(item.id, section.remove)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        stickySectionHeadersEnabled={false}
      />
      <TouchableOpacity style={styles.fab} accessibilityRole="button" accessibilityLabel="Capture a task" disabled={!calendar.userId} onPress={() => setCaptureOpen(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
      <CaptureModal visible={captureOpen} userId={calendar.userId}
        onClose={() => setCaptureOpen(false)}
        onCreated={() => { setCaptureOpen(false); void refresh() }} />
      <TaskEditor taskId={selected} userId={calendar.userId} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void refresh() }} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  list: { padding: 16, paddingBottom: 80, flexGrow: 1 },
  sectionHeader: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  separator: { height: 8 },
  sectionSeparator: { height: 20 },
  errorBanner: {
    backgroundColor: '#7f1d1d',
    color: '#fca5a5',
    padding: 12,
    fontSize: 13,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3ECF8E',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#3ECF8E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: { color: '#000', fontSize: 28, lineHeight: 32 },
})
