import { Ionicons } from '@expo/vector-icons';
import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import { getCurrentUser } from '@/services/api';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type BottomNavItem = {
  key: string;
  label: string;
  href?: Href;
  activePaths: string[];
  icon: IoniconName;
  activeIcon: IoniconName;
  onPress?: () => void;
};

export default function TabsLayout() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const user = getCurrentUser();
  const insets = useSafeAreaInsets();
  const roleId = Number(user?.roleId ?? 0);
  const isAdmin = roleId === 1;
  const isDealer = roleId === 3;
  const isStaffRoleFour = roleId === 4;
  const isDealerBillsOnly = roleId === 5;
  const isRetailerBillsOnly = roleId === 6;
  const canUseRetailerTabs = !isAdmin && !isDealer && !isDealerBillsOnly && !isRetailerBillsOnly;

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

  if (isDealer) {
    navItems.push(
      {
        key: 'dealer-bills',
        label: t('tabs_bill'),
        href: '/dealer-bills',
        activePaths: ['/dealer-bills'],
        icon: 'newspaper-outline',
        activeIcon: 'newspaper',
      },
      {
        key: 'dealer-bills-add',
        label: '',
        onPress: () =>
          router.replace({
            pathname: '/dealer-bills-add',
            params: { create: String(Date.now()) },
          }),
        activePaths: ['/dealer-bills-add'],
        icon: 'add-circle-outline',
        activeIcon: 'add-circle',
      },
      {
        key: 'dealer-payments',
        label: t('tabs_dealer_payments'),
        href: '/dealer-payments',
        activePaths: ['/dealer-payments'],
        icon: 'cash-outline',
        activeIcon: 'cash',
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

      <View style={[styles.navWrap, isDealer ? styles.dealerNavWrap : null, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {navItems.map((item) => {
          const focused = item.activePaths.includes(pathname);
          const isDealerAddItem = isDealer && item.key === 'dealer-bills-add';
          const color = isDealer
            ? isDealerAddItem
              ? '#FFFFFF'
              : focused
              ? '#0B4A34'
              : '#D8F0E5'
            : focused
            ? '#0E6C50'
            : '#7A8791';

          return (
            <Pressable
              key={item.key}
              onPress={() => {
                if (item.onPress) {
                  item.onPress();
                  return;
                }

                if (!focused && item.href) {
                  router.replace(item.href);
                }
              }}
              style={({ pressed }) => [
                styles.navItem,
                isDealer ? styles.dealerNavItem : null,
                focused && !isDealerAddItem ? (isDealer ? styles.dealerNavItemActive : styles.navItemActive) : null,
                pressed ? styles.navItemPressed : null,
              ]}>
              {isDealerAddItem ? (
                <View style={styles.dealerAddOuter}>
                  <View style={styles.dealerAddInner}>
                    <Ionicons name="add" size={38} color={color} />
                  </View>
                </View>
              ) : (
                <Ionicons name={focused ? item.activeIcon : item.icon} size={22} color={color} />
              )}
              {item.label && !isDealerAddItem ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.navLabel,
                    isDealer ? styles.dealerNavLabel : null,
                    focused ? (isDealer ? styles.dealerNavLabelActive : styles.navLabelActive) : null,
                  ]}>
                  {item.label}
                </Text>
              ) : null}
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
  dealerNavWrap: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 26,
    minHeight: 78,
    paddingTop: 10,
    paddingHorizontal: 8,
    backgroundColor: '#0A3D2C',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: '#176245',
    shadowColor: '#062A1D',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
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
  dealerNavItem: {
    borderRadius: 18,
    minHeight: 54,
    paddingHorizontal: 2,
  },
  dealerNavItemActive: {
    backgroundColor: '#E8F7EF',
  },
  dealerAddOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    marginTop: -42,
    backgroundColor: '#D8F0E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#021C13',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 16,
  },
  dealerAddInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1A8F62',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
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
  dealerNavLabel: {
    color: '#D8F0E5',
  },
  navLabelActive: {
    color: '#0E6C50',
  },
  dealerNavLabelActive: {
    color: '#0B4A34',
  },
});
