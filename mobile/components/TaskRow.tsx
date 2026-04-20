import { View, Text, StyleSheet } from 'react-native'

interface TaskRowProps {
  title: string
  time?: string | null      // formatted time string e.g. "9:00 AM"
  synced?: boolean          // show green dot if synced to Google Calendar
}

export function TaskRow({ title, time, synced }: TaskRowProps) {
  return (
    <View style={styles.row}>
      {time !== undefined && (
        <Text style={styles.time}>{time ?? '—'}</Text>
      )}
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
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
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  time: { color: '#666', fontSize: 13, width: 56, textAlign: 'right', flexShrink: 0 },
  title: { flex: 1, color: '#e8e8f0', fontSize: 15 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotSynced: { backgroundColor: '#34d399' },
  dotUnsynced: { backgroundColor: '#f59e0b' },
})
