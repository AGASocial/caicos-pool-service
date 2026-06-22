import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

// Icon (22) + label (~14) + spacing — must fit above the home-indicator inset.
const TAB_BAR_CONTENT_HEIGHT = 60;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

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
          paddingBottom: bottomInset,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0.3,
          marginTop: 2,
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
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <FontAwesome name="calendar" size={22} color={color} />,
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
