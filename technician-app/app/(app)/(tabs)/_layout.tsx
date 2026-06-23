import { Tabs, usePathname } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { useAppColors } from '@/lib/theme';

const TAB_BAR_CONTENT_HEIGHT = 56;
const HEADER_CONTENT_HEIGHT = 44;

function useTabTitle() {
  const pathname = usePathname();
  const { t } = useI18n();

  if (pathname.includes('settings')) return t('tabs.me');
  if (pathname.includes('calendar')) return t('tabs.calendar');
  if (pathname.includes('properties')) return t('tabs.properties');
  return t('tabs.jobs');
}

function TabScreenHeader({
  title,
  backgroundColor,
  textColor,
  borderColor,
}: {
  title: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor,
          paddingTop: insets.top,
          borderBottomColor: borderColor,
        },
      ]}
    >
      <Text style={[styles.headerTitle, { color: textColor }]}>{title}</Text>
    </View>
  );
}

function CadenzaTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useAppColors();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const chromeBg = colors.tabBarBg ?? colors.headerBg;

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: chromeBg,
          borderTopColor: colors.border,
          paddingBottom: bottomInset,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? colors.tabIconSelected : colors.tabIconDefault;
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : typeof options.title === 'string'
              ? options.title
              : route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={onPress}
            style={styles.tabItem}
          >
            {options.tabBarIcon?.({ focused, color, size: 22 })}
            <Text style={[styles.tabLabel, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useAppColors();
  const { t } = useI18n();
  const title = useTabTitle();
  const chromeBg = colors.tabBarBg ?? colors.headerBg;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <TabScreenHeader
        title={title}
        backgroundColor={colors.headerBg}
        textColor={colors.text}
        borderColor={colors.border}
      />
      <Tabs
        style={styles.tabs}
        screenOptions={
          {
            headerShown: false,
            sceneStyle: { backgroundColor: colors.background },
            tabBarActiveTintColor: colors.tabIconSelected,
            tabBarInactiveTintColor: colors.tabIconDefault,
            tabBar: (props: BottomTabBarProps) => <CadenzaTabBar {...props} />,
            tabBarStyle: {
              backgroundColor: chromeBg,
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
            },
          } satisfies BottomTabNavigationOptions
        }
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.jobs'),
            headerShown: false,
            tabBarLabel: t('tabs.jobs'),
            tabBarIcon: ({ color }) => <FontAwesome name="list" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: t('tabs.calendar'),
            headerShown: false,
            tabBarLabel: t('tabs.calendar'),
            tabBarIcon: ({ color }) => <FontAwesome name="calendar" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="properties"
          options={{
            title: t('tabs.properties'),
            headerShown: false,
            tabBarLabel: t('tabs.properties'),
            tabBarIcon: ({ color }) => <FontAwesome name="home" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.me'),
            headerShown: false,
            tabBarLabel: t('tabs.me'),
            tabBarIcon: ({ color }) => <FontAwesome name="user" size={22} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: HEADER_CONTENT_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  tabs: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
