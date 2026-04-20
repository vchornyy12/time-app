# Mobile App — GTD Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a focused Expo (React Native) companion app inside `mobile/` with magic-link auth, a Today screen (calendar tasks), an Inbox screen, and a quick-capture modal.

**Architecture:** Expo Router for file-based screen routing. Direct Supabase JS client calls (no server actions). Shared TypeScript types from `../../lib/types` via a Metro bundler alias `@shared`. Session persisted to AsyncStorage.

**Tech Stack:** Expo SDK 52, Expo Router v4, React Native, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, TypeScript.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `mobile/package.json` | Create | Expo project manifest + deps |
| `mobile/app.json` | Create | Expo config: name, slug, scheme `timeapp`, android package |
| `mobile/tsconfig.json` | Create | Extends `expo/tsconfig.base`, adds `@shared` path alias |
| `mobile/metro.config.js` | Create | Adds `@shared` resolver alias pointing to `../../lib` |
| `mobile/babel.config.js` | Create | `babel-preset-expo` |
| `mobile/eas.json` | Create | EAS build profiles: preview (APK) + production (AAB) |
| `mobile/lib/supabase.ts` | Create | Supabase client with AsyncStorage session persistence |
| `mobile/lib/auth.ts` | Create | `sendMagicLink`, `verifyMagicLink`, `signOut`, `getSession` |
| `mobile/app/_layout.tsx` | Create | Root layout: session check, deep link handler, redirect to auth or tabs |
| `mobile/app/(auth)/_layout.tsx` | Create | Stack navigator for auth screens |
| `mobile/app/(auth)/login.tsx` | Create | Email input + "Send magic link" button + success state |
| `mobile/app/(tabs)/_layout.tsx` | Create | Bottom tab bar (Today, Inbox) |
| `mobile/app/(tabs)/index.tsx` | Create | Today screen: calendar tasks + FAB |
| `mobile/app/(tabs)/inbox.tsx` | Create | Inbox screen: inbox tasks + FAB |
| `mobile/components/CaptureModal.tsx` | Create | Full-screen RN Modal: text input → insert to inbox |
| `mobile/components/TaskRow.tsx` | Create | Reusable task row (time + title + sync badge) |
| `mobile/components/EmptyState.tsx` | Create | Empty state with message |
| `netlify.toml` | Create | Ignore `mobile/` changes to skip unnecessary web builds |

---

## Task 1: Scaffold Expo project

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/metro.config.js`
- Create: `mobile/babel.config.js`

- [ ] **Step 1: Create the `mobile/` directory and initialise the Expo project**

```bash
cd /Users/volodymyrchornyi/Documents/time-app
npx create-expo-app@latest mobile --template blank-typescript
```

Expected output: `✅ Your project is ready!`

- [ ] **Step 2: Install required dependencies**

```bash
cd mobile
npx expo install expo-router expo-linking expo-constants expo-status-bar \
  react-native-safe-area-context react-native-screens \
  @supabase/supabase-js @react-native-async-storage/async-storage
