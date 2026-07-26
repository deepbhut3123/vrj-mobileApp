import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import { type DealerPayment, getAllDealerPayments } from '@/services/api';

const asCurrency = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;

const formatDateForApi = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthDateRange = (month: number, year: number) => ({
  fromDate: formatDateForApi(new Date(year, month, 1)),
  toDate: formatDateForApi(new Date(year, month + 1, 0)),
});

const formatPaymentDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
};

export default function DealerPaymentsScreen() {
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const currentDate = useMemo(() => new Date(), []);
  const [payments, setPayments] = useState<DealerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index,
        label: new Intl.DateTimeFormat(language === 'gu' ? 'gu-IN' : 'en-IN', { month: 'long' }).format(
          new Date(2026, index, 1),
        ),
      })),
    [language],
  );
  const yearOptions = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    return Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);
  }, [currentDate]);
  const selectedMonthLabel = useMemo(
    () => monthOptions.find((item) => item.value === selectedMonth)?.label ?? '',
    [monthOptions, selectedMonth],
  );
  const totalPayment = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments],
  );

  const loadPayments = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const result = await getAllDealerPayments(getMonthDateRange(selectedMonth, selectedYear));
    if (result.ok) {
      const rows =
        result.data && typeof result.data === 'object' && Array.isArray(result.data.data)
          ? result.data.data
          : [];
      setPayments(rows);
    }

    setLoading(false);
    setRefreshing(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useFocusEffect(
    useCallback(() => {
      void loadPayments('refresh');
    }, [loadPayments]),
  );

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadPayments('refresh')} tintColor="#0E6C50" />
        }>
        <View style={styles.filterRow}>
          <Pressable onPress={() => setMonthPickerVisible(true)} style={styles.filterSelect}>
            <Text style={styles.filterLabel}>{t('attendance_filter_month')}</Text>
            <Text style={styles.filterValue}>{selectedMonthLabel}</Text>
          </Pressable>
          <Pressable onPress={() => setYearPickerVisible(true)} style={styles.filterSelect}>
            <Text style={styles.filterLabel}>{t('attendance_filter_year')}</Text>
            <Text style={styles.filterValue}>{selectedYear}</Text>
          </Pressable>
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('dealer_payments_month_payment')}</Text>
          <Text style={styles.totalValue}>{asCurrency(totalPayment)}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0E6C50" />
          </View>
        ) : payments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('dealer_payments_empty_month')}</Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View key={payment._id} style={styles.paymentCard}>
              <Text style={styles.paymentDate}>{formatPaymentDate(payment.paymentDate)}</Text>
              <View style={styles.paymentMain}>
                <Text style={styles.paymentType}>{payment.paymentType}</Text>
                <Text style={styles.paymentAmount}>{asCurrency(Number(payment.amount || 0))}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal transparent visible={monthPickerVisible} onRequestClose={() => setMonthPickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setMonthPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>{t('attendance_filter_month')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {monthOptions.map((month) => (
                <Pressable
                  key={month.value}
                  onPress={() => {
                    setSelectedMonth(month.value);
                    setMonthPickerVisible(false);
                  }}
                  style={styles.pickerItem}>
                  <Text style={styles.pickerItemTitle}>{month.label}</Text>
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
              {yearOptions.map((year) => (
                <Pressable
                  key={year}
                  onPress={() => {
                    setSelectedYear(year);
                    setYearPickerVisible(false);
                  }}
                  style={styles.pickerItem}>
                  <Text style={styles.pickerItemTitle}>{year}</Text>
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
  page: { flex: 1, backgroundColor: '#F1F8F4' },
  content: { padding: 20, paddingBottom: 120 },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  filterSelect: { flex: 1, minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: '#D8E9DF', backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center' },
  filterLabel: { fontSize: 11, fontWeight: '800', color: '#60786F', textTransform: 'uppercase' },
  filterValue: { marginTop: 3, fontSize: 16, fontWeight: '800', color: '#123D33' },
  totalCard: { backgroundColor: '#0B4A34', borderRadius: 18, padding: 16, marginBottom: 4 },
  totalLabel: { fontSize: 12, fontWeight: '800', color: '#D8F0E5', textTransform: 'uppercase' },
  totalValue: { marginTop: 6, fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { marginTop: 18, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#D8E9DF' },
  emptyText: { color: '#5D746C', fontSize: 15 },
  paymentCard: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#D8E9DF', flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentDate: { width: 84, color: '#123D33', fontSize: 16, fontWeight: '800' },
  paymentMain: { flex: 1, minWidth: 0 },
  paymentType: { fontSize: 11, fontWeight: '800', color: '#60786F', textTransform: 'uppercase' },
  paymentAmount: { marginTop: 2, color: '#0E6C50', fontSize: 20, fontWeight: '800' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(10, 44, 34, 0.4)', justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 },
  pickerCard: { backgroundColor: '#FFFFFF', borderRadius: 24, maxHeight: '62%', padding: 18 },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: '#123D33', marginBottom: 12 },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#DCEBE3' },
  pickerItemTitle: { fontSize: 16, fontWeight: '700', color: '#123D33' },
});
