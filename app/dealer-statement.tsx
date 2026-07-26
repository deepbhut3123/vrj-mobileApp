import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import {
  type DealerBill,
  type DealerPayment,
  getAllDealerBills,
  getAllDealerPayments,
} from '@/services/api';

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

const getDateKey = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : formatDateForApi(parsed);
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const toSafeFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/_+/g, '_');

export default function DealerStatementScreen() {
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentDate = useMemo(() => new Date(), []);
  const [bills, setBills] = useState<DealerBill[]>([]);
  const [payments, setPayments] = useState<DealerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
  const statementFileName = useMemo(() => {
    const monthName = toSafeFilenamePart(selectedMonthLabel || String(selectedMonth + 1).padStart(2, '0'));
    return `Dealer_Statement_${monthName}_${selectedYear}.pdf`;
  }, [selectedMonth, selectedMonthLabel, selectedYear]);
  const statementRows = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const billsByDate = new Map<string, DealerBill[]>();
    const paymentsByDate = new Map<string, DealerPayment[]>();

    for (const bill of bills) {
      const key = getDateKey(bill.billDate || bill.createdAt || '');
      if (!key) continue;
      billsByDate.set(key, [...(billsByDate.get(key) ?? []), bill]);
    }

    for (const payment of payments) {
      const key = getDateKey(payment.paymentDate || payment.createdAt || '');
      if (!key) continue;
      paymentsByDate.set(key, [...(paymentsByDate.get(key) ?? []), payment]);
    }

    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = formatDateForApi(new Date(selectedYear, selectedMonth, index + 1));
      const dayBills = billsByDate.get(date) ?? [];
      const dayPayments = paymentsByDate.get(date) ?? [];
      return {
        date,
        bills: dayBills,
        payments: dayPayments,
        billTotal: dayBills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0),
        paymentTotal: dayPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      };
    });
  }, [bills, payments, selectedMonth, selectedYear]);
  const activeStatementRows = useMemo(
    () => statementRows.filter((row) => row.billTotal > 0 || row.paymentTotal > 0),
    [statementRows],
  );
  const billDetailTables = useMemo(
    () =>
      activeStatementRows.flatMap((row) =>
        row.bills.map((bill, index) => ({
          id: bill._id || `${row.date}-${index}`,
          date: row.date,
          billTotal: Number(bill.totalAmount || 0),
          kattaCount: Number(bill.kattaCount || 0),
          items: (bill.items ?? []).map((item) => {
            const quantity = Number(item.quantity || 0);
            const amount = Number(item.amount || item.productRate || 0);
            const total = Number(item.total || quantity * amount || 0);
            const mrp = Number(item.mrp || 0);
            return {
              mrp: Number.isFinite(mrp) && mrp > 0 ? mrp : 0,
              productName: item.productName || 'Item',
              quantity,
              amount,
              total,
            };
          }),
        })),
      ),
    [activeStatementRows],
  );
  const monthBillTotal = useMemo(
    () => statementRows.reduce((sum, row) => sum + row.billTotal, 0),
    [statementRows],
  );
  const monthPaymentTotal = useMemo(
    () => statementRows.reduce((sum, row) => sum + row.paymentTotal, 0),
    [statementRows],
  );

  const loadStatement = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const range = getMonthDateRange(selectedMonth, selectedYear);
    const [billsResult, paymentsResult] = await Promise.all([
      getAllDealerBills(range),
      getAllDealerPayments(range),
    ]);

    if (!billsResult.ok || !paymentsResult.ok) {
      Alert.alert(t('dealer_statement_title'), billsResult.message || paymentsResult.message);
    }

    setBills(
      billsResult.ok &&
        billsResult.data &&
        typeof billsResult.data === 'object' &&
        Array.isArray(billsResult.data.data)
        ? billsResult.data.data
        : [],
    );
    setPayments(
      paymentsResult.ok &&
        paymentsResult.data &&
        typeof paymentsResult.data === 'object' &&
        Array.isArray(paymentsResult.data.data)
        ? paymentsResult.data.data
        : [],
    );
    setLoading(false);
    setRefreshing(false);
  }, [selectedMonth, selectedYear, t]);

  useEffect(() => {
    void loadStatement();
  }, [loadStatement]);

  useFocusEffect(
    useCallback(() => {
      void loadStatement('refresh');
    }, [loadStatement]),
  );

  const buildStatementHtml = () => {
    const detailTables = billDetailTables
      .map((bill, index) => {
        const itemRows = bill.items
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(`${item.mrp > 0 ? `${Math.round(item.mrp)} ` : ''}${item.productName}`)}</td>
                <td class="right">${item.quantity}</td>
                <td class="right">${Math.round(item.amount)}</td>
                <td class="right">${escapeHtml(asCurrency(item.total))}</td>
              </tr>
            `,
          )
          .join('');

        return `
          <div class="bill-card">
            <div class="bill-title">${escapeHtml(t('dealer_statement_bill'))} ${index + 1}</div>
            <div class="bill-meta">
              <span>${escapeHtml(bill.date)}</span>
              <span>${escapeHtml(t('dealer_bills_katta'))}: ${bill.kattaCount}</span>
              <span>${escapeHtml(asCurrency(bill.billTotal))}</span>
            </div>
            <table class="bill-table">
              <thead>
                <tr><th>${escapeHtml(t('dealer_statement_product'))}</th><th>${escapeHtml(t('dealer_statement_qty'))}</th><th>${escapeHtml(t('dealer_statement_rate'))}</th><th>${escapeHtml(t('dealer_statement_total'))}</th></tr>
              </thead>
              <tbody>${itemRows || '<tr><td colspan="4">-</td></tr>'}</tbody>
            </table>
          </div>
        `;
      })
      .join('');
    const rows = activeStatementRows
      .map((row) => {
        return `
          <tr>
            <td>${escapeHtml(row.date)}</td>
            <td class="right">${row.billTotal > 0 ? escapeHtml(asCurrency(row.billTotal)) : '-'}</td>
            <td class="right">${row.paymentTotal > 0 ? escapeHtml(asCurrency(row.paymentTotal)) : '-'}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <html>
        <head>
          <style>
            @page { margin: 34px 24px 24px; }
            body { font-family: Arial, "Noto Sans Gujarati", sans-serif; color: #123D33; padding: 0; }
            h1 { margin: 0; font-size: 24px; }
            .subtitle { margin-top: 6px; color: #60786F; font-size: 13px; }
            .summary { display: flex; gap: 12px; margin: 18px 0; }
            .box { flex: 1; border: 1px solid #D8E9DF; border-radius: 10px; padding: 12px; }
            .label { color: #60786F; font-size: 11px; font-weight: 700; text-transform: uppercase; }
            .value { margin-top: 4px; font-size: 20px; font-weight: 800; color: #0E6C50; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            th { background: #0B4A34; color: #fff; text-align: left; padding: 10px; font-size: 12px; }
            td { border: 1px solid #D8E9DF; padding: 9px; vertical-align: top; font-size: 12px; }
            .right { text-align: right; white-space: nowrap; }
            .section-title { margin-top: 18px; font-size: 16px; font-weight: 800; }
            .bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; align-items: start; }
            .bill-card { break-inside: avoid; border: 1px solid #D8E9DF; border-radius: 10px; padding: 10px; }
            .bill-title { font-size: 13px; font-weight: 800; color: #0B4A34; }
            .bill-meta { display: flex; justify-content: space-between; gap: 8px; margin-top: 5px; color: #60786F; font-size: 11px; font-weight: 700; }
            .bill-table { margin-top: 9px; }
            .bill-table th { padding: 8px; font-size: 11px; }
            .bill-table td { padding: 7px; font-size: 11px; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(t('dealer_statement_title'))}</h1>
          <div class="subtitle">${escapeHtml(selectedMonthLabel)} ${selectedYear}</div>
          <div class="summary">
            <div class="box"><div class="label">${escapeHtml(t('dealer_statement_bill_total'))}</div><div class="value">${escapeHtml(asCurrency(monthBillTotal))}</div></div>
            <div class="box"><div class="label">${escapeHtml(t('dealer_statement_payment_received'))}</div><div class="value">${escapeHtml(asCurrency(monthPaymentTotal))}</div></div>
          </div>
          <div class="section-title">${escapeHtml(t('dealer_statement_bill_details'))}</div>
          <div class="bill-grid">
            ${detailTables || '<div class="bill-card">-</div>'}
          </div>
          <div class="section-title">${escapeHtml(t('dealer_statement_date_summary'))}</div>
          <table>
            <thead>
              <tr><th>${escapeHtml(t('dealer_statement_date'))}</th><th>${escapeHtml(t('dealer_statement_bill_total'))}</th><th>${escapeHtml(t('dealer_statement_payment'))}</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="3">-</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `;
  };

  const downloadPdf = async () => {
    try {
      setDownloading(true);
      const { uri } = await Print.printToFileAsync({
        html: buildStatementHtml(),
        base64: false,
      });
      const namedUri = `${FileSystem.cacheDirectory ?? uri.slice(0, uri.lastIndexOf('/') + 1)}${statementFileName}`;
      await FileSystem.deleteAsync(namedUri, { idempotent: true });
      await FileSystem.copyAsync({ from: uri, to: namedUri });
      setDownloading(false);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(namedUri, {
          mimeType: 'application/pdf',
          dialogTitle: t('dealer_statement_pdf_dialog'),
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(t('dealer_statement_pdf_title'), `PDF created at ${namedUri}`);
      }
    } catch (error) {
      setDownloading(false);
      Alert.alert(t('dealer_statement_pdf_title'), error instanceof Error ? error.message : t('dealer_statement_pdf_error'));
    }
  };

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#123D33" />
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadStatement('refresh')} tintColor="#0E6C50" />
        }>
        <View style={styles.filterRow}>
          <Pressable onPress={() => setMonthPickerVisible(true)} style={styles.filterSelect}>
            <Text style={styles.filterLabel}>{t('dealer_statement_month')}</Text>
            <Text style={styles.filterValue}>{selectedMonthLabel}</Text>
          </Pressable>
          <Pressable onPress={() => setYearPickerVisible(true)} style={styles.filterSelect}>
            <Text style={styles.filterLabel}>{t('dealer_statement_year')}</Text>
            <Text style={styles.filterValue}>{selectedYear}</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('dealer_statement_bill_total')}</Text>
            <Text style={styles.summaryValue}>{asCurrency(monthBillTotal)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('dealer_statement_payment')}</Text>
            <Text style={styles.summaryValue}>{asCurrency(monthPaymentTotal)}</Text>
          </View>
        </View>

        <Pressable disabled={loading || downloading} onPress={downloadPdf} style={styles.downloadButton}>
          {downloading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.downloadText}>{t('dealer_statement_download_pdf')}</Text>
            </>
          )}
        </Pressable>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0E6C50" />
          </View>
        ) : (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{t('dealer_statement_preview')}</Text>
            {activeStatementRows.map((row) => (
                <View key={row.date} style={styles.previewRow}>
                  <Text style={styles.previewDate}>{row.date}</Text>
                  <View style={styles.previewAmounts}>
                    <Text style={styles.previewText}>{t('dealer_statement_bill')}: {row.billTotal > 0 ? asCurrency(row.billTotal) : '-'}</Text>
                    <Text style={styles.previewText}>{t('dealer_statement_payment')}: {row.paymentTotal > 0 ? asCurrency(row.paymentTotal) : '-'}</Text>
                  </View>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      <Modal transparent visible={monthPickerVisible} onRequestClose={() => setMonthPickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setMonthPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>{t('dealer_statement_month')}</Text>
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
            <Text style={styles.pickerTitle}>{t('dealer_statement_year')}</Text>
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
  backButton: { width: 44, height: 44, marginHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 8, paddingBottom: 120 },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  filterSelect: { flex: 1, minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: '#D8E9DF', backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center' },
  filterLabel: { fontSize: 11, fontWeight: '800', color: '#60786F', textTransform: 'uppercase' },
  filterValue: { marginTop: 3, fontSize: 16, fontWeight: '800', color: '#123D33' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, minHeight: 92, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E9DF', padding: 14, justifyContent: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: '#60786F', textTransform: 'uppercase' },
  summaryValue: { marginTop: 6, fontSize: 20, fontWeight: '800', color: '#0E6C50' },
  downloadButton: { marginTop: 14, minHeight: 52, borderRadius: 16, backgroundColor: '#0B4A34', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  downloadText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  previewCard: { marginTop: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E9DF', padding: 14 },
  previewTitle: { fontSize: 17, fontWeight: '800', color: '#123D33', marginBottom: 6 },
  previewRow: { minHeight: 54, borderTopWidth: 1, borderTopColor: '#ECF3EF', paddingVertical: 10, flexDirection: 'row', gap: 10 },
  previewDate: { width: 92, fontSize: 13, fontWeight: '800', color: '#123D33' },
  previewAmounts: { flex: 1, gap: 3 },
  previewText: { fontSize: 13, fontWeight: '700', color: '#60786F' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(10, 44, 34, 0.4)', justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 },
  pickerCard: { backgroundColor: '#FFFFFF', borderRadius: 24, maxHeight: '62%', padding: 18 },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: '#123D33', marginBottom: 12 },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#DCEBE3' },
  pickerItemTitle: { fontSize: 16, fontWeight: '700', color: '#123D33' },
});