```

- [ ] **Step 3: Replace `mobile/package.json` with correct entry point and scripts**

Open `mobile/package.json` and ensure `"main"` points to expo-router and scripts are correct. Replace the file content with:

```json
{
  "name": "gtd-companion",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "lint": "expo lint"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "2.1.2",
    "@supabase/supabase-js": "^2.97.0",
    "expo": "~52.0.0",
    "expo-constants": "~17.0.8",
    "expo-linking": "~7.0.5",
    "expo-router": "~4.0.20",
    "expo-status-bar": "~2.0.1",
    "react": "18.3.1",
    "react-native": "0.76.7",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@types/react": "~18.3.12",
    "typescript": "^5.3.3"
  },
  "private": true
}
```

- [ ] **Step 4: Write `mobile/app.json`**

```json
{
  "expo": {
    "name": "GTD Companion",
    "slug": "gtd-companion",
    "version": "1.0.0",
    "scheme": "timeapp",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "backgroundColor": "#0f0f13"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#0f0f13"
      },
      "package": "com.gtdcompanion.app"
    },
    "plugins": [
      "expo-router"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 5: Write `mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@shared/*": ["../../lib/*"]
    }
  }
}
```

- [ ] **Step 6: Write `mobile/metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  '@shared': path.resolve(__dirname, '../../lib'),
};

module.exports = config;
```

- [ ] **Step 7: Write `mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 8: Write `mobile/eas.json`**

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

- [ ] **Step 9: Create required assets directory**

```bash
mkdir -p mobile/assets/images
```

Copy or create placeholder `icon.png` and `adaptive-icon.png` (1024×1024 px). If you have the web app logo at `app/logo.png`, you can copy it:

```bash
cp /Users/volodymyrchornyi/Documents/time-app/app/logo.png mobile/assets/images/icon.png
cp /Users/volodymyrchornyi/Documents/time-app/app/logo.png mobile/assets/images/adaptive-icon.png
```

- [ ] **Step 10: Commit**

```bash
cd /Users/volodymyrchornyi/Documents/time-app
git add mobile/
git commit -m "feat(mobile): scaffold Expo project with Expo Router"
```

---

## Task 2: Add netlify.toml to skip mobile-only builds

**Files:**
- Create: `netlify.toml`

- [ ] **Step 1: Write `netlify.toml` at the repo root**

```toml
[build]
  command = "npm run build"
  publish = ".next"
  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- . ':!mobile'"

[build.environment]
  NODE_VERSION = "20"
```

- [ ] **Step 2: Verify the file is at the repo root, not inside `mobile/`**

```bash
ls /Users/volodymyrchornyi/Documents/time-app/netlify.toml
```

Expected: file exists.

- [ ] **Step 3: Commit**

```bash
git add netlify.toml
git commit -m "feat: add netlify.toml to skip builds on mobile-only changes"
```

---

## Task 3: Supabase mobile client

**Files:**
- Create: `mobile/lib/supabase.ts`

- [ ] **Step 1: Create `mobile/lib/` directory**

```bash
mkdir -p /Users/volodymyrchornyi/Documents/time-app/mobile/lib
```

- [ ] **Step 2: Write `mobile/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

- [ ] **Step 3: Create `mobile/.env` with Expo-prefixed env vars**

Expo requires env vars to be prefixed with `EXPO_PUBLIC_` to be available in the app. Create `mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://eackqrcpecktatasfsvc.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste your anon key from the web app's .env.local here>
```

Note: `EXPO_PUBLIC_` vars are bundled into the app binary. Do not put secret keys here — the anon key is safe (it's designed to be public).

- [ ] **Step 4: Add `.env` to `.gitignore` inside `mobile/`**

```bash
echo ".env\n.env.local" >> mobile/.gitignore
```

- [ ] **Step 5: Commit (without .env)**

```bash
git add mobile/lib/supabase.ts mobile/.gitignore
git commit -m "feat(mobile): add Supabase client with AsyncStorage session"
```

---

## Task 4: Auth helpers

**Files:**
- Create: `mobile/lib/auth.ts`

- [ ] **Step 1: Write `mobile/lib/auth.ts`**

```typescript
import { supabase } from './supabase'

const MAGIC_LINK_REDIRECT = 'timeapp://auth'

/**
 * Sends a magic link to the given email.
 * Returns null on success, error message string on failure.
 */
export async function sendMagicLink(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: MAGIC_LINK_REDIRECT,
      shouldCreateUser: true,
    },
  })
  return error ? error.message : null
}

/**
 * Exchanges the token_hash from the magic link URL for a session.
 * Call this when the app opens via the timeapp://auth deep link.
 * Returns null on success, error message string on failure.
 */
export async function verifyMagicLink(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url)
    // Magic link params arrive as hash fragments or query params depending on Supabase version
    const params = new URLSearchParams(
      parsed.hash ? parsed.hash.slice(1) : parsed.search.slice(1)
    )
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      return error ? error.message : null
    }

    // Fallback: PKCE / token_hash flow
    const tokenHash = params.get('token_hash')
    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      })
      return error ? error.message : null
    }

    return 'No token found in magic link URL'
  } catch {
    return 'Invalid magic link URL'
  }
}

/** Signs the current user out and clears the session from AsyncStorage. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** Returns the current session, or null if not logged in. */
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/auth.ts
git commit -m "feat(mobile): add auth helpers for magic link sign-in"
```

---

## Task 5: Root layout — auth gate + deep link handler

**Files:**
- Create: `mobile/app/_layout.tsx`

- [ ] **Step 1: Create `mobile/app/` directory**

```bash
mkdir -p /Users/volodymyrchornyi/Documents/time-app/mobile/app
```

- [ ] **Step 2: Write `mobile/app/_layout.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { verifyMagicLink } from '../lib/auth'
import type { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const router = useRouter()
  const segments = useSegments()

  // 1. Restore session on mount and listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // 2. Handle deep links (magic link callback)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.startsWith('timeapp://auth')) return
      const error = await verifyMagicLink(url)
      if (error) console.warn('Magic link verification failed:', error)
      // onAuthStateChange above will update session and trigger redirect
    }

    // Handle URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url)
    })

    // Handle URL while app is already open
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [])

  // 3. Redirect based on auth state (wait until session is resolved)
  useEffect(() => {
    if (session === undefined) return // still loading

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/')
    }
  }, [session, segments])

  return <Slot />
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat(mobile): add root layout with auth gate and deep link handler"
```

---

## Task 6: Auth stack + Login screen

**Files:**
- Create: `mobile/app/(auth)/_layout.tsx`
- Create: `mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Write `mobile/app/(auth)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}
```

- [ ] **Step 2: Write `mobile/app/(auth)/login.tsx`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/'(auth)'/
git commit -m "feat(mobile): add login screen with magic link email form"
```

---

## Task 7: Reusable components

**Files:**
- Create: `mobile/components/EmptyState.tsx`
- Create: `mobile/components/TaskRow.tsx`
- Create: `mobile/components/CaptureModal.tsx`

- [ ] **Step 1: Create `mobile/components/` directory**

```bash
mkdir -p /Users/volodymyrchornyi/Documents/time-app/mobile/components
```

- [ ] **Step 2: Write `mobile/components/EmptyState.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native'

interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  message: { color: '#555', fontSize: 15, textAlign: 'center' },
})
```

- [ ] **Step 3: Write `mobile/components/TaskRow.tsx`**

```typescript
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
```

- [ ] **Step 4: Write `mobile/components/CaptureModal.tsx`**

```typescript
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
```

- [ ] **Step 5: Commit**

```bash
git add mobile/components/
git commit -m "feat(mobile): add EmptyState, TaskRow, and CaptureModal components"
```

---

## Task 8: Tab bar layout

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Write `mobile/app/(tabs)/_layout.tsx`**

```typescript
import { Tabs } from 'expo-router'
import { CalendarDays, Inbox } from 'lucide-react-native'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0f0f13' },
        headerTintColor: '#fff',
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: '#0f0f13',
          borderTopColor: '#1e1e2e',
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
```

- [ ] **Step 2: Install lucide-react-native**

```bash
cd mobile
npm install lucide-react-native
```

Note: `lucide-react-native` works with React Native. It is different from `lucide-react` used in the web app — do not import from `lucide-react` in mobile code.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/'(tabs)'/_layout.tsx
git commit -m "feat(mobile): add bottom tab bar layout"
```

---

## Task 9: Today screen

**Files:**
- Create: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Write `mobile/app/(tabs)/index.tsx`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { signOut } from '../../lib/auth'
import { TaskRow } from '../../components/TaskRow'
import { EmptyState } from '../../components/EmptyState'
import { CaptureModal } from '../../components/CaptureModal'
import type { Task } from '@shared/types'

export default function TodayScreen() {
  const [tasks, setTasks] = useState<Task[]>([])
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

    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('id, title, scheduled_at, google_calendar_event_id')
      .eq('user_id', uid)
      .eq('status', 'calendar')
      .gte('scheduled_at', startOfToday.toISOString())
      .lte('scheduled_at', endOfToday.toISOString())
      .order('scheduled_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setTasks((data as Task[]) ?? [])
  }

  useEffect(() => { fetchTasks() }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTasks()
    setRefreshing(false)
  }, [])

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#555" />}
        ListEmptyComponent={<EmptyState message="Nothing scheduled today." />}
        renderItem={({ item }) => (
          <TaskRow
            title={item.title}
            time={item.scheduled_at ? formatTime(item.scheduled_at) : null}
            synced={!!item.google_calendar_event_id}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Floating action button */}
      <TouchableOpacity style={styles.fab} onPress={() => setCaptureOpen(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Sign out — accessible via long-press on FAB for now */}
      <CaptureModal
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
        userId={userId}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  list: { padding: 16, paddingBottom: 80, flexGrow: 1 },
  separator: { height: 8 },
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
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/'(tabs)'/index.tsx
git commit -m "feat(mobile): add Today screen with calendar tasks and capture FAB"
```

---

## Task 10: Inbox screen

**Files:**
- Create: `mobile/app/(tabs)/inbox.tsx`

- [ ] **Step 1: Write `mobile/app/(tabs)/inbox.tsx`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { TaskRow } from '../../components/TaskRow'
import { EmptyState } from '../../components/EmptyState'
import { CaptureModal } from '../../components/CaptureModal'
import type { Task } from '@shared/types'

export default function InboxScreen() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [userId, setUserId] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigation = useNavigation()

  async function fetchTasks() {
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user.id
    if (!uid) return
    setUserId(uid)

    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('id, title, created_at')
      .eq('user_id', uid)
      .eq('status', 'inbox')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setTasks((data as Task[]) ?? [])
  }

  useEffect(() => { fetchTasks() }, [])

  // Update header title with inbox count
  useEffect(() => {
    navigation.setOptions({
      title: tasks.length > 0 ? `Inbox (${tasks.length})` : 'Inbox',
    })
  }, [tasks.length, navigation])

  // Refresh after capture closes (new item may have been added)
  function handleCaptureClose() {
    setCaptureOpen(false)
    fetchTasks()
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTasks()
    setRefreshing(false)
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#555" />}
        ListEmptyComponent={<EmptyState message="Inbox clear." />}
        renderItem={({ item }) => (
          <TaskRow title={item.title} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCaptureOpen(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <CaptureModal
        visible={captureOpen}
        onClose={handleCaptureClose}
        userId={userId}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  list: { padding: 16, paddingBottom: 80, flexGrow: 1 },
  separator: { height: 8 },
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
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/'(tabs)'/inbox.tsx
git commit -m "feat(mobile): add Inbox screen with task list and capture FAB"
```

---

## Task 11: First build + smoke test

- [ ] **Step 1: Fill in the Supabase anon key in `mobile/.env`**

Find `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the web app's `.env.local` and add it to `mobile/.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

```bash
# The web .env.local lives at the repo root
cat /Users/volodymyrchornyi/Documents/time-app/.env.local | grep ANON_KEY
```

Paste the value into `mobile/.env`.

- [ ] **Step 2: Verify Android device is connected**

```bash
adb devices
```

Expected output: your device listed with `device` status. If it shows `unauthorized`, check the "Allow USB debugging" prompt on the phone.

- [ ] **Step 3: Run on device**

```bash
cd /Users/volodymyrchornyi/Documents/time-app/mobile
npx expo run:android
```

Expected: Gradle builds (~2-5 min first time), app installs on phone, Metro bundler starts, app opens.

- [ ] **Step 4: Smoke test — Auth flow**

1. Enter your email on the Login screen → tap "Send magic link"
2. Confirm success message appears
3. Open the email on your phone → tap the magic link
4. App opens → redirects to Today tab
5. Pull down to refresh — tasks appear if any are scheduled for today

- [ ] **Step 5: Smoke test — Capture**

1. Tap the `+` FAB on Today or Inbox tab
2. Type a task title → tap "Add to Inbox"
3. Green "Added to Inbox" confirmation appears
4. Modal closes
5. Switch to Inbox tab → pull to refresh → new task appears at top

- [ ] **Step 6: Build a shareable APK (optional)**

```bash
npm install -g eas-cli
cd /Users/volodymyrchornyi/Documents/time-app/mobile
eas build --platform android --profile preview --local
```

Expected: outputs `build-*.apk` in the current directory. Transfer to any Android phone and install via "Install from files".

- [ ] **Step 7: Final commit**

```bash
cd /Users/volodymyrchornyi/Documents/time-app
git add -A
git commit -m "feat(mobile): complete v1 GTD companion app — auth, today, inbox, capture"
```
