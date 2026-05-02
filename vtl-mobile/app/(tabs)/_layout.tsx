import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
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
          paddingTop: 4,
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
          tabBarIcon: ({ focused, color }) => (
            <View style={{ alignItems: 'center', borderTopWidth: focused ? 3 : 0, borderTopColor: COLORS.sky, paddingTop: focused ? 4 : 7, width: 40 }}>
              <Text style={{ fontSize: 20, color }}>⌂</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: 'Operations',
          tabBarIcon: ({ focused, color }) => (
            <View style={{ alignItems: 'center', borderTopWidth: focused ? 3 : 0, borderTopColor: COLORS.sky, paddingTop: focused ? 4 : 7, width: 40 }}>
              <Text style={{ fontSize: 20, color }}>⚙</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="quality"
        options={{
          title: 'Quality',
          tabBarIcon: ({ focused, color }) => (
            <View style={{ alignItems: 'center', borderTopWidth: focused ? 3 : 0, borderTopColor: COLORS.sky, paddingTop: focused ? 4 : 7, width: 40 }}>
              <Text style={{ fontSize: 20, color }}>🛡</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="commercial"
        options={{
          title: 'Commercial',
          tabBarIcon: ({ focused, color }) => (
            <View style={{ alignItems: 'center', borderTopWidth: focused ? 3 : 0, borderTopColor: COLORS.sky, paddingTop: focused ? 4 : 7, width: 40 }}>
              <Text style={{ fontSize: 20, color }}>📊</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ focused, color }) => (
            <View style={{ alignItems: 'center', borderTopWidth: focused ? 3 : 0, borderTopColor: COLORS.sky, paddingTop: focused ? 4 : 7, width: 40 }}>
              <Text style={{ fontSize: 20, color }}>👥</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
