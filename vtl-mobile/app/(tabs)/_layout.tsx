import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: COLORS.sky,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⌂</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: 'Operations',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⚙</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="quality"
        options={{
          title: 'Quality',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🛡</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="commercial"
        options={{
          title: 'Commercial',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📊</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👥</Text>
          ),
        }}
      />
    </Tabs>
  );
}
