import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'

interface TaskRowProps {
  title: string
  time?: string | null
  synced?: boolean
  context?: string | null
  onComplete?: () => void
}

export function TaskRow({ title, time, synced, context, onComplete }: TaskRowProps) {
  const [checked, setChecked] = useState(false)

  function handlePress() {
    setChecked(true)
    setTimeout(() => onComplete?.(), 150)
  }

  return (
    <View style={styles.row}>
      {onComplete !== undefined && (
        <TouchableOpacity
          onPress={handlePress}
          style={[styles.checkbox, checked && styles.checkboxChecked]}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />
      )}
      {time !== undefined && (
        <Text style={styles.time}>{time ?? '—'}</Text>
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {context ? (
          <Text style={styles.context}>@{context}</Text>
        ) : null}
      </View>
      {synced !== undefined && (
        <View style={[styles.dot, synced ? styles.dotSynced : styles.dotUnsynced]} />
      )}
    </View>
  )
}

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
  context: { color: 'rgba(255,255,255,0.60)', fontSize: 12, marginTop: 2 },
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
