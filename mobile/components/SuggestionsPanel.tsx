import { useCallback, useRef, useState } from 'react'
import { Alert, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Sparkles } from 'lucide-react-native'
import type { AgentSuggestion } from '@shared/types'
import { SUGGESTION_LABELS } from '../../lib/task-source'
import { decideSuggestion, fetchSuggestions } from '../lib/tasks'

/**
 * The assistant's proposals for existing tasks, shown above the Inbox like on the web.
 * The user decides; accepting runs the same server action as the web app.
 */
export function SuggestionsPanel({ userId }: { userId: string }) {
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const deciding = useRef(new Set<string>())

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    fetchSuggestions(userId, controller.signal)
      .then(rows => { if (!controller.signal.aborted) { setSuggestions(rows); setError(null) } })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load assistant suggestions.') })
    return () => controller.abort()
  }, [userId]))

  async function decide(s: AgentSuggestion, decision: 'accept' | 'dismiss') {
    if (deciding.current.has(s.id)) return
    if (decision === 'accept' && s.kind === 'follow_up' && s.draft_message) {
      try { await Share.share({ message: s.draft_message }) } catch { /* The decision is still recorded. */ }
    }
    deciding.current.add(s.id)
    setError(null)
    try {
      await decideSuggestion(s.id, decision)
      setSuggestions(previous => previous.filter(item => item.id !== s.id))
    } catch { setError('Could not save your decision. Please try again.') }
    finally { deciding.current.delete(s.id) }
  }

  if (!suggestions.length && !error) return null
  return <View style={styles.panel} accessibilityLabel="Assistant suggestions">
    <View style={styles.header}>
      <Sparkles color="rgba(255,255,255,0.45)" size={13} />
      <Text style={styles.heading}>ASSISTANT SUGGESTIONS · {suggestions.length}</Text>
    </View>
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {suggestions.map(s => {
      const evidence = s.evidence_url?.startsWith('https://') ? s.evidence_url : null
      return <View key={s.id} style={styles.card}>
        <Text style={styles.kind}>
          {SUGGESTION_LABELS[s.kind].label}
          {s.task?.delegated_to ? ` · ${s.task.delegated_to}` : ''}
          {s.task?.due_date ? ` · due ${s.task.due_date}` : ''}
        </Text>
        <Text style={styles.title}>{s.task?.title ?? 'Task'}</Text>
        <Text style={styles.text}>{s.reason}</Text>
        {s.evidence_quote && <Text style={styles.quote}>{s.evidence_quote}</Text>}
        {s.kind === 'follow_up' && s.draft_message && <Text style={styles.draft}>{s.draft_message}</Text>}
        {s.kind === 'jira_issue' && s.payload && <Text style={styles.text}>
          {s.payload.project_key}: {s.payload.summary}{s.payload.assignee ? ` · ${s.payload.assignee}` : ''}{s.payload.due ? ` · due ${s.payload.due}` : ''}
        </Text>}
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" style={styles.accept} onPress={() => { void decide(s, 'accept') }}>
            <Text style={styles.acceptText}>{s.kind === 'follow_up' ? 'Share draft' : SUGGESTION_LABELS[s.kind].accept}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => { void decide(s, 'dismiss') }}><Text style={styles.muted}>Dismiss</Text></TouchableOpacity>
          {evidence && <TouchableOpacity accessibilityRole="link" onPress={() => { void Linking.openURL(evidence).catch(() => Alert.alert('Unable to open the source link.')) }}><Text style={styles.muted}>Source</Text></TouchableOpacity>}
        </View>
      </View>
    })}
  </View>
}

const styles = StyleSheet.create({
  panel: { gap: 8, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: { color: 'rgba(255,255,255,0.40)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  card: { backgroundColor: '#1c1c1c', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, gap: 6 },
  kind: { color: 'rgba(255,255,255,0.50)', fontSize: 12, fontWeight: '600' },
  title: { color: '#fff', fontSize: 15 },
  text: { color: 'rgba(255,255,255,0.70)', fontSize: 14, lineHeight: 20 },
  quote: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 20, borderLeftWidth: 2, borderLeftColor: '#444', paddingLeft: 10 },
  draft: { color: 'rgba(255,255,255,0.70)', fontSize: 14, lineHeight: 20, backgroundColor: '#242424', borderRadius: 8, padding: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  accept: { backgroundColor: '#16412d', borderWidth: 1, borderColor: '#3ECF8E', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  acceptText: { color: '#fff', fontSize: 14 },
  muted: { color: 'rgba(255,255,255,0.50)', fontSize: 14, paddingVertical: 8 },
  error: { color: '#fca5a5', fontSize: 14 },
})
