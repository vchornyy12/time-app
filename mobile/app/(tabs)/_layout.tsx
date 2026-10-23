import { Tabs } from 'expo-router'
import { CalendarDays, Inbox, Zap, List } from 'lucide-react-native'
import { Alert, Text, TouchableOpacity } from 'react-native'
import { signOut } from '../../lib/auth'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#181818' },
        headerTintColor: '#fff',
        headerShadowVisible: false,
        headerRight: () => (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign out"
            style={{ padding: 12 }} onPress={() => {
              void signOut().catch(() => Alert.alert('Sign-out failed', 'Please try again.'))
            }}>
            <Text style={{ color: '#3ECF8E' }}>Sign out</Text>
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: '#181818',
          borderTopColor: 'rgba(255,255,255,0.08)',
        },
        tabBarActiveTintColor: '#3ECF8E',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.40)',
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
      <Tabs.Screen name="next-actions" options={{ title: 'Next Actions', tabBarIcon: ({ color, size }) => <Zap color={color} size={size} /> }} />
      <Tabs.Screen name="lists" options={{ title: 'Lists', tabBarIcon: ({ color, size }) => <List color={color} size={size} /> }} />
    </Tabs>
  )
}
