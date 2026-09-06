import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import {
  type AdminUser,
  type AppBill,
  type AppDealer,
  type AttendanceEntry,
  type DealerBill,
  getAllDealers,
  getAllDealerBills,
  getAllRetailerBills,
  getAllUsers,
  getCurrentUser,
  getMyBills,
  getMyRoutes,
  getMyShops,
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

const getDealerBillTotal = (bill: DealerBill) => {
  const total = Number(bill.totalAmount ?? 0);
  return Number.isFinite(total) ? total : 0;
};

const getDealerStoredPendingPayment = (dealer: AppDealer | null) => {
  if (!dealer || dealer.pendingPayment === undefined || dealer.pendingPayment === null) {
    return null;
  }

  const pendingPayment = Number(dealer.pendingPayment);
  return Number.isFinite(pendingPayment) ? Math.max(pendingPayment, 0) : null;
};

const getDealerBillPendingPayment = (bill: DealerBill) => {
  const directPendingFields = [
    bill.pendingAmount,
    bill.pendingPayment,
    bill.balanceAmount,
    bill.dueAmount,
    bill.remainingAmount,
    bill.outstandingAmount,
    bill.unpaidAmount,
  ];

  for (const value of directPendingFields) {
    const parsed = Number(value ?? NaN);
    if (Number.isFinite(parsed)) {
      return Math.max(parsed, 0);
    }
  }

  const paidAmount = Number(bill.paidAmount ?? NaN);
  if (Number.isFinite(paidAmount)) {
    return Math.max(getDealerBillTotal(bill) - paidAmount, 0);
  }

  return 0;
};

const getDealerBillDate = (bill: DealerBill) => {
  const referenceDate =
    (typeof bill.billDate === 'string' && bill.billDate) ||
    (typeof bill.createdAt === 'string' && bill.createdAt) ||
    '';

  const parsed = new Date(referenceDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getAppBillDate = (bill: AppBill) => {
  const referenceDate =
    (typeof bill.createdAt === 'string' && bill.createdAt) ||
    (typeof (bill as { billDate?: unknown }).billDate === 'string' ? String((bill as { billDate?: unknown }).billDate) : '');
  if (!referenceDate) return null;

  const parsed = new Date(referenceDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isDateInMonth = (date: Date | null, month: number, year: number) => {
  if (!date) {
    return false;
  }

  return date.getMonth() === month && date.getFullYear() === year;
};

const asCurrency = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;

const formatDay = (value: string, _locale: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  return `${day} / ${month} / ${year}`;
};

const parseAttendanceDateTime = (dateValue: string, timeValue: string | null | undefined) => {
  if (!timeValue) {
    return null;
  }

  const directDate = new Date(timeValue);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const normalizedDate = String(dateValue || '').trim();
  const normalizedTime = String(timeValue).trim().toUpperCase();
  const match = normalizedTime.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);

  if (!normalizedDate || !match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];

  if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  } else if (meridiem === 'PM' && hours !== 12) {
    hours += 12;
  }

  const composed = new Date(`${normalizedDate}T00:00:00`);
  if (Number.isNaN(composed.getTime())) {
    return null;
  }

  composed.setHours(hours, minutes, 0, 0);
  return composed;
};

const getEntryWorkedHours = (entry: {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  breakIn?: string | null;
  breakOut?: string | null;
}) => {
  if (!entry.checkIn || !entry.checkOut) {
    return 0;
  }

  const checkInAt = parseAttendanceDateTime(entry.date, entry.checkIn);
  const checkOutAt = parseAttendanceDateTime(entry.date, entry.checkOut);

  if (!checkInAt || !checkOutAt) {
    return 0;
  }

  const checkInTime = checkInAt.getTime();
  const checkOutTime = checkOutAt.getTime();
  if (checkOutTime <= checkInTime) {
    return 0;
  }

  let workedMs = checkOutTime - checkInTime;

  if (entry.breakIn && entry.breakOut) {
    const breakInAt = parseAttendanceDateTime(entry.date, entry.breakIn);
    const breakOutAt = parseAttendanceDateTime(entry.date, entry.breakOut);
    if (breakInAt && breakOutAt) {
      const breakInTime = breakInAt.getTime();
      const breakOutTime = breakOutAt.getTime();
      if (breakOutTime > breakInTime) {
      workedMs -= breakOutTime - breakInTime;
      }
    }
  }

  return Math.max(workedMs, 0) / (1000 * 60 * 60);
};

const formatWorkedTime = (hours: number, language: 'en' | 'gu') => {
  if (hours <= 0) {
    return '--';
  }

  const roundedMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  const hourSuffix = language === 'gu' ? 'કલાક' : 'h';
  const minuteSuffix = language === 'gu' ? 'મિ' : 'm';

  if (wholeHours === 0) {
    return `${minutes}${minuteSuffix}`;
  }

  if (minutes === 0) {
    return `${wholeHours}${hourSuffix}`;
  }

  return `${wholeHours}${hourSuffix} ${minutes}${minuteSuffix}`;
};

const formatAttendanceTime = (
  dateValue: string,
  timeValue: string | null | undefined,
  locale: string,
) => {
  if (!timeValue) {
    return '--';
  }

  const parsed = parseAttendanceDateTime(dateValue, timeValue);
  if (!parsed) {
    return String(timeValue);
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(parsed);
};

export default function HomeScreen() {
  const { language, t } = useI18n();
  const user = getCurrentUser();
  const roleId = Number(user?.roleId ?? 0);
  const isAdmin = roleId === 1;
  const isDealer = roleId === 3;
  const isStaff = roleId === 5;
  const isDeliveryMan = roleId === 6;
  const homeVariant = isAdmin ? 'admin' : isDealer ? 'dealer' : isStaff ? 'staff' : isDeliveryMan ? 'delivery' : 'user';
  const displayName = user?.name?.trim() || t('home_role_user');
  const firstName = displayName.split(/\s+/)[0];
  const locale = language === 'gu' ? 'gu-IN' : 'en-IN';
  const roleLabel = useMemo(() => {
    switch (roleId) {
      case 1:
        return t('home_role_admin');
      case 2:
        return t('home_role_retailer');
      case 3:
        return t('home_role_dealer');
      case 4:
        return t('home_role_salesman');
      case 5:
        return t('home_role_staff');
      case 6:
        return t('home_role_delivery');
      default:
        return t('home_role_user');
    }
  }, [roleId, t]);
  const currentDate = useMemo(() => new Date(), []);
  const insets = useSafeAreaInsets();
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceEntry[]>([]);
  const [dealerBills, setDealerBills] = useState<DealerBill[]>([]);
  const [adminRetailerBills, setAdminRetailerBills] = useState<AppBill[]>([]);
  const [adminDealerBills, setAdminDealerBills] = useState<AppBill[]>([]);
  const [dealerPendingPaymentAmount, setDealerPendingPaymentAmount] = useState(0);
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
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

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index,
        label: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2026, index, 1)),
      })),
    [locale],
  );
  const yearOptions = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    return Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);
  }, [currentDate]);

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

    if (!isDealer) {
      setDealerPendingPaymentAmount(0);
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
      const totalRevenue =
        retailerBills.reduce((sum, bill) => sum + getBillTotal(bill), 0) +
        dealerBills.reduce((sum, bill) => sum + getBillTotal(bill), 0);

      setAdminRetailerBills(retailerBills);
      setAdminDealerBills(dealerBills);

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
    } else if (isDealer) {
      const [dealerBillsResult, dealersResult] = await Promise.all([
        getAllDealerBills(),
        getAllDealers(),
      ]);
      const dealerBillsRows = extractList<DealerBill>(dealerBillsResult.data);
      const dealerRows = extractList<AppDealer>(dealersResult.data);
      const dealerApiPendingValues = dealerRows
        .map((dealer) => getDealerStoredPendingPayment(dealer))
        .filter((value): value is number => value !== null);
      const dealerApiPendingPayment = dealerApiPendingValues.reduce((sum, value) => sum + value, 0);
      const billFallbackPendingPayment = dealerBillsRows.reduce(
        (sum, bill) => sum + getDealerBillPendingPayment(bill),
        0,
      );

      setDealerBills(dealerBillsRows);
      setDealerPendingPaymentAmount(
        dealerApiPendingValues.length > 0 ? dealerApiPendingPayment : billFallbackPendingPayment,
      );
      setStats({
        shops: 0,
        routes: 0,
        bills: 0,
        dealerBills: dealerBillsRows.length,
        attendanceDays: 0,
        deliveredBills: 0,
        pendingDeliveryBills: 0,
        totalRevenue: 0,
        retailerCount: 0,
        dealerCount: 0,
      });
    } else if (isStaff) {
      const attendanceResult = await getStaffAttendanceHistory();
      const attendanceRows =
        attendanceResult.ok &&
        attendanceResult.data &&
        typeof attendanceResult.data === 'object' &&
        'data' in attendanceResult.data &&
        Array.isArray(attendanceResult.data.data)
          ? (attendanceResult.data.data as AttendanceEntry[])
          : [];

      const sortedAttendanceRows = [...attendanceRows].sort((left, right) => {
        const leftTime = new Date(left.date).getTime();
        const rightTime = new Date(right.date).getTime();
        return rightTime - leftTime;
      });

      setAttendanceHistory(sortedAttendanceRows);

      setStats({
        shops: 0,
        routes: 0,
        bills: 0,
        dealerBills: 0,
        attendanceDays: sortedAttendanceRows.length,
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
  }, [isAdmin, isDealer, isStaff, isDeliveryMan]);

  useFocusEffect(
    useCallback(() => {
      void loadStats('load');
    }, [loadStats]),
  );

  const selectedMonthLabel = useMemo(
    () => monthOptions.find((item) => item.value === selectedMonth)?.label ?? '',
    [monthOptions, selectedMonth],
  );
  const adminMonthStats = useMemo(() => {
    const filteredRetailerBills = adminRetailerBills.filter((bill) =>
      isDateInMonth(getAppBillDate(bill), selectedMonth, selectedYear),
    );
    const filteredDealerBills = adminDealerBills.filter((bill) =>
      isDateInMonth(getAppBillDate(bill), selectedMonth, selectedYear),
    );

    return {
      retailerBills: filteredRetailerBills.length,
      dealerBills: filteredDealerBills.length,
      totalRevenue:
        filteredRetailerBills.reduce((sum, bill) => sum + getBillTotal(bill), 0) +
        filteredDealerBills.reduce((sum, bill) => sum + getBillTotal(bill), 0),
    };
  }, [adminDealerBills, adminRetailerBills, selectedMonth, selectedYear]);
  const filteredDealerBills = useMemo(
    () =>
      dealerBills.filter((bill) => {
        const billDate = getDealerBillDate(bill);
        if (!billDate) {
          return false;
        }

        return billDate.getMonth() === selectedMonth && billDate.getFullYear() === selectedYear;
      }),
    [dealerBills, selectedMonth, selectedYear],
  );
  const dealerMonthSale = useMemo(
    () => filteredDealerBills.reduce((sum, bill) => sum + getDealerBillTotal(bill), 0),
    [filteredDealerBills],
  );
  const dealerPendingPayment = useMemo(
    () => dealerPendingPaymentAmount,
    [dealerPendingPaymentAmount],
  );
  const filteredAttendanceHistory = useMemo(
    () =>
      attendanceHistory.filter((entry) => {
        const date = new Date(entry.date);
        if (Number.isNaN(date.getTime())) {
          return false;
        }

        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      }),
    [attendanceHistory, selectedMonth, selectedYear],
  );
  const attendanceDaysCount = useMemo(
    () => filteredAttendanceHistory.filter((entry) => Boolean(entry.checkIn)).length,
    [filteredAttendanceHistory],
  );
  const selectedMonthDays = useMemo(
    () => new Date(selectedYear, selectedMonth + 1, 0).getDate(),
    [selectedMonth, selectedYear],
  );
  const salaryPerHour = useMemo(() => {
    if (typeof user?.salary === 'number' && Number.isFinite(user.salary)) {
      return user.salary;
    }

    if (typeof user?.salaryPerHour === 'number' && Number.isFinite(user.salaryPerHour)) {
      return user.salaryPerHour;
    }

    if (typeof user?.salaryPerDay === 'number' && Number.isFinite(user.salaryPerDay)) {
      return user.salaryPerDay / 8;
    }

    if (typeof user?.salary === 'number' && Number.isFinite(user.salary) && selectedMonthDays > 0) {
      return user.salary / (selectedMonthDays * 8);
    }

    return 0;
  }, [selectedMonthDays, user?.salary, user?.salaryPerDay, user?.salaryPerHour]);
  const staffRows = useMemo(
    () =>
      filteredAttendanceHistory.map((entry) => {
        const workedHours = getEntryWorkedHours(entry);
        const earnedSalary = workedHours * salaryPerHour;

        return {
          ...entry,
          workedHours,
          earnedSalary,
        };
      }),
    [filteredAttendanceHistory, salaryPerHour],
  );
  const totalWorkedHours = useMemo(
    () => staffRows.reduce((sum, entry) => sum + entry.workedHours, 0),
    [staffRows],
  );
  const totalEarnedSalary = useMemo(
    () => staffRows.reduce((sum, entry) => sum + entry.earnedSalary, 0),
    [staffRows],
  );

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      {isAdmin ? (
        <ScrollView
          key={`home-${homeVariant}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.adminDashboard}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadStats('refresh')} tintColor="#0F5D33" />
          }>
          <View style={styles.adminHero}>
            <Text style={styles.adminEyebrow}>{t('home_admin_overview')}</Text>
            <Text style={styles.adminTitle}>{t('home_admin_revenue_snapshot')}</Text>
            <Text style={styles.adminSubtitle}>{t('home_admin_subtitle')}</Text>

            <View style={styles.adminFilterRow}>
              <Pressable onPress={() => setMonthPickerVisible(true)} style={styles.adminFilterSelect}>
                <Text style={styles.adminFilterLabel}>{t('attendance_filter_month')}</Text>
                <Text style={styles.adminFilterValue}>{selectedMonthLabel}</Text>
              </Pressable>
              <Pressable onPress={() => setYearPickerVisible(true)} style={styles.adminFilterSelect}>
                <Text style={styles.adminFilterLabel}>{t('attendance_filter_year')}</Text>
                <Text style={styles.adminFilterValue}>{selectedYear}</Text>
              </Pressable>
            </View>
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
                      <Text style={styles.revenueRingLabel}>{t('home_admin_total_revenue')}</Text>
                      <Text style={styles.revenueRingValue}>{asCurrency(adminMonthStats.totalRevenue)}</Text>
                      <Text style={styles.revenueRingHint}>{t('home_admin_revenue_hint')}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.adminCompactGrid}>
                <View style={[styles.adminMiniCard, styles.adminMiniCardSoft]}>
                  <Text style={styles.adminMiniValue}>{adminMonthStats.retailerBills}</Text>
                  <Text style={styles.adminMiniLabel}>{t('home_admin_retailer_bills')}</Text>
                </View>
                <View style={[styles.adminMiniCard, styles.adminMiniCardWarm]}>
                  <Text style={styles.adminMiniValue}>{adminMonthStats.dealerBills}</Text>
                  <Text style={styles.adminMiniLabel}>{t('home_admin_dealer_bills')}</Text>
                </View>
                <View style={[styles.adminMiniCard, styles.adminMiniCardStrong]}>
                  <Text style={styles.adminMiniValue}>{stats.retailerCount}</Text>
                  <Text style={styles.adminMiniLabel}>{t('home_admin_retailers')}</Text>
                </View>
                <View style={[styles.adminMiniCard, styles.adminMiniCardPeach]}>
                  <Text style={styles.adminMiniValue}>{stats.dealerCount}</Text>
                  <Text style={styles.adminMiniLabel}>{t('home_admin_dealers')}</Text>
                </View>
              </View>

              <View style={styles.adminFooterPanel}>
                <Text style={styles.adminFooterTitle}>{t('home_admin_quick_summary')}</Text>
                <Text style={styles.adminFooterText}>
                  {t('home_admin_quick_summary_text', {
                    bills: adminMonthStats.retailerBills + adminMonthStats.dealerBills,
                    accounts: stats.retailerCount + stats.dealerCount,
                  })}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          key={`home-${homeVariant}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadStats('refresh')} tintColor="#0F5D33" />
          }>
          {isStaff ? (
            <>
              <View style={styles.staffHeroCard}>
                <Text style={styles.staffHeroEyebrow}>{t('home_staff_dashboard')}</Text>
                <Text style={styles.staffHeroTitle}>{t('home_hello_name', { name: firstName })}</Text>

                <View style={styles.staffFilterRow}>
                  <Pressable onPress={() => setMonthPickerVisible(true)} style={styles.staffFilterSelect}>
                    <Text style={styles.staffFilterLabel}>{t('attendance_filter_month')}</Text>
                    <Text style={styles.staffFilterValue}>{selectedMonthLabel}</Text>
                  </Pressable>
                  <Pressable onPress={() => setYearPickerVisible(true)} style={styles.staffFilterSelect}>
                    <Text style={styles.staffFilterLabel}>{t('attendance_filter_year')}</Text>
                    <Text style={styles.staffFilterValue}>{selectedYear}</Text>
                  </Pressable>
                </View>
              </View>

              {loadingStats ? (
                <View style={styles.statsSection}>
                  <View style={styles.statsLoading}>
                    <ActivityIndicator size="small" color="#0F5D33" />
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.staffSummaryRow}>
                    <View style={styles.staffMetricCard}>
                      <Text style={styles.staffSummaryLabel}>{t('home_stats_attendance_days')}</Text>
                      <Text style={styles.staffSummaryValue}>{attendanceDaysCount}</Text>
                    </View>
                    <View style={styles.staffMetricCard}>
                      <Text style={styles.staffSummaryLabel}>{t('home_staff_salary')}</Text>
                      <Text style={styles.staffSummarySalary}>{asCurrency(totalEarnedSalary)}</Text>
                    </View>
                  </View>

                  <View style={styles.staffInsightRow}>
                    <View style={styles.staffMetricCard}>
                      <Text style={styles.staffInfoLabelDark}>{t('home_staff_total_hours')}</Text>
                      <Text style={styles.staffInfoValueDark}>{formatWorkedTime(totalWorkedHours, language)}</Text>
                    </View>
                    <View style={styles.staffMetricCard}>
                      <Text style={styles.staffInfoLabelDark}>{t('home_staff_hourly_rate')}</Text>
                      <Text style={styles.staffInfoValueDark}>
                        {salaryPerHour > 0 ? `${asCurrency(salaryPerHour)}` : '--'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.staffTableCard}>
                    <View style={styles.staffTableHeader}>
                      <Text style={[styles.staffTableHeaderText, styles.staffTableDateColumn]}>{t('dealer_statement_date')}</Text>
                      <Text style={[styles.staffTableHeaderText, styles.staffTableTimeColumn]}>{t('home_staff_total_time')}</Text>
                      <Text style={[styles.staffTableHeaderText, styles.staffTableSalaryColumn]}>{t('home_staff_salary')}</Text>
                    </View>

                    {staffRows.length === 0 ? (
                      <View style={styles.staffEmptyState}>
                        <Text style={styles.staffEmptyTitle}>{t('home_staff_empty_month')}</Text>
                      </View>
                    ) : (
                      <View style={styles.staffTableBody}>
                        {staffRows.map((entry) => (
                          <Pressable
                            key={entry._id}
                            onPress={() => setSelectedAttendanceEntry(entry)}
                            style={styles.staffTableRow}>
                            <Text style={[styles.staffTableCell, styles.staffTableDateColumn]}>
                              {formatDay(entry.date, locale)}
                            </Text>
                            <Text style={[styles.staffTableCell, styles.staffTableTimeColumn]}>
                              {formatWorkedTime(entry.workedHours, language)}
                            </Text>
                            <Text style={[styles.staffTableCell, styles.staffTableSalaryColumn]}>
                              {asCurrency(entry.earnedSalary)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}
            </>
          ) : isDealer ? (
            <>
              <View style={styles.staffHeroCard}>
                <Text style={styles.staffHeroEyebrow}>{t('home_dealer_dashboard')}</Text>
                <Text style={styles.staffHeroTitle}>{t('home_hello_name', { name: displayName })}</Text>

                <View style={styles.staffFilterRow}>
                  <Pressable onPress={() => setMonthPickerVisible(true)} style={styles.staffFilterSelect}>
                    <Text style={styles.staffFilterLabel}>{t('attendance_filter_month')}</Text>
                    <Text style={styles.staffFilterValue}>{selectedMonthLabel}</Text>
                  </Pressable>
                  <Pressable onPress={() => setYearPickerVisible(true)} style={styles.staffFilterSelect}>
                    <Text style={styles.staffFilterLabel}>{t('attendance_filter_year')}</Text>
                    <Text style={styles.staffFilterValue}>{selectedYear}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>{t('home_stats_dealer_title')}</Text>

                {loadingStats ? (
                  <View style={styles.statsLoading}>
                    <ActivityIndicator size="small" color="#0F5D33" />
                  </View>
                ) : (
                  <>
                    <View style={styles.statsGrid}>
                      <View style={styles.dealerStatCard}>
                        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.dealerStatValue}>
                          {asCurrency(dealerMonthSale)}
                        </Text>
                        <Text style={styles.statLabel}>{t('home_stats_month_sale')}</Text>
                      </View>
                      <View style={styles.dealerStatCard}>
                        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.dealerStatValue}>
                          {asCurrency(dealerPendingPayment)}
                        </Text>
                        <Text style={styles.statLabel}>{t('home_stats_pending_payment')}</Text>
                      </View>
                    </View>

                  </>
                )}
              </View>

              <Pressable
                onPress={() => router.push('/dealer-statement')}
                style={({ pressed }) => [styles.statementCard, pressed ? styles.statementCardPressed : null]}>
                <View style={styles.statementIconWrap}>
                  <Ionicons name="document-text-outline" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.statementCopy}>
                  <Text style={styles.statementTitle}>{t('home_statement_title')}</Text>
                  <Text style={styles.statementSubtitle}>{t('home_statement_subtitle')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#0B4A34" />
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.heroCard}>
                <Image source={require('../assets/images/image.png')} style={styles.logo} resizeMode="contain" />
                <Text style={styles.title}>{t('home_welcome_title')}</Text>
                <Text style={styles.subtitle}>{t('home_welcome_message', { name: firstName })}</Text>
                <Text style={styles.roleText}>{roleLabel}</Text>
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
                    {isDeliveryMan ? (
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
      )}

      <Modal transparent visible={monthPickerVisible} onRequestClose={() => setMonthPickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setMonthPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>{t('attendance_filter_month')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {monthOptions.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    setSelectedMonth(item.value);
                    setMonthPickerVisible(false);
                  }}
                  style={styles.pickerItem}>
                  <Text style={styles.pickerItemTitle}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={yearPickerVisible} onRequestClose={() => setYearPickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setYearPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>{t('attendance_filter_year')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {yearOptions.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setSelectedYear(item);
                    setYearPickerVisible(false);
                  }}
                  style={styles.pickerItem}>
                  <Text style={styles.pickerItemTitle}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={Boolean(selectedAttendanceEntry)}
        onRequestClose={() => setSelectedAttendanceEntry(null)}>
        <Pressable style={styles.detailBackdrop} onPress={() => setSelectedAttendanceEntry(null)}>
          <Pressable style={styles.detailCard} onPress={() => {}}>
            <Text style={styles.detailTitle}>
              {selectedAttendanceEntry ? formatDay(selectedAttendanceEntry.date, locale) : ''}
            </Text>

            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('attendance_in_button')}</Text>
                <Text style={styles.detailValue}>
                  {selectedAttendanceEntry
                    ? formatAttendanceTime(
                        selectedAttendanceEntry.date,
                        selectedAttendanceEntry.checkIn,
                        locale,
                      )
                    : '--'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('attendance_out_button')}</Text>
                <Text style={styles.detailValue}>
                  {selectedAttendanceEntry
                    ? formatAttendanceTime(
                        selectedAttendanceEntry.date,
                        selectedAttendanceEntry.checkOut,
                        locale,
                      )
                    : '--'}
                </Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('attendance_break_in_button')}</Text>
                <Text style={styles.detailValue}>
                  {selectedAttendanceEntry
                    ? formatAttendanceTime(
                        selectedAttendanceEntry.date,
                        selectedAttendanceEntry.breakIn ?? null,
                        locale,
                      )
                    : '--'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('attendance_break_out_button')}</Text>
                <Text style={styles.detailValue}>
                  {selectedAttendanceEntry
                    ? formatAttendanceTime(
                        selectedAttendanceEntry.date,
                        selectedAttendanceEntry.breakOut ?? null,
                        locale,
                      )
                    : '--'}
                </Text>
              </View>
            </View>

            <Pressable onPress={() => setSelectedAttendanceEntry(null)} style={styles.detailCloseButton}>
              <Text style={styles.detailCloseText}>{t('common_close')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  staffHeroCard: {
    backgroundColor: '#173F31',
    borderRadius: 30,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#0A2218',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  staffHeroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#A9E2C6',
  },
  staffHeroTitle: {
    marginTop: 10,
    fontSize: 31,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  staffHeroSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#D9EEE4',
  },
  staffFilterRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  staffFilterSelect: {
    flex: 1,
    minHeight: 62,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
  },
  staffFilterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B9D8CB',
    textTransform: 'uppercase',
  },
  staffFilterValue: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  staffSummaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  staffMetricCard: {
    flex: 1,
    minHeight: 112,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E1ECE7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 5,
    justifyContent: 'space-between',
  },
  staffSummaryValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0B5B35',
  },
  staffSummarySalary: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0B5B35',
  },
  staffSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#5E7468',
    letterSpacing: 0.8,
  },
  staffInsightRow: {
    flexDirection: 'row',
    gap: 8,
  },
  staffInfoLabelDark: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#5E7468',
  },
  staffInfoValueDark: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0B5B35',
  },
  staffTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E1ECE7',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 5,
  },
  staffTableTitleRow: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  staffTableTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#163526',
  },
  staffTableSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#687A72',
  },
  staffTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F2F7F4',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#D6E5DC',
  },
  staffTableHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#244434',
    textTransform: 'uppercase',
  },
  staffTableBody: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  staffTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 12,
    marginTop: 8,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#FBFDFC',
    borderWidth: 1,
    borderColor: '#EDF2EF',
  },
  staffTableCell: {
    fontSize: 13,
    color: '#173126',
    fontWeight: '600',
  },
  staffTableDateColumn: {
    flex: 1,
    textAlign: 'center',
  },
  staffTableTimeColumn: {
    flex: 0.9,
    textAlign: 'center',
  },
  staffTableSalaryColumn: {
    flex: 1,
    textAlign: 'center',
  },
  staffEmptyState: {
    padding: 22,
  },
  staffEmptyTitle: {
    fontSize: 14,
    color: '#61736D',
    textAlign: 'center',
  },
  adminDashboard: {
    flexGrow: 1,
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
  adminFilterRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  adminFilterSelect: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#A8CDB9',
    justifyContent: 'center',
    shadowColor: '#123524',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  adminFilterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2F7B59',
    textTransform: 'uppercase',
  },
  adminFilterValue: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
    color: '#123524',
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
  dealerStatCard: {
    width: '48%',
    minHeight: 118,
    borderRadius: 18,
    backgroundColor: '#F4FAF7',
    borderWidth: 1,
    borderColor: '#DCE9E2',
    padding: 18,
    justifyContent: 'space-between',
  },
  dealerStatValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0B5B35',
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
  dealerSummaryCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: '#173F31',
    padding: 18,
  },
  dealerSummaryCount: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dealerSummaryLabel: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#CFE8DB',
  },
  dealerSummaryHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#A9E2C6',
  },
  statementCard: {
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E9DF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statementCardPressed: {
    opacity: 0.9,
  },
  statementIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#0B4A34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statementCopy: {
    flex: 1,
    minWidth: 0,
  },
  statementTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#123D33',
  },
  statementSubtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
    color: '#60786F',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 31, 23, 0.28)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  pickerCard: {
    maxHeight: '48%',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE9E2',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#173126',
    marginBottom: 10,
  },
  pickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2EF',
  },
  pickerItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#214836',
  },
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 31, 23, 0.3)',
    justifyContent: 'center',
    padding: 20,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E1ECE7',
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#173126',
    textAlign: 'center',
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  detailItem: {
    flex: 1,
    minHeight: 96,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#F4FAF7',
    borderWidth: 1,
    borderColor: '#DCE9E2',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#5E7468',
    letterSpacing: 0.8,
  },
  detailValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B5B35',
  },
  detailCloseButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#173F31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCloseText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
