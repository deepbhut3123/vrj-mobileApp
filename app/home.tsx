import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import {
  type AdminUser,
  type AppBill,
  type AppDealer,
  getAllDealers,
  getAllDealerBills,
  getAllRetailerBills,
  getAllUsers,
  getCurrentUser,
  getMyBills,
  getMyRoutes,
  getMyShops,
  getRoleLabel,
} from '@/services/api';

const extractList = <T,>(payload: unknown): T[] => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const list = (payload as { data?: unknown }).data;
    return Array.isArray(list) ? (list as T[]) : [];
  }
  return [];
};

export default function HomeScreen() {
  const { t } = useI18n();
  const user = getCurrentUser();
  const roleId = Number(user?.roleId ?? 0);
  const isAdmin = roleId === 1;
  const isDealerStaff = roleId === 5;
  const isDeliveryMan = roleId === 6;
  const homeVariant = isAdmin ? 'admin' : isDealerStaff ? 'dealer-staff' : isDeliveryMan ? 'delivery' : 'user';
  const firstName = (user?.name ?? 'User').split(' ')[0];
  const insets = useSafeAreaInsets();
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retailers, setRetailers] = useState<AdminUser[]>([]);
  const [dealers, setDealers] = useState<AppDealer[]>([]);
  const [stats, setStats] = useState({
    shops: 0,
    routes: 0,
    bills: 0,
    dealerBills: 0,
    deliveredBills: 0,
    pendingDeliveryBills: 0,
  });

  const getCountFromResult = (result: { ok: boolean; data?: unknown }) => {
    if (!result.ok || !result.data || typeof result.data !== 'object' || !('data' in result.data)) {
      return 0;
    }

    const list = (result.data as { data?: unknown }).data;
    return Array.isArray(list) ? list.length : 0;
  };

  const loadStats = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoadingStats(true);
    }

    if (isAdmin) {
      const [usersResult, dealersResult] = await Promise.all([
        getAllUsers(),
        getAllDealers(),
      ]);

      const retailerUsers = extractList<AdminUser>(usersResult.data)
        .filter((item) => Number(item.roleId) === 2)
        .slice(0, 10);
      const dealerList = extractList<AppDealer>(dealersResult.data).slice(0, 10);

      setRetailers(retailerUsers);
      setDealers(dealerList);
    } else if (isDealerStaff) {
      const dealerBillsResult = await getAllDealerBills();
      setStats({
        shops: 0,
        routes: 0,
        bills: 0,
        dealerBills: getCountFromResult(dealerBillsResult),
        deliveredBills: 0,
        pendingDeliveryBills: 0,
      });
    } else if (isDeliveryMan) {
      const assignedBillsResult = await getAllRetailerBills();
      const assignedBills = extractList<AppBill>(assignedBillsResult.data);
      const deliveredBills = assignedBills.filter((bill) =>
        ['delivered', 'completed'].includes(String(bill.status || '').toLowerCase()),
      ).length;
      const pendingDeliveryBills = assignedBills.filter((bill) => {
        const status = String(bill.status || '').toLowerCase();
        return !['delivered', 'completed', 'cancelled'].includes(status);
      }).length;

      setStats({
        shops: 0,
        routes: 0,
        bills: assignedBills.length,
        dealerBills: 0,
        deliveredBills,
        pendingDeliveryBills,
      });
    } else {
      const [myShopsResult, myRoutesResult, myBillsResult] = await Promise.all([
        getMyShops(),
        getMyRoutes(),
        getMyBills(),
      ]);

      setStats({
        shops: getCountFromResult(myShopsResult),
        routes: getCountFromResult(myRoutesResult),
        bills: getCountFromResult(myBillsResult),
        dealerBills: 0,
        deliveredBills: 0,
        pendingDeliveryBills: 0,
      });
    }

    setLoadingStats(false);
    setRefreshing(false);
  }, [isAdmin, isDealerStaff, isDeliveryMan]);

  useFocusEffect(
    useCallback(() => {
      void loadStats('load');
    }, [loadStats]),
  );

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView
        key={`home-${homeVariant}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadStats('refresh')} tintColor="#0F5D33" />
        }>
        {isAdmin ? (
          <View style={styles.adminSection}>
            <Text style={styles.statsTitle}>Team Lists</Text>
            <Text style={styles.adminSectionSubtitle}>
              Quick access to the latest retailer and dealer records.
            </Text>
            {loadingStats ? (
              <View style={styles.statsLoading}>
                <ActivityIndicator size="small" color="#0F5D33" />
              </View>
            ) : (
              <View style={styles.adminColumns}>
                <View style={[styles.listCard, styles.retailerCard]}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.listTitle}>Top 10 Retailers</Text>
                      <Text style={styles.listSubtitle}>Latest retailer accounts</Text>
                    </View>
                    <View style={styles.cardCountPill}>
                      <Text style={styles.cardCountText}>{retailers.length}</Text>
                    </View>
                  </View>
                  <View style={styles.innerListContent}>
                    {retailers.length === 0 ? (
                      <Text style={styles.emptyListText}>No retailers found.</Text>
                    ) : (
                      retailers.map((item, index) => (
                        <View key={item._id} style={styles.listRow}>
                          <View style={styles.rankColumn}>
                            <Text style={styles.rankLabel}>#{index + 1}</Text>
                          </View>
                          <View style={styles.listCopy}>
                            <Text style={styles.listPrimary}>{item.name}</Text>
                            <Text style={styles.listSecondary}>{item.email}</Text>
                          </View>
                          <View style={styles.rowMetaPill}>
                            <Text style={styles.rowMetaText}>
                              {item.isActive === false ? 'Inactive' : 'Active'}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View style={[styles.listCard, styles.dealerCard]}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.listTitle}>Top 10 Dealers</Text>
                      <Text style={styles.listSubtitle}>Latest dealer records</Text>
                    </View>
                    <View style={[styles.cardCountPill, styles.cardCountPillWarm]}>
                      <Text style={styles.cardCountText}>{dealers.length}</Text>
                    </View>
                  </View>
                  <View style={styles.innerListContent}>
                    {dealers.length === 0 ? (
                      <Text style={styles.emptyListText}>No dealers found.</Text>
                    ) : (
                      dealers.map((item, index) => (
                        <View key={item._id} style={styles.listRow}>
                          <View style={styles.rankColumn}>
                            <Text style={styles.rankLabel}>#{index + 1}</Text>
                          </View>
                          <View style={styles.listCopy}>
                            <Text style={styles.listPrimary}>{item.dealerName}</Text>
                            <Text style={styles.listSecondary}>
                              {[item.city, item.contactNo].filter(Boolean).join(' | ') || 'No extra details'}
                            </Text>
                          </View>
                          <View style={[styles.rowMetaPill, styles.rowMetaPillWarm]}>
                            <Text style={styles.rowMetaText}>
                              {typeof item.margin === 'number' ? `${item.margin}%` : 'Dealer'}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
            <Image source={require('../assets/images/image.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>{t('home_welcome_title')}</Text>
            <Text style={styles.subtitle}>{t('home_welcome_message', { name: firstName })}</Text>
            <Text style={styles.roleText}>{getRoleLabel(user?.roleId)}</Text>
          </View>

            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>
                {isDeliveryMan ? t('home_stats_delivery_title') : t('home_stats_user_title')}
              </Text>

              {loadingStats ? (
                <View style={styles.statsLoading}>
                  <ActivityIndicator size="small" color="#0F5D33" />
                </View>
              ) : (
                <View style={styles.statsGrid}>
                  {isDealerStaff ? (
                    <View style={styles.statCardWide}>
                      <Text style={styles.statValue}>{stats.dealerBills}</Text>
                      <Text style={styles.statLabel}>Dealer Bills</Text>
                    </View>
                  ) : isDeliveryMan ? (
                    <>
                      <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.pendingDeliveryBills}</Text>
                        <Text style={styles.statLabel}>{t('home_stats_pending_delivery')}</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.deliveredBills}</Text>
                        <Text style={styles.statLabel}>{t('home_stats_delivery_complete')}</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.shops}</Text>
                        <Text style={styles.statLabel}>{t('home_stats_my_shops')}</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.routes}</Text>
                        <Text style={styles.statLabel}>{t('routes_title')}</Text>
                      </View>
                      <View style={styles.statCardWide}>
                        <Text style={styles.statValue}>{stats.bills}</Text>
                        <Text style={styles.statLabel}>{t('bills_title')}</Text>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          </>
        )}
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
    paddingTop: 10,
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
  adminSection: {
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
  adminSectionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#61736D',
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
  adminColumns: {
    marginTop: 14,
    gap: 12,
    flex: 1,
  },
  listCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    flex: 1,
    minHeight: 0,
  },
  retailerCard: {
    backgroundColor: '#F4FAF7',
    borderColor: '#DCE9E2',
  },
  dealerCard: {
    backgroundColor: '#FFF7F3',
    borderColor: '#F2E1D6',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#123524',
  },
  listSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#61736D',
  },
  innerListContent: {
    marginTop: 12,
    gap: 10,
    paddingBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardCountPill: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D9EFE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCountPillWarm: {
    backgroundColor: '#F7DDD1',
  },
  cardCountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#173126',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6EFEA',
  },
  rankColumn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#517267',
  },
  listCopy: {
    flex: 1,
  },
  listPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#183126',
  },
  listSecondary: {
    marginTop: 3,
    fontSize: 12,
    color: '#61736D',
  },
  rowMetaPill: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMetaPillWarm: {
    backgroundColor: '#FFF1EA',
  },
  rowMetaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#315448',
  },
  emptyListText: {
    fontSize: 14,
    color: '#61736D',
    paddingVertical: 12,
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
