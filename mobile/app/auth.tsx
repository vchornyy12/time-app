import { View, ActivityIndicator } from 'react-native'

export default function AuthCallbackScreen() {
    return (
        <View style={{ flex: 1, backgroundColor: '#0f0f13', justifyContent: 'center', alignItems: 'center' }}>
            {/* Крутилка кольору нашої кнопки */}
            <ActivityIndicator size="large" color="#6366f1" />
        </View>
    )
}