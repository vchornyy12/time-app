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
import { useNavigation } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { TaskRow } from '../../components/TaskRow'
import { EmptyState } from '../../components/EmptyState'
import { CaptureModal } from '../../components/CaptureModal'
import type { Task } from '@shared/types'

export default function InboxScreen() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [userId, setUserId] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigation = useNavigation()

  async function fetchTasks() {
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user.id
    if (!uid) return
    setUserId(uid)

    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('id, title, created_at')
      .eq('user_id', uid)
      .eq('status', 'inbox')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setTasks((data as Task[]) ?? [])
  }

  useEffect(() => { fetchTasks() }, [])

  // Update header title with inbox count
  useEffect(() => {
    navigation.setOptions({
      title: tasks.length > 0 ? `Inbox (${tasks.length})` : 'Inbox',
    })
  }, [tasks.length, navigation])

  // Refresh after capture closes (new item may have been added)
  function handleCaptureClose() {
    setCaptureOpen(false)
    fetchTasks()
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTasks()
    setRefreshing(false)
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3ECF8E" />}
        ListEmptyComponent={<EmptyState message="Inbox clear." />}
        renderItem={({ item }) => (
          <TaskRow title={item.title} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCaptureOpen(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <CaptureModal
        visible={captureOpen}
        onClose={handleCaptureClose}
        userId={userId}
      />
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
