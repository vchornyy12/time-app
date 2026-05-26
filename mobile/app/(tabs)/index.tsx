import { useState, useEffect, useCallback } from 'react'
import {
  View,
  SectionList,
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

type Section = {
  title: string
  data: Task[]
}

export default function TodayScreen() {
  const [sections, setSections] = useState<Section[]>([])
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

    const [calendarResult, nextActionsResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, scheduled_at, google_calendar_event_id')
        .eq('user_id', uid)
        .eq('status', 'calendar')
        .gte('scheduled_at', startOfToday.toISOString())
        .lte('scheduled_at', endOfToday.toISOString())
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('tasks')
        .select('id, title, contexts, created_at')
        .eq('user_id', uid)
        .eq('status', 'next_actions')
        .order('created_at', { ascending: false }),
    ])

    if (calendarResult.error) {
      setError(calendarResult.error.message)
      return
    }
    if (nextActionsResult.error) {
      setError(nextActionsResult.error.message)
      return
    }

    const calendarTasks = (calendarResult.data as Task[]) ?? []
    const nextActions = (nextActionsResult.data as Task[]) ?? []

    const newSections: Section[] = []
    if (calendarTasks.length > 0) {
      newSections.push({ title: 'TODAY', data: calendarTasks })
    }
    if (nextActions.length > 0) {
      newSections.push({ title: 'NEXT ACTIONS', data: nextActions })
    }
    setSections(newSections)
    setError(null)
  }

  useEffect(() => { fetchTasks() }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTasks()
    setRefreshing(false)
  }, [])

  async function handleCompleteTask(taskId: string) {
    setSections((prev) =>
      prev
        .map((s) => ({ ...s, data: s.data.filter((t) => t.id !== taskId) }))
        .filter((s) => s.data.length > 0),
    )
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', taskId)
    if (updateError) {
      setError(updateError.message)
      fetchTasks()
    }
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3ECF8E" />}
        ListEmptyComponent={<EmptyState message="Nothing here yet." />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => {
          const isCalendar = section.title === 'TODAY'
          return (
            <TaskRow
              title={item.title}
              time={isCalendar && item.scheduled_at ? formatTime(item.scheduled_at) : undefined}
              synced={isCalendar ? !!item.google_calendar_event_id : undefined}
              context={item.contexts?.[0] ?? null}
              onComplete={() => handleCompleteTask(item.id)}
            />
          )
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        stickySectionHeadersEnabled={false}
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
