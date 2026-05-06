import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import {
  getAdminShops,
  getAdminUsers,
  getAllAdminRoutes,
  getCurrentUser,
  getMyShops,
} from '@/services/api';

export default function HomeScreen() {
  const { t } = useI18n();
  const user = getCurrentUser();
  const isAdmin = user?.roleId === 1;
  const firstName = (user?.name ?? 'User').split(' ')[0];
  const insets = useSafeAreaInsets();
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    shops: 0,
    routes: 0,
    users: 0,
    myShops: 0,
  });

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      setLoadingStats(true);

      if (isAdmin) {
        const [shopsResult, routesResult, usersResult] = await Promise.all([
          getAdminShops(),
          getAllAdminRoutes(),
          getAdminUsers(),
        ]);

        if (!active) {
          return;
        }

        const shops =
          shopsResult.ok && shopsResult.data && typeof shopsResult.data === 'object' && 'data' in shopsResult.data
            ? Array.isArray((shopsResult.data as { data?: unknown }).data)
              ? (shopsResult.data as { data: unknown[] }).data.length
              : 0
            : 0;
        const routes =
          routesResult.ok && routesResult.data && typeof routesResult.data === 'object' && 'data' in routesResult.data
            ? Array.isArray((routesResult.data as { data?: unknown }).data)
              ? (routesResult.data as { data: unknown[] }).data.length
              : 0
            : 0;
        const users =
          usersResult.ok && usersResult.data && typeof usersResult.data === 'object' && 'data' in usersResult.data
            ? Array.isArray((usersResult.data as { data?: unknown }).data)
              ? (usersResult.data as { data: unknown[] }).data.length
              : 0
            : 0;

        setStats({
          shops,
          routes,
          users,
          myShops: 0,
        });
      } else {
        const myShopsResult = await getMyShops();

        if (!active) {
          return;
        }

        const myShops =
          myShopsResult.ok && myShopsResult.data && typeof myShopsResult.data === 'object' && 'data' in myShopsResult.data
            ? Array.isArray((myShopsResult.data as { data?: unknown }).data)
              ? (myShopsResult.data as { data: unknown[] }).data.length
              : 0
            : 0;

        setStats({
          shops: 0,
          routes: 0,
          users: 0,
          myShops,
        });
      }

      if (active) {
        setLoadingStats(false);
      }
    };

    void loadStats();

    return () => {
      active = false;
    };
  }, [isAdmin]);

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Image source={require('../assets/images/image.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{t('home_welcome_title')}</Text>
          <Text style={styles.subtitle}>{t('home_welcome_message', { name: firstName })}</Text>
          <Text style={styles.roleText}>{isAdmin ? t('profile_admin') : t('profile_user')}</Text>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.statsTitle}>
            {isAdmin ? t('home_stats_admin_title') : t('home_stats_user_title')}
          </Text>

          {loadingStats ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color="#0F5D33" />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {isAdmin ? (
                <>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.shops}</Text>
                    <Text style={styles.statLabel}>{t('home_stats_shops')}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.routes}</Text>
                    <Text style={styles.statLabel}>{t('home_stats_routes')}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.users}</Text>
                    <Text style={styles.statLabel}>{t('home_stats_users')}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.statCardWide}>
                  <Text style={styles.statValue}>{stats.myShops}</Text>
                  <Text style={styles.statLabel}>{t('home_stats_my_shops')}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F2F8F6',
    paddingHorizontal: 20,
  },
  content: {
    paddingBottom: 24,
    gap: 18,
  },
  bgOrbTop: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#BFEAD8',
  },
  bgOrbBottom: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#D8EFE3',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#E1ECE7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  logo: {
    width: '100%',
    height: 140,
    maxWidth: 360,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0B3E2A',
    marginTop: 10,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#3B5E51',
    textAlign: 'center',
  },
  roleText: {
    marginTop: 10,
    fontSize: 15,
    color: '#2E6A53',
    fontWeight: '600',
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E1ECE7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 5,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#123524',
  },
  statsLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    minHeight: 108,
    borderRadius: 18,
    backgroundColor: '#F4FAF7',
    borderWidth: 1,
    borderColor: '#DCE9E2',
    padding: 16,
    justifyContent: 'space-between',
  },
  statCardWide: {
    width: '100%',
    minHeight: 118,
    borderRadius: 18,
    backgroundColor: '#F4FAF7',
    borderWidth: 1,
    borderColor: '#DCE9E2',
    padding: 18,
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0B5B35',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A5B66',
  },
});
