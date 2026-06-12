import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import {
  getCurrentUser,
  getMyBills,
  getMyRoutes,
  getMyShops,
} from '@/services/api';

export default function HomeScreen() {
  const { t } = useI18n();
  const user = getCurrentUser();
  const firstName = (user?.name ?? 'User').split(' ')[0];
  const insets = useSafeAreaInsets();
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    myShops: 0,
    myRoutes: 0,
    myBills: 0,
  });

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      setLoadingStats(true);

      const [myShopsResult, myRoutesResult, myBillsResult] = await Promise.all([
        getMyShops(),
        getMyRoutes(),
        getMyBills(),
      ]);

      if (!active) {
        return;
      }

      const myShops =
        myShopsResult.ok && myShopsResult.data && typeof myShopsResult.data === 'object' && 'data' in myShopsResult.data
          ? Array.isArray((myShopsResult.data as { data?: unknown }).data)
            ? (myShopsResult.data as { data: unknown[] }).data.length
            : 0
          : 0;

      const myRoutes =
        myRoutesResult.ok && myRoutesResult.data && typeof myRoutesResult.data === 'object' && 'data' in myRoutesResult.data
          ? Array.isArray((myRoutesResult.data as { data?: unknown }).data)
            ? (myRoutesResult.data as { data: unknown[] }).data.length
            : 0
          : 0;

      const myBills =
        myBillsResult.ok && myBillsResult.data && typeof myBillsResult.data === 'object' && 'data' in myBillsResult.data
          ? Array.isArray((myBillsResult.data as { data?: unknown }).data)
            ? (myBillsResult.data as { data: unknown[] }).data.length
            : 0
          : 0;

      setStats({ myShops, myRoutes, myBills });

      if (active) {
        setLoadingStats(false);
      }
    };

    void loadStats();

    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Image source={require('../assets/images/image.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{t('home_welcome_title')}</Text>
          <Text style={styles.subtitle}>{t('home_welcome_message', { name: firstName })}</Text>
          <Text style={styles.roleText}>{t('profile_user')}</Text>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.statsTitle}>{t('home_stats_user_title')}</Text>

          {loadingStats ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color="#0F5D33" />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.myShops}</Text>
                <Text style={styles.statLabel}>{t('home_stats_my_shops')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.myRoutes}</Text>
                <Text style={styles.statLabel}>{t('routes_title')}</Text>
              </View>
              <View style={styles.statCardWide}>
                <Text style={styles.statValue}>{stats.myBills}</Text>
                <Text style={styles.statLabel}>{t('bills_title')}</Text>
              </View>
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
  statCard: {
    width: '48%',
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
