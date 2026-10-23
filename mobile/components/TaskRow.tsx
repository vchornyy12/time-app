import { memo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Repeat } from 'lucide-react-native'

interface TaskRowProps {
  title: string
  time?: string | null
  synced?: boolean
  context?: string | null
  isRecurring?: boolean
  onComplete?: () => Promise<void>
  onOpen?: () => void
}

export const TaskRow = memo(function TaskRow({ title, time, synced, context, isRecurring, onComplete, onOpen }: TaskRowProps) {
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
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {(isRecurring || context) ? (
          <View style={styles.metaRow}>
            {isRecurring && <Repeat color="rgba(255,255,255,0.35)" size={13} />}
            {context ? <Text style={styles.context}>{context.startsWith('@') ? context : `@${context}`}</Text> : null}
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
