import { useRef, useState } from 'react'
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
import { sendMagicLink, signInWithPassword } from '../../lib/auth'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sending = useRef(false)

  async function handleSend() {
    if (sending.current || !email.trim()) return
    sending.current = true
    setLoading(true)
    setError(null)
    const err = usePassword ? await signInWithPassword(email, password) : await sendMagicLink(email)
    sending.current = false
    setLoading(false)
    if (err) {
      setError(err)
    } else if (!usePassword) {
      setSent(true)
    } else setPassword('')
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
              accessibilityLabel="Email"
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.40)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType={usePassword ? 'next' : 'send'}
              onSubmitEditing={usePassword ? undefined : handleSend}
              editable={!loading}
            />
            {usePassword && <TextInput accessibilityLabel="Password" style={styles.input} placeholder="Password" placeholderTextColor="rgba(255,255,255,0.40)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="password" returnKeyType="go" onSubmitEditing={handleSend} editable={!loading} />}
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={usePassword ? 'Sign in' : 'Send magic link'}
              style={[styles.button, (!email.trim() || (usePassword && !password) || loading) && styles.buttonDisabled]}
              onPress={handleSend}
              disabled={!email.trim() || (usePassword && !password) || loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>{usePassword ? 'Sign in' : 'Send magic link'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={loading} style={{ paddingVertical: 16 }} onPress={() => { setUsePassword(!usePassword); setPassword(''); setError(null) }}><Text style={styles.link}>{usePassword ? 'Use an email magic link instead' : 'Use your password instead'}</Text></TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  title: { fontSize: 28, fontWeight: '700', color: '#ffffff', marginBottom: 6 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.60)', marginBottom: 32 },
  input: {
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  error: { color: '#f87171', fontSize: 14, marginBottom: 12 },
  button: {
    backgroundColor: '#3ECF8E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  sentBox: { gap: 16 },
  sentText: { color: 'rgba(255,255,255,0.60)', fontSize: 15, lineHeight: 22 },
  sentEmail: { color: '#ffffff', fontWeight: '600' },
  link: { color: '#3ECF8E', fontSize: 15 },
})
