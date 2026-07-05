import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import {
  type AttendanceAction,
  type AttendanceEntry,
  getCurrentUser,
  getRoleLabel,
  getStaffAttendanceHistory,
  markStaffAttendanceWithLocation,
} from '@/services/api';

const toNumberOrNull = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ATTENDANCE_TARGET_LATITUDE = toNumberOrNull(process.env.EXPO_PUBLIC_ATTENDANCE_TARGET_LATITUDE);
const ATTENDANCE_TARGET_LONGITUDE = toNumberOrNull(process.env.EXPO_PUBLIC_ATTENDANCE_TARGET_LONGITUDE);
const ATTENDANCE_RADIUS_METERS = toNumberOrNull(process.env.EXPO_PUBLIC_ATTENDANCE_RADIUS_METERS) ?? 150;

const ATTENDANCE_LOCATION_CONFIGURED =
  ATTENDANCE_TARGET_LATITUDE !== null && ATTENDANCE_TARGET_LONGITUDE !== null;

const getDistanceMeters = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitudeRadians = toRadians(from.latitude);
  const toLatitudeRadians = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const formatDistance = (distanceMeters: number, locale: string) => {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  const distanceKilometers = distanceMeters / 1000;
  const maximumFractionDigits = distanceKilometers < 10 ? 2 : 1;

  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(distanceKilometers)} km`;
};

const formatDay = (value: string, locale: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatTime = (value: string | null, locale: string) => {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return value;
};

const isSameDay = (left: string, right: Date) => {
  const leftDate = new Date(left);
  if (Number.isNaN(leftDate.getTime())) {
    return false;
  }

  return (
    leftDate.getFullYear() === right.getFullYear() &&
    leftDate.getMonth() === right.getMonth() &&
    leftDate.getDate() === right.getDate()
  );
};

export default function StaffAttendanceScreen() {
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const user = getCurrentUser();
  const roleId = Number(user?.roleId ?? 0);
  const isStaff = roleId === 5;
  const locale = language === 'gu' ? 'gu-IN' : 'en-IN';
  const currentDate = useMemo(() => new Date(), []);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index,
        label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2026, index, 1)),
      })),
    [locale],
  );
  const yearOptions = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    return Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);
  }, [currentDate]);

  const [history, setHistory] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<AttendanceAction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [locationChecking, setLocationChecking] = useState(false);
  const [locationAllowed, setLocationAllowed] = useState(!ATTENDANCE_LOCATION_CONFIGURED);
  const [locationDistanceMeters, setLocationDistanceMeters] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const loadHistory = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (!isStaff) {
      setHistory([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const result = await getStaffAttendanceHistory();

    if (result.ok) {
      const rows = Array.isArray(result.data?.data) ? result.data.data : [];
      const sorted = [...rows].sort((left, right) => {
        const leftTime = new Date(left.date).getTime();
        const rightTime = new Date(right.date).getTime();
        return rightTime - leftTime;
      });
      setHistory(sorted);
    } else {
      setHistory([]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [isStaff]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory('load');
    }, [loadHistory]),
  );

  const todayEntry = useMemo(
    () => history.find((entry) => isSameDay(entry.date, new Date())) ?? null,
    [history],
  );
  const filteredHistory = useMemo(
    () =>
      history.filter((entry) => {
        const date = new Date(entry.date);
        if (Number.isNaN(date.getTime())) {
          return false;
        }
        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      }),
    [history, selectedMonth, selectedYear],
  );
  const selectedMonthLabel = useMemo(
    () => monthOptions.find((item) => item.value === selectedMonth)?.label ?? '',
    [monthOptions, selectedMonth],
  );

  const canCheckIn = isStaff && !todayEntry?.checkIn && submittingAction === null;
  const canCheckOut = isStaff && Boolean(todayEntry?.checkIn) && !todayEntry?.checkOut && submittingAction === null;
  const canBreakIn =
    isStaff &&
    Boolean(todayEntry?.checkIn) &&
    !todayEntry?.breakIn &&
    !todayEntry?.checkOut &&
    submittingAction === null;
  const canBreakOut =
    isStaff &&
    Boolean(todayEntry?.breakIn) &&
    !todayEntry?.breakOut &&
    !todayEntry?.checkOut &&
    submittingAction === null;

  const getCurrentCoordinates = useCallback(async () => {
    const existingPermission = await Location.getForegroundPermissionsAsync();
    const permission =
      existingPermission.status === 'granted'
        ? existingPermission
        : await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      throw new Error('LOCATION_PERMISSION_DENIED');
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      try {
        await Location.enableNetworkProviderAsync();
      } catch {
        throw new Error('LOCATION_SERVICES_DISABLED');
      }
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 60_000,
      });
      if (!lastKnown) {
        throw new Error('NO_LOCATION_FIX');
      }
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }
  }, []);

  const refreshAttendanceAccess = useCallback(async () => {
    if (!isStaff || !ATTENDANCE_LOCATION_CONFIGURED) {
      setLocationAllowed(true);
      setLocationDistanceMeters(null);
      setLocationError(null);
      setLocationChecking(false);
      return;
    }

    setLocationChecking(true);
    try {
      const coordinates = await getCurrentCoordinates();
      const distance = getDistanceMeters(coordinates, {
        latitude: ATTENDANCE_TARGET_LATITUDE,
        longitude: ATTENDANCE_TARGET_LONGITUDE,
      });

      setLocationDistanceMeters(distance);
      setLocationAllowed(distance <= ATTENDANCE_RADIUS_METERS);
      setLocationError(null);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'NO_LOCATION_FIX';
      setLocationAllowed(false);
      setLocationDistanceMeters(null);
      setLocationError(code);
    } finally {
      setLocationChecking(false);
    }
  }, [getCurrentCoordinates, isStaff]);

  const locationStatusMessage = useMemo(() => {
    const formattedDistance = formatDistance(locationDistanceMeters ?? 0, locale);
    const formattedRadius = formatDistance(ATTENDANCE_RADIUS_METERS, locale);

    if (!ATTENDANCE_LOCATION_CONFIGURED) {
      return t('attendance_location_not_configured');
    }

    if (locationChecking) {
      return t('attendance_location_checking');
    }

    if (locationError === 'LOCATION_PERMISSION_DENIED') {
      return t('attendance_location_permission');
    }

    if (locationError === 'LOCATION_SERVICES_DISABLED') {
      return t('attendance_location_services');
    }

    if (locationError) {
      return t('attendance_location_unavailable');
    }

    if (locationAllowed) {
      return t('attendance_location_allowed', {
        distance: formattedDistance,
        radius: formattedRadius,
      });
    }

    return t('attendance_location_outside', {
      distance: formattedDistance,
      radius: formattedRadius,
    });
  }, [locale, locationAllowed, locationChecking, locationDistanceMeters, locationError, t]);

  const handleAttendanceAction = async (action: AttendanceAction) => {
    let coordinates: { latitude: number; longitude: number };
    try {
      coordinates = await getCurrentCoordinates();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const message =
        code === 'LOCATION_PERMISSION_DENIED'
          ? t('attendance_location_permission')
          : code === 'LOCATION_SERVICES_DISABLED'
          ? t('attendance_location_services')
          : t('attendance_location_unavailable');
      Alert.alert(t('attendance_alert_title'), message);
      return;
    }

    if (ATTENDANCE_LOCATION_CONFIGURED) {
      const distance = getDistanceMeters(coordinates, {
        latitude: ATTENDANCE_TARGET_LATITUDE,
        longitude: ATTENDANCE_TARGET_LONGITUDE,
      });

      setLocationDistanceMeters(distance);
      const isAllowed = distance <= ATTENDANCE_RADIUS_METERS;
      setLocationAllowed(isAllowed);
      setLocationError(null);

      if (!isAllowed) {
        Alert.alert(
          t('attendance_alert_title'),
          t('attendance_location_outside', {
            distance: formatDistance(distance, locale),
            radius: formatDistance(ATTENDANCE_RADIUS_METERS, locale),
          }),
        );
        return;
      }
    }

    setSubmittingAction(action);
    const result = await markStaffAttendanceWithLocation(action, coordinates);
    setSubmittingAction(null);

    if (!result.ok) {
      Alert.alert(t('attendance_alert_title'), result.message);
      return;
    }

    Alert.alert(
      t('attendance_alert_title'),
      action === 'in'
        ? t('attendance_checkin_success')
        : action === 'out'
        ? t('attendance_checkout_success')
        : action === 'break-in'
        ? t('attendance_breakin_success')
        : t('attendance_breakout_success'),
    );
    await loadHistory('refresh');
  };

  const handleRefresh = () => {
    setSelectedMonth(currentDate.getMonth());
    setSelectedYear(currentDate.getFullYear());
    void loadHistory('refresh');
    void refreshAttendanceAccess();
  };

  useFocusEffect(
    useCallback(() => {
      void refreshAttendanceAccess();
    }, [refreshAttendanceAccess]),
  );

  const canUseAttendanceButtons = locationAllowed && !locationChecking;

  if (!isStaff) {
    return (
      <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{t('attendance_access_title')}</Text>
          <Text style={styles.noticeText}>
            {t('attendance_access_message', { role: getRoleLabel(user?.roleId) })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0F5D33" />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>{t('attendance_title')}</Text>
          <Text style={styles.subtitle}>{t('attendance_subtitle')}</Text>

          <View style={[styles.locationCard, locationAllowed ? styles.locationCardAllowed : styles.locationCardBlocked]}>
            <Text style={styles.locationTitle}>{t('attendance_location_status_title')}</Text>
            <Text style={styles.locationText}>{locationStatusMessage}</Text>
          </View>

          <View style={styles.todayRow}>
            <View style={styles.todayPill}>
              <Text style={styles.todayLabel}>{t('attendance_today_in')}</Text>
              <Text style={styles.todayValue}>{formatTime(todayEntry?.checkIn ?? null, locale)}</Text>
            </View>
            <View style={styles.todayPill}>
              <Text style={styles.todayLabel}>{t('attendance_today_out')}</Text>
              <Text style={styles.todayValue}>{formatTime(todayEntry?.checkOut ?? null, locale)}</Text>
            </View>
          </View>

          <View style={styles.todayRow}>
            <View style={styles.todayPill}>
              <Text style={styles.todayLabel}>{t('attendance_today_break_in')}</Text>
              <Text style={styles.todayValue}>{formatTime(todayEntry?.breakIn ?? null, locale)}</Text>
            </View>
            <View style={styles.todayPill}>
              <Text style={styles.todayLabel}>{t('attendance_today_break_out')}</Text>
              <Text style={styles.todayValue}>{formatTime(todayEntry?.breakOut ?? null, locale)}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              disabled={!canCheckIn || !canUseAttendanceButtons}
              onPress={() => void handleAttendanceAction('in')}
              style={[
                styles.actionButton,
                styles.actionButtonIn,
                (!canCheckIn || !canUseAttendanceButtons) && styles.buttonDisabled,
              ]}>
              {submittingAction === 'in' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>{t('attendance_in_button')}</Text>
              )}
            </Pressable>

            <Pressable
              disabled={!canCheckOut || !canUseAttendanceButtons}
              onPress={() => void handleAttendanceAction('out')}
              style={[
                styles.actionButton,
                styles.actionButtonOut,
                (!canCheckOut || !canUseAttendanceButtons) && styles.buttonDisabled,
              ]}>
              {submittingAction === 'out' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>{t('attendance_out_button')}</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              disabled={!canBreakIn || !canUseAttendanceButtons}
              onPress={() => void handleAttendanceAction('break-in')}
              style={[
                styles.actionButton,
                styles.actionButtonBreakIn,
                (!canBreakIn || !canUseAttendanceButtons) && styles.buttonDisabled,
              ]}>
              {submittingAction === 'break-in' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>{t('attendance_break_in_button')}</Text>
              )}
            </Pressable>

            <Pressable
              disabled={!canBreakOut || !canUseAttendanceButtons}
              onPress={() => void handleAttendanceAction('break-out')}
              style={[
                styles.actionButton,
                styles.actionButtonBreakOut,
                (!canBreakOut || !canUseAttendanceButtons) && styles.buttonDisabled,
              ]}>
              {submittingAction === 'break-out' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>{t('attendance_break_out_button')}</Text>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>{t('attendance_daywise_title')}</Text>
          <Text style={styles.sectionSubtitle}>{t('attendance_daywise_subtitle')}</Text>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>{t('attendance_filter_title')}</Text>
            <View style={styles.filterControls}>
              <Pressable onPress={() => setMonthPickerVisible(true)} style={styles.filterSelect}>
                <Text style={styles.filterSelectLabel}>{t('attendance_filter_month')}</Text>
                <Text style={styles.filterSelectValue}>{selectedMonthLabel}</Text>
              </Pressable>
              <Pressable onPress={() => setYearPickerVisible(true)} style={styles.filterSelect}>
                <Text style={styles.filterSelectLabel}>{t('attendance_filter_year')}</Text>
                <Text style={styles.filterSelectValue}>{selectedYear}</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#0F5D33" />
            </View>
          ) : filteredHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {history.length === 0 ? t('attendance_empty_title') : t('attendance_empty_filtered')}
              </Text>
              <Text style={styles.emptyText}>
                {history.length === 0 ? t('attendance_empty_message') : t('attendance_daywise_subtitle')}
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {filteredHistory.map((entry) => (
                <View key={entry._id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyDate}>{formatDay(entry.date, locale)}</Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{entry.status || t('attendance_status_present')}</Text>
                    </View>
                  </View>

                  <View style={styles.timeGrid}>
                    <View style={styles.timeBox}>
                      <Text style={styles.timeLabel}>{t('attendance_in_time')}</Text>
                      <Text style={styles.timeValue}>{formatTime(entry.checkIn, locale)}</Text>
                    </View>
                    <View style={styles.timeBox}>
                      <Text style={styles.timeLabel}>{t('attendance_out_time')}</Text>
                      <Text style={styles.timeValue}>{formatTime(entry.checkOut, locale)}</Text>
                    </View>
                  </View>

                  <View style={styles.timeGrid}>
                    <View style={styles.timeBox}>
                      <Text style={styles.timeLabel}>{t('attendance_break_in_time')}</Text>
                      <Text style={styles.timeValue}>{formatTime(entry.breakIn ?? null, locale)}</Text>
                    </View>
                    <View style={styles.timeBox}>
                      <Text style={styles.timeLabel}>{t('attendance_break_out_time')}</Text>
                      <Text style={styles.timeValue}>{formatTime(entry.breakOut ?? null, locale)}</Text>
                    </View>
                  </View>

                  {entry.note ? <Text style={styles.noteText}>{entry.note}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F2F8F6',
    paddingHorizontal: 16,
  },
  content: {
    paddingBottom: 24,
    gap: 16,
  },
  heroCard: {
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
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0B3E2A',
  },
  subtitle: {
    fontSize: 14,
    color: '#4C665B',
    lineHeight: 20,
  },
  locationCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  locationCardAllowed: {
    backgroundColor: '#ECF9F1',
    borderColor: '#B7E1C4',
  },
  locationCardBlocked: {
    backgroundColor: '#FFF5F2',
    borderColor: '#F1CCC3',
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#244434',
  },
  locationText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#5A6E63',
  },
  todayRow: {
    flexDirection: 'row',
    gap: 12,
  },
  todayPill: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F4FAF7',
    borderWidth: 1,
    borderColor: '#DCE9E2',
  },
  todayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C6C76',
  },
  todayValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '800',
    color: '#0B5B35',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonIn: {
    backgroundColor: '#0F7A43',
  },
  actionButtonOut: {
    backgroundColor: '#C06A18',
  },
  actionButtonBreakIn: {
    backgroundColor: '#165FA6',
  },
  actionButtonBreakOut: {
    backgroundColor: '#7B3FC7',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  listCard: {
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
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#123524',
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#61736D',
  },
  filterRow: {
    marginTop: 12,
    gap: 8,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7D75',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterSelect: {
    minWidth: 92,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F4FAF7',
    borderWidth: 1,
    borderColor: '#DCE9E2',
    justifyContent: 'center',
  },
  filterSelectLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7D75',
  },
  filterSelectValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
    color: '#214836',
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
  loadingWrap: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#183126',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#61736D',
    lineHeight: 20,
  },
  historyList: {
    marginTop: 14,
    gap: 12,
  },
  historyCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F8FCFA',
    borderWidth: 1,
    borderColor: '#E2EEE8',
    gap: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyDate: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#173126',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E7F4EC',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2E6A53',
  },
  timeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  timeBox: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EDE8',
  },
  timeLabel: {
    fontSize: 12,
    color: '#61736D',
    fontWeight: '700',
  },
  timeValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: '#10271C',
  },
  noteText: {
    fontSize: 13,
    color: '#5A6B65',
    lineHeight: 18,
  },
  noticeCard: {
    marginTop: 20,
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1ECE7',
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#173126',
  },
  noticeText: {
    marginTop: 8,
    fontSize: 14,
    color: '#61736D',
    lineHeight: 20,
  },
});
