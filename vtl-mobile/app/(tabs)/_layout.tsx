import { Tabs } from 'expo-router';
import { Home, Settings2, ShieldCheck, TrendingUp, Users } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

type IconProps = { color: string; size: number };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: COLORS.sky,
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }: IconProps) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: 'Operations',
          tabBarIcon: ({ color, size }: IconProps) => <Settings2 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="quality"
        options={{
          title: 'Quality',
          tabBarIcon: ({ color, size }: IconProps) => <ShieldCheck color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="commercial"
        options={{
          title: 'Commercial',
          tabBarIcon: ({ color, size }: IconProps) => <TrendingUp color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color, size }: IconProps) => <Users color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
