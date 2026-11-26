import { memo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Repeat, Sparkles } from 'lucide-react-native'
import { sourceLabel } from '../../lib/task-source'

interface TaskRowProps {
  title: string
  time?: string | null
  synced?: boolean
  context?: string | null
  isRecurring?: boolean
  /** Where an AI assistant captured the item from (gmail, google_chat, ...). */
  source?: string | null
  onComplete?: () => Promise<void>
  onOpen?: () => void
}

export const TaskRow = memo(function TaskRow({ title, time, synced, context, isRecurring, source, onComplete, onOpen }: TaskRowProps) {
  const [checked, setChecked] = useState(false)
  const pending = useRef(false)

  async function handlePress() {
    if (pending.current) return
    pending.current = true
    setChecked(true)
    try { await onComplete?.() } finally { pending.current = false; setChecked(false) }
  }

  return (
    <View style={styles.row}>
      {onComplete !== undefined && (
        <TouchableOpacity
          onPress={handlePress}
          accessibilityRole="checkbox"
          accessibilityLabel={`Complete ${title}`}
          accessibilityState={{ checked, disabled: checked }}
          disabled={checked}
          style={[styles.checkbox, checked && styles.checkboxChecked]}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />
      )}
      {time !== undefined && (
        <Text style={styles.time}>{time ?? '—'}</Text>
      )}
      <TouchableOpacity style={styles.content} onPress={onOpen} disabled={!onOpen} accessibilityRole={onOpen ? 'button' : undefined} accessibilityLabel={onOpen ? `Open ${title}` : undefined}>
        <Text style={styles.title} numberOfLines={3}>{title}</Text>
        {(isRecurring || context || source) ? (
          <View style={styles.metaRow}>
            {isRecurring && <Repeat color="rgba(255,255,255,0.35)" size={13} />}
            {context ? <Text style={styles.context}>{context.startsWith('@') ? context : `@${context}`}</Text> : null}
            {source ? (
              <View style={styles.source} accessibilityLabel={`Captured by an AI assistant from ${sourceLabel(source)}`}>
                <Sparkles color="rgba(255,255,255,0.45)" size={11} />
                <Text style={styles.sourceText}>via {sourceLabel(source)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
      {synced !== undefined && (
        <View style={[styles.dot, synced ? styles.dotSynced : styles.dotUnsynced]} />
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  time: { color: 'rgba(255,255,255,0.45)', fontSize: 13, width: 56, textAlign: 'right', flexShrink: 0 },
  content: { flex: 1 },
  title: { color: '#ffffff', fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  context: { color: 'rgba(255,255,255,0.60)', fontSize: 12 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  sourceText: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotSynced: { backgroundColor: '#3ECF8E' },
  dotUnsynced: { backgroundColor: '#f59e0b' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#3ECF8E',
    borderColor: '#3ECF8E',
  },
})
