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
