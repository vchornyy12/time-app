import { useState } from 'react'
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
import { supabase } from '../lib/supabase'

interface CaptureModalProps {
  visible: boolean
  onClose: () => void
  userId: string
}

export function CaptureModal({ visible, onClose, userId }: CaptureModalProps) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCapture() {
    if (!title.trim()) return
    setLoading(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('tasks')
      .insert({ title: title.trim(), status: 'inbox', user_id: userId })

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setConfirmed(true)
    setTitle('')
    setTimeout(() => {
      setConfirmed(false)
      onClose()
    }, 800)
  }

  function handleClose() {
    setTitle('')
    setError(null)
    setConfirmed(false)
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

        {confirmed ? (
          <View style={styles.confirmed}>
            <Text style={styles.confirmedText}>Added to Inbox</Text>
          </View>
        ) : (
          <View style={styles.body}>
            <TextInput
              style={styles.input}
              placeholder="What's on your mind?"
              placeholderTextColor="#555"
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
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Add to Inbox</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  heading: { fontSize: 18, fontWeight: '600', color: '#fff' },
  cancel: { fontSize: 16, color: '#6366f1' },
  body: { padding: 20, gap: 12 },
  input: {
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: { color: '#f87171', fontSize: 14 },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  confirmed: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  confirmedText: { color: '#34d399', fontSize: 20, fontWeight: '600' },
})
