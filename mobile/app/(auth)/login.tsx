import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { sendMagicLink } from '../../lib/auth'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const err = await sendMagicLink(email)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setSent(true)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>GTD Companion</Text>
        <Text style={styles.subtitle}>Sign in with your email</Text>

        {sent ? (
          <View style={styles.sentBox}>
            <Text style={styles.sentText}>
              Check your inbox — we sent a magic link to{'\n'}
              <Text style={styles.sentEmail}>{email}</Text>
            </Text>
            <TouchableOpacity onPress={() => { setSent(false); setEmail('') }}>
              <Text style={styles.link}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!loading}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              style={[styles.button, (!email.trim() || loading) && styles.buttonDisabled]}
              onPress={handleSend}
              disabled={!email.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send magic link</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 16, color: '#888', marginBottom: 32 },
  input: {
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  error: { color: '#f87171', fontSize: 14, marginBottom: 12 },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sentBox: { gap: 16 },
  sentText: { color: '#aaa', fontSize: 15, lineHeight: 22 },
  sentEmail: { color: '#fff', fontWeight: '600' },
  link: { color: '#6366f1', fontSize: 15 },
})
