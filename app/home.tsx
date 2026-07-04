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
  getStaffAttendanceHistory,
} from '@/services/api';

const extractList = <T,>(payload: unknown): T[] => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const list = (payload as { data?: unknown }).data;
    return Array.isArray(list) ? (list as T[]) : [];
  }
  return [];
};

const getBillTotal = (bill: AppBill) => {
  const total = Number(bill.totalAmount ?? 0);
  return Number.isFinite(total) ? total : 0;
};

const isCurrentYearBill = (bill: AppBill) => {
  const referenceDate =
    (typeof bill.createdAt === 'string' && bill.createdAt) ||
    (typeof (bill as { billDate?: unknown }).billDate === 'string' ? String((bill as { billDate?: unknown }).billDate) : '');
  if (!referenceDate) return false;

  const parsed = new Date(referenceDate);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.getFullYear() === new Date().getFullYear();
};

const asCurrency = (value: number) => `Rs. ${Math.round(value).toLocaleString('en-IN')}`;

export default function HomeScreen() {
  const { t } = useI18n();
  const user = getCurrentUser();
  const roleId = Number(user?.roleId ?? 0);
  const isAdmin = roleId === 1;
  const isStaff = roleId === 5;
  const isDeliveryMan = roleId === 6;
  const homeVariant = isAdmin ? 'admin' : isStaff ? 'staff' : isDeliveryMan ? 'delivery' : 'user';
  const firstName = (user?.name ?? 'User').split(' ')[0];
  const insets = useSafeAreaInsets();
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    shops: 0,
    routes: 0,
    bills: 0,
    dealerBills: 0,
    attendanceDays: 0,
    deliveredBills: 0,
    pendingDeliveryBills: 0,
    totalRevenue: 0,
    retailerCount: 0,
    dealerCount: 0,
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
      const [usersResult, dealersResult, retailerBillsResult, dealerBillsResult] = await Promise.all([
        getAllUsers(),
        getAllDealers(),
        getAllRetailerBills(),
        getAllDealerBills(),
      ]);

      const allRetailers = extractList<AdminUser>(usersResult.data).filter((item) => Number(item.roleId) === 2);
      const allDealers = extractList<AppDealer>(dealersResult.data);
      const retailerBills = extractList<AppBill>(retailerBillsResult.data);
      const dealerBills = extractList<AppBill>(dealerBillsResult.data);
      const currentYearRetailerBills = retailerBills.filter(isCurrentYearBill);
      const currentYearDealerBills = dealerBills.filter(isCurrentYearBill);
      const totalRevenue =
        currentYearRetailerBills.reduce((sum, bill) => sum + getBillTotal(bill), 0) +
        currentYearDealerBills.reduce((sum, bill) => sum + getBillTotal(bill), 0);

      setStats({
        shops: 0,
        routes: 0,
        bills: retailerBills.length,
        dealerBills: dealerBills.length,
        attendanceDays: 0,
        deliveredBills: 0,
        pendingDeliveryBills: 0,
        totalRevenue,
        retailerCount: allRetailers.length,
        dealerCount: allDealers.length,
      });
    } else if (isStaff) {
      const [dealerBillsResult, attendanceResult] = await Promise.all([
        getAllDealerBills(),
        getStaffAttendanceHistory(),
      ]);
      const attendanceCount =
        attendanceResult.ok &&
        attendanceResult.data &&
        typeof attendanceResult.data === 'object' &&
        'data' in attendanceResult.data &&
        Array.isArray(attendanceResult.data.data)
          ? attendanceResult.data.data.length
          : 0;

      setStats({
        shops: 0,
        routes: 0,
        bills: 0,
        dealerBills: getCountFromResult(dealerBillsResult),
        attendanceDays: attendanceCount,
        deliveredBills: 0,
        pendingDeliveryBills: 0,
        totalRevenue: 0,
        retailerCount: 0,
        dealerCount: 0,
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
        attendanceDays: 0,
        deliveredBills,
        pendingDeliveryBills,
        totalRevenue: 0,
        retailerCount: 0,
        dealerCount: 0,
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
        attendanceDays: 0,
        deliveredBills: 0,
        pendingDeliveryBills: 0,
        totalRevenue: 0,
        retailerCount: 0,
        dealerCount: 0,
      });
    }

    setLoadingStats(false);
    setRefreshing(false);
  }, [isAdmin, isStaff, isDeliveryMan]);

  useFocusEffect(
    useCallback(() => {
      void loadStats('load');
    }, [loadStats]),
  );

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      {isAdmin ? (
        <View style={styles.adminDashboard}>
          <View style={styles.adminHero}>
            <Text style={styles.adminEyebrow}>Admin Overview</Text>
            <Text style={styles.adminTitle}>Revenue Snapshot</Text>
            <Text style={styles.adminSubtitle}>A compact home tab with your top number first.</Text>
          </View>

          {loadingStats ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color="#0F5D33" />
            </View>
          ) : (
            <>
              <View style={styles.revenueRingCard}>
                <View style={styles.revenueRingOuter}>
                  <View style={styles.revenueRingMiddle}>
                    <View style={styles.revenueRingInner}>
                      <Text style={styles.revenueRingLabel}>Total Revenue</Text>
                      <Text style={styles.revenueRingValue}>{asCurrency(stats.totalRevenue)}</Text>
                      <Text style={styles.revenueRingHint}>Current year retailer + dealer bills</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.adminCompactGrid}>
                <View style={[styles.adminMiniCard, styles.adminMiniCardSoft]}>
                  <Text style={styles.adminMiniValue}>{stats.bills}</Text>
                  <Text style={styles.adminMiniLabel}>Retailer Bills</Text>
                </View>
                <View style={[styles.adminMiniCard, styles.adminMiniCardWarm]}>
                  <Text style={styles.adminMiniValue}>{stats.dealerBills}</Text>
                  <Text style={styles.adminMiniLabel}>Dealer Bills</Text>
                </View>
                <View style={[styles.adminMiniCard, styles.adminMiniCardStrong]}>
                  <Text style={styles.adminMiniValue}>{stats.retailerCount}</Text>
                  <Text style={styles.adminMiniLabel}>Retailers</Text>
                </View>
                <View style={[styles.adminMiniCard, styles.adminMiniCardPeach]}>
                  <Text style={styles.adminMiniValue}>{stats.dealerCount}</Text>
                  <Text style={styles.adminMiniLabel}>Dealers</Text>
                </View>
              </View>

              <View style={styles.adminFooterPanel}>
                <Text style={styles.adminFooterTitle}>Quick Summary</Text>
                <Text style={styles.adminFooterText}>
                  {stats.bills + stats.dealerBills} total bills across {stats.retailerCount + stats.dealerCount} active business accounts.
                </Text>
              </View>
            </>
          )}
        </View>
      ) : (
        <ScrollView
          key={`home-${homeVariant}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadStats('refresh')} tintColor="#0F5D33" />
          }>
          <>
            <View style={styles.heroCard}>
            <Image source={require('../assets/images/image.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>{t('home_welcome_title')}</Text>
            <Text style={styles.subtitle}>{t('home_welcome_message', { name: firstName })}</Text>
            <Text style={styles.roleText}>{getRoleLabel(user?.roleId)}</Text>
          </View>

            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>
                {isStaff
                  ? t('home_stats_staff_title')
                  : isDeliveryMan
                  ? t('home_stats_delivery_title')
                  : t('home_stats_user_title')}
              </Text>

              {loadingStats ? (
                <View style={styles.statsLoading}>
                  <ActivityIndicator size="small" color="#0F5D33" />
                </View>
              ) : (
                <View style={styles.statsGrid}>
                  {isStaff ? (
                    <>
                      {/* Hide dealer bills box on the home tab for staff without removing any dealer code. */}
                      {/* <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.dealerBills}</Text>
                        <Text style={styles.statLabel}>Dealer Bills</Text>
                      </View> */}
                      <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.attendanceDays}</Text>
                        <Text style={styles.statLabel}>{t('home_stats_attendance_days')}</Text>
                      </View>
                    </>
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
        </ScrollView>
      )}
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
  adminDashboard: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 18,
    justifyContent: 'space-between',
    gap: 14,
  },
  adminHero: {
    paddingHorizontal: 4,
  },
  adminEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#2F7B59',
  },
  adminTitle: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: '800',
    color: '#123524',
  },
  adminSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#5E7169',
  },
  revenueRingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  revenueRingOuter: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#D4EEE0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 12,
    borderColor: '#9FD2B6',
  },
  revenueRingMiddle: {
    width: 214,
    height: 214,
    borderRadius: 107,
    backgroundColor: '#EEF8F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 10,
    borderColor: '#5EB185',
  },
  revenueRingInner: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  revenueRingLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#4D6A5D',
    textAlign: 'center',
  },
  revenueRingValue: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: '800',
    color: '#0C6037',
    textAlign: 'center',
  },
  revenueRingHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6D8178',
    textAlign: 'center',
  },
  adminCompactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  adminMiniCard: {
    width: '48%',
    minHeight: 104,
    borderRadius: 22,
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  adminMiniCardSoft: {
    backgroundColor: '#F4FAF7',
    borderColor: '#DCE9E2',
  },
  adminMiniCardWarm: {
    backgroundColor: '#FFF6F1',
    borderColor: '#F0DFD1',
  },
  adminMiniCardStrong: {
    backgroundColor: '#E8F6EE',
    borderColor: '#CFE7D7',
  },
  adminMiniCardPeach: {
    backgroundColor: '#FFF0E7',
    borderColor: '#F4DAC9',
  },
  adminMiniValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#153A2A',
  },
  adminMiniLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C6B65',
  },
  adminFooterPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#113D2C',
  },
  adminFooterTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  adminFooterText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#CFE8DB',
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
