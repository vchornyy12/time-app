import { useState, useEffect, useCallback } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { TaskRow } from '../../components/TaskRow'
import { EmptyState } from '../../components/EmptyState'
import { CaptureModal } from '../../components/CaptureModal'
import type { Task } from '@shared/types'

export default function TodayScreen() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [userId, setUserId] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchTasks() {
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user.id
    if (!uid) return
    setUserId(uid)

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('id, title, scheduled_at, google_calendar_event_id')
      .eq('user_id', uid)
      .eq('status', 'calendar')
      .gte('scheduled_at', startOfToday.toISOString())
      .lte('scheduled_at', endOfToday.toISOString())
      .order('scheduled_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setTasks((data as Task[]) ?? [])
  }

  useEffect(() => { fetchTasks() }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTasks()
    setRefreshing(false)
  }, [])

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#555" />}
        ListEmptyComponent={<EmptyState message="Nothing scheduled today." />}
        renderItem={({ item }) => (
          <TaskRow
            title={item.title}
            time={item.scheduled_at ? formatTime(item.scheduled_at) : null}
            synced={!!item.google_calendar_event_id}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Floating action button */}
      <TouchableOpacity style={styles.fab} onPress={() => setCaptureOpen(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <CaptureModal
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
        userId={userId}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
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
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
})
