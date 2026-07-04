import { Ionicons } from '@expo/vector-icons';
import { Slot, usePathname, useRouter } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import { getCurrentUser } from '@/services/api';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type BottomNavItem = {
  key: string;
  label: string;
  href: string;
  activePaths: string[];
  icon: IoniconName;
  activeIcon: IoniconName;
};

export default function TabsLayout() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const user = getCurrentUser();
  const insets = useSafeAreaInsets();
  const roleId = Number(user?.roleId ?? 0);
  const isAdmin = roleId === 1;
  const isStaffRoleFour = roleId === 4;
  const isDealerBillsOnly = roleId === 5;
  const isRetailerBillsOnly = roleId === 6;
  const canUseRetailerTabs = !isAdmin && !isDealerBillsOnly && !isRetailerBillsOnly;

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [router, user]);

  if (!user) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color="#0E6C50" />
      </View>
    );
  }

  const navItems: BottomNavItem[] = [
    {
      key: 'home',
      label: t('tabs_home'),
      href: '/(tabs)',
      activePaths: ['/', '/index'],
      icon: 'home-outline',
      activeIcon: 'home',
    },
  ];

  if (canUseRetailerTabs) {
    navItems.push(
      {
        key: 'shops',
        label: t('tabs_shop'),
        href: '/shops',
        activePaths: ['/shops'],
        icon: 'storefront-outline',
        activeIcon: 'storefront',
      },
      {
        key: 'bills',
        label: t('tabs_bill'),
        href: '/bills',
        activePaths: ['/bills'],
        icon: 'receipt-outline',
        activeIcon: 'receipt',
      },
    );
  }

  if (isAdmin) {
    navItems.push(
      {
        key: 'retailer-bills',
        label: t('tabs_retailer_bills'),
        href: '/retailer-bills',
        activePaths: ['/retailer-bills'],
        icon: 'file-tray-full-outline',
        activeIcon: 'file-tray-full',
      },
      {
        key: 'dealer-bills',
        label: t('tabs_dealer_bills'),
        href: '/dealer-bills',
        activePaths: ['/dealer-bills'],
        icon: 'newspaper-outline',
        activeIcon: 'newspaper',
      },
    );
  }

  if (isDealerBillsOnly) {
    // Hide dealer bills tab for staff login without removing the dealer screen/routes.
    // navItems.push({
    //   key: 'dealer-bills',
    //   label: t('tabs_dealer_bills'),
    //   href: '/dealer-bills',
    //   activePaths: ['/dealer-bills'],
    //   icon: 'newspaper-outline',
    //   activeIcon: 'newspaper',
    // });

    navItems.push({
      key: 'staff-attendance',
      label: t('tabs_attendance'),
      href: '/staff-attendance',
      activePaths: ['/staff-attendance'],
      icon: 'calendar-outline',
      activeIcon: 'calendar',
    });
  }

  if (isRetailerBillsOnly) {
    navItems.push({
      key: 'retailer-bills',
      label: t('tabs_retailer_bills'),
      href: '/retailer-bills',
      activePaths: ['/retailer-bills'],
      icon: 'file-tray-full-outline',
      activeIcon: 'file-tray-full',
    });
  }

  if (canUseRetailerTabs || isStaffRoleFour) {
    navItems.push({
      key: 'route-add',
      label: t('tabs_route'),
      href: '/route-add',
      activePaths: ['/route-add'],
      icon: 'add-circle-outline',
      activeIcon: 'add-circle',
    });
  }

  navItems.push({
    key: 'settings',
    label: t('tabs_settings'),
    href: '/settings',
    activePaths: ['/settings'],
    icon: 'settings-outline',
    activeIcon: 'settings',
  });

  return (
    <View style={styles.shell}>
      <View style={styles.screen}>
        <Slot />
      </View>

      <View style={[styles.navWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {navItems.map((item) => {
          const focused = item.activePaths.includes(pathname);
          const color = focused ? '#0E6C50' : '#7A8791';

          return (
            <Pressable
              key={item.key}
              onPress={() => {
                if (!focused) {
                  router.replace(item.href);
                }
              }}
              style={({ pressed }) => [
                styles.navItem,
                focused ? styles.navItemActive : null,
                pressed ? styles.navItemPressed : null,
              ]}>
              <Ionicons name={focused ? item.activeIcon : item.icon} size={22} color={color} />
              <Text numberOfLines={1} style={[styles.navLabel, focused ? styles.navLabelActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EAF4F1',
  },
  shell: {
    flex: 1,
    backgroundColor: '#EAF4F1',
  },
  screen: {
    flex: 1,
  },
  navWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    minHeight: 70,
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1ECE7',
    shadowColor: '#0D2B1F',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 3,
  },
  navItemActive: {
    backgroundColor: '#EAF4F1',
    borderRadius: 8,
  },
  navItemPressed: {
    opacity: 0.75,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A8791',
    textAlign: 'center',
  },
  navLabelActive: {
    color: '#0E6C50',
  },
});
