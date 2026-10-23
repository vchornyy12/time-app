import { useState } from 'react'
import { View, FlatList, TouchableOpacity, Text, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TaskRow } from '../../components/TaskRow'
import { EmptyState } from '../../components/EmptyState'
import { CaptureModal } from '../../components/CaptureModal'
import { TaskEditor } from '../../components/TaskEditor'
import { useTaskList } from '../../lib/use-task-list'

export default function InboxScreen() {
  const { tasks, userId, loading, error, reload, loadMore } = useTaskList('inbox')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {error && <Text style={styles.errorBanner}>{error}</Text>}
      <FlatList
        data={tasks}
        keyExtractor={task => task.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#3ECF8E" />}
        onEndReached={() => { void loadMore() }}
        onEndReachedThreshold={0.3}
        initialNumToRender={12}
        windowSize={7}
        ListEmptyComponent={loading ? null : <EmptyState message="Inbox clear." />}
        ListFooterComponent={loading ? <ActivityIndicator color="#3ECF8E" /> : null}
        renderItem={({ item }) => <TaskRow title={item.title} onOpen={() => setSelected(item.id)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      <TouchableOpacity style={styles.fab} accessibilityRole="button" accessibilityLabel="Capture a task" disabled={!userId} onPress={() => setCaptureOpen(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
      <CaptureModal visible={captureOpen} userId={userId}
        onClose={() => setCaptureOpen(false)}
        onCreated={() => { setCaptureOpen(false); void reload() }} />
      <TaskEditor startProcessing taskId={selected} userId={userId} onClose={() => { setSelected(null); void reload() }} onSaved={() => { setSelected(null); void reload() }} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  list: { padding: 16, paddingBottom: 80, flexGrow: 1 },
  separator: { height: 8 },
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
