import { useRef, useState } from 'react'
import { randomUUID } from 'expo-crypto'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { saveCapture } from '../lib/tasks'

interface CaptureModalProps {
  visible: boolean
  onClose: () => void
  userId: string
  onCreated: () => void
}

export function CaptureModal({ visible, onClose, onCreated, userId }: CaptureModalProps) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const pending = useRef(false)
  const attempt = useRef<{ title: string; userId: string; id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCapture() {
    const value = title.trim()
    if (pending.current || !value || !userId) return
    if (Array.from(value).length > 500) { setError('Use at most 500 characters.'); return }
    pending.current = true
    setLoading(true)
    setError(null)

    try {
      if (!attempt.current || attempt.current.title !== value || attempt.current.userId !== userId) {
        attempt.current = { title: value, userId, id: randomUUID() }
      }
      await saveCapture(attempt.current)

      attempt.current = null
      setTitle('')
      onCreated()
    } catch {
      setError('Unable to save. Try again when connected.')
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  function handleClose() {
    if (pending.current) return
    setTitle('')
    setLoading(false)
    setError(null)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>Quick Capture</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <TextInput
            style={styles.input}
            placeholder="What's on your mind?"
            placeholderTextColor="rgba(255,255,255,0.40)"
            value={title}
            onChangeText={setTitle}
            autoFocus
            multiline
            returnKeyType="done"
            onSubmitEditing={handleCapture}
            editable={!loading}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, (!title.trim() || loading) && styles.buttonDisabled]}
            onPress={handleCapture}
            disabled={!title.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>Add to Inbox</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 28,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  heading: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  cancel: { fontSize: 16, color: '#3ECF8E' },
  body: { padding: 20, gap: 12 },
  input: {
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: { color: '#f87171', fontSize: 14 },
  button: {
    backgroundColor: '#3ECF8E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '600' },
})
