import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.3,
        },
        headerStyle: {
          backgroundColor: colors.card,
          borderBottomWidth: 0,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          letterSpacing: -0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) => <FontAwesome name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Properties',
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Me',
          tabBarIcon: ({ color }) => <FontAwesome name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
