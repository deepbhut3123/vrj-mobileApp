import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useI18n } from '@/constants/i18n';
import {
  type AppDealer,
  type DealerBill,
  type DealerBillItem,
  type DealerProduct,
  createAdminDealerBill,
  getCurrentUser,
  getAllDealerBills,
  getAllDealerProducts,
  getAllDealers,
  updateAdminDealerBill,
} from '@/services/api';

const asCurrency = (value: number) => `Rs. ${Math.round(value).toFixed(0)}`;
const todayValue = () => new Date().toISOString().slice(0, 10);
const dateFromValue = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};
const formatDateForDisplay = (value: string) => dateFromValue(value).toLocaleDateString();
const formatDateForApi = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDealerBillStatus = (bill?: DealerBill | null) =>
  String(bill?.status || 'ordered').toLowerCase();

const getDealerBillProductId = (item: DealerBillItem) => {
  const product = item.productId;
  if (!product) return '';
  if (typeof product === 'string') return product;
  if (typeof product === 'object' && '_id' in product) return String(product._id || '');
  return '';
};

const extractList = <T,>(payload: unknown): T[] => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const list = (payload as { data?: unknown }).data;
    return Array.isArray(list) ? (list as T[]) : [];
  }
  return [];
};

const sortDealerProductsBySequence = (list: DealerProduct[]) =>
  [...list].sort((left, right) => {
    const leftSequence = Number(left.sequence);
    const rightSequence = Number(right.sequence);
    const normalizedLeftSequence = Number.isFinite(leftSequence) ? leftSequence : Number.MAX_SAFE_INTEGER;
    const normalizedRightSequence = Number.isFinite(rightSequence) ? rightSequence : Number.MAX_SAFE_INTEGER;
    if (normalizedLeftSequence !== normalizedRightSequence) {
      return normalizedLeftSequence - normalizedRightSequence;
    }
    return left.productName.localeCompare(right.productName);
  });

export default function DealerBillsScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const user = getCurrentUser();
  const isDealerUser = Number(user?.roleId ?? 0) === 3;
  const shouldHideAmounts = user?.roleId === 5;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [bills, setBills] = useState<DealerBill[]>([]);
  const [dealers, setDealers] = useState<AppDealer[]>([]);
  const [products, setProducts] = useState<DealerProduct[]>([]);
  const [detailBill, setDetailBill] = useState<DealerBill | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [dealerPickerVisible, setDealerPickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [editingBillId, setEditingBillId] = useState('');
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [billDate, setBillDate] = useState(todayValue());
  const [kattaCount, setKattaCount] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const loadBills = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const result = await getAllDealerBills();
    if (result.ok) {
      setBills(extractList<DealerBill>(result.data));
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadCatalogData = useCallback(async () => {
    setCatalogLoading(true);
    const [dealersResult, productsResult] = await Promise.all([
      getAllDealers(),
      getAllDealerProducts(),
    ]);
    setCatalogLoading(false);

    if (!dealersResult.ok || !productsResult.ok) {
      Alert.alert(t('dealer_bills_load_error'), dealersResult.message || productsResult.message);
      return false;
    }

    const dealerRows = extractList<AppDealer>(dealersResult.data);
    const productRows = sortDealerProductsBySequence(extractList<DealerProduct>(productsResult.data));
    setDealers(dealerRows);
    setProducts(productRows);
    return { dealerRows, productRows };
  }, [t]);

  useEffect(() => {
    void loadBills();
  }, [loadBills]);

  useFocusEffect(
    useCallback(() => {
      void loadBills('refresh');
    }, [loadBills]),
  );

  const orderedItems = useMemo(() => {
    if (!detailBill?.items) {
      return [];
    }
    return [...detailBill.items].sort((left, right) =>
      String(left.productName || '').localeCompare(String(right.productName || '')),
    );
  }, [detailBill?.items]);

  const selectedDealer = useMemo(
    () => dealers.find((item) => item._id === selectedDealerId) ?? null,
    [dealers, selectedDealerId],
  );

  const computedTotal = useMemo(() => {
    return products.reduce((sum, product) => {
      const quantity = Number(quantities[product._id] || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return sum;
      return sum + product.productRate * quantity;
    }, 0);
  }, [products, quantities]);

  const openCreateModal = async () => {
    const catalog = await loadCatalogData();
    if (!catalog) return;
    setEditingBillId('');
    setSelectedDealerId(isDealerUser ? catalog.dealerRows[0]?._id ?? '' : '');
    setBillDate(todayValue());
    setKattaCount('');
    setQuantities({});
    setModalVisible(true);
  };

  const openEditModal = async (bill: DealerBill) => {
    if (getDealerBillStatus(bill) !== 'ordered') {
      Alert.alert(t('dealer_bills_alert_title'), 'Only ordered bills can be edited.');
      return;
    }

    const catalog = await loadCatalogData();
    if (!catalog) return;
    const quantityByProductId = new Map(
      (bill.items || [])
        .map((item) => [getDealerBillProductId(item), item.quantity])
        .filter(([productId]) => Boolean(productId)),
    );

    setDetailBill(null);
    setEditingBillId(bill._id);
    setSelectedDealerId(bill.dealerId?._id || '');
    setBillDate(formatDateForApi(dateFromValue(String(bill.billDate || todayValue()).slice(0, 10))));
    setKattaCount(String(bill.kattaCount ?? ''));
    setQuantities(
      catalog.productRows.reduce<Record<string, string>>((acc, product) => {
        const quantity = quantityByProductId.get(product._id);
        if (quantity) {
          acc[product._id] = String(quantity);
        }
        return acc;
      }, {}),
    );
    setModalVisible(true);
  };

  const closeCreateModal = () => {
    setModalVisible(false);
    setDealerPickerVisible(false);
    setDatePickerVisible(false);
    setEditingBillId('');
  };

  const onDatePicked = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setDatePickerVisible(false);
    }

    if (selectedDate) {
      setBillDate(formatDateForApi(selectedDate));
    }
  };

  const onQuantityChange = (productId: string, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setQuantities((prev) => ({ ...prev, [productId]: cleaned }));
  };

  const onSaveBill = async () => {
    const parsedKattaCount = Number(kattaCount || 0);
    const items = products
      .map((product) => ({
        productId: product._id,
        productName: product.productName,
        mrp: product.mrp,
        productRate: product.productRate,
        amount: product.productRate,
        quantity: Number(quantities[product._id] || 0),
      }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    if (!selectedDealerId) {
      Alert.alert(t('common_validation'), t('dealer_bills_validation_dealer'));
      return;
    }

    if (!billDate.trim()) {
      Alert.alert(t('common_validation'), t('dealer_bills_validation_date'));
      return;
    }

    if (!isDealerUser && (!Number.isFinite(parsedKattaCount) || parsedKattaCount <= 0)) {
      Alert.alert(t('common_validation'), t('dealer_bills_validation_katta'));
      return;
    }

    if (items.length === 0) {
      Alert.alert(t('common_validation'), t('dealer_bills_validation_products'));
      return;
    }

    setSaving(true);
    const payload = {
      dealerId: selectedDealerId,
      billDate: billDate.trim(),
      kattaCount: isDealerUser ? 0 : parsedKattaCount,
      items,
    };
    const result = editingBillId
      ? await updateAdminDealerBill(editingBillId, payload)
      : await createAdminDealerBill(payload);
    setSaving(false);

    if (!result.ok) {
      Alert.alert(t('dealer_bills_create_error'), result.message);
      return;
    }

    closeCreateModal();
    await loadBills();
    Alert.alert(t('dealer_bills_alert_title'), result.message);
  };

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadBills('refresh')} tintColor="#0E6C50" />
        }>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{t('dealer_bills_title')}</Text>
            <Text style={styles.subtitle}>{t('dealer_bills_subtitle')}</Text>
          </View>
          <Pressable disabled={catalogLoading} onPress={openCreateModal} style={styles.addButton}>
            <Text style={styles.addButtonText}>{catalogLoading ? '...' : t('dealer_bills_add')}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0E6C50" />
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('dealer_bills_empty')}</Text>
          </View>
        ) : (
          bills.map((bill) => (
            <Pressable
              key={bill._id}
              style={({ pressed }) => [styles.billCard, pressed ? styles.billCardPressed : null]}
              onPress={() => setDetailBill(bill)}>
              <View style={styles.billTopRow}>
                <View style={styles.billHeaderMain}>
                  <Text style={styles.billShop}>{bill.dealerId?.dealerName || t('dealer_bills_unknown_dealer')}</Text>
                  <Text style={styles.billRoute}>{bill.dealerId?.city || t('dealer_bills_unknown_city')}</Text>
                </View>
                <View style={styles.billTopSide}>
                  {!isDealerUser ? (
                    <View style={styles.kattaPill}>
                      <Text style={styles.kattaPillText}>{t('dealer_bills_katta')} {bill.kattaCount ?? 0}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.statusPill, getDealerBillStatus(bill) === 'ordered' ? styles.statusPillOrdered : styles.statusPillShipped]}>
                    <Text style={[styles.statusPillText, getDealerBillStatus(bill) === 'ordered' ? styles.statusPillTextOrdered : styles.statusPillTextShipped]}>
                      {getDealerBillStatus(bill)}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.createdBy}>
                {t('dealer_bills_created_by', {
                  name: bill.userId?.name || bill.userId?.email || t('dealer_bills_unknown_user'),
                })}
              </Text>
              <View style={styles.billSummaryRow}>
                <View style={styles.billInfoChip}>
                  <Text style={styles.billInfoLabel}>{t('bills_items')}</Text>
                  <Text style={styles.billInfoValue}>{bill.items?.length ?? 0}</Text>
                </View>
                {!shouldHideAmounts ? (
                  <View style={[styles.billInfoChip, styles.billTotalChip]}>
                    <Text style={styles.billInfoLabel}>{t('dealer_bills_total')}</Text>
                    <Text style={[styles.billInfoValue, styles.billTotalValue]}>{asCurrency(bill.totalAmount)}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.billFooterRow}>
                <Text style={styles.billDate}>{bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '-'}</Text>
                {getDealerBillStatus(bill) === 'ordered' ? (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      void openEditModal(bill);
                    }}
                    style={styles.editButton}>
                    <Ionicons name="pencil" size={16} color="#0E6C50" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeCreateModal}>
        <View style={[styles.modalBackdrop, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingBillId ? 'Edit Dealer Bill' : t('dealer_bills_new_title')}</Text>
              <Pressable onPress={closeCreateModal}>
                <Text style={styles.closeText}>{t('dealer_bills_close')}</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{t('dealer_bills_field_dealer')}</Text>
              <Pressable
                disabled={isDealerUser}
                onPress={() => setDealerPickerVisible(true)}
                style={[styles.selectorInput, isDealerUser ? styles.selectorInputLocked : null]}>
                <Text style={selectedDealer ? styles.selectorValue : styles.selectorPlaceholder}>
                  {selectedDealer ? selectedDealer.dealerName : t('dealer_bills_select_dealer')}
                </Text>
              </Pressable>

              <Text style={[styles.fieldLabel, styles.nextField]}>{t('dealer_bills_field_date')}</Text>
              <Pressable onPress={() => setDatePickerVisible(true)} style={styles.dateSelector}>
                <Text style={styles.selectorValue}>{formatDateForDisplay(billDate)}</Text>
                <Ionicons name="calendar-outline" size={20} color="#0E6C50" />
              </Pressable>
              {datePickerVisible ? (
                <DateTimePicker
                  value={dateFromValue(billDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDatePicked}
                />
              ) : null}

              <Text style={[styles.fieldLabel, styles.nextField]}>{t('dealer_bills_field_products')}</Text>
              <View style={styles.productsList}>
                {products.map((product) => (
                  <View key={product._id} style={styles.productCard}>
                    <View style={styles.productTitleRow}>
                      <Text style={styles.productMrpInline}>{Math.round(product.mrp)}</Text>
                      <Text style={styles.productName}>{product.productName}</Text>
                    </View>
                    {!shouldHideAmounts ? (
                      <View style={styles.productMetaRow}>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaLabel}>{t('dealer_bills_rate')}</Text>
                          <Text style={styles.metaValue}>{asCurrency(product.productRate)}</Text>
                        </View>
                        <View style={[styles.metaPill, styles.totalPill]}>
                          <Text style={styles.metaLabel}>{t('dealer_bills_total')}</Text>
                          <Text style={[styles.metaValue, styles.totalPillValue]}>
                            {asCurrency(product.productRate * Number(quantities[product._id] || 0))}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={(value) => onQuantityChange(product._id, value)}
                      placeholder="Quantity"
                      placeholderTextColor="#7A9188"
                      style={styles.quantityInput}
                      value={quantities[product._id] ?? ''}
                    />
                  </View>
                ))}
              </View>

              {!isDealerUser ? (
                <>
                  <Text style={[styles.fieldLabel, styles.nextField]}>{t('dealer_bills_field_katta')}</Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={kattaCount}
                    onChangeText={(value) => setKattaCount(value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    placeholderTextColor="#7A9188"
                    style={styles.textInput}
                  />
                </>
              ) : null}
            </ScrollView>

            <View style={styles.stickyFooter}>
              {!shouldHideAmounts ? (
                <View>
                  <Text style={styles.totalLabel}>{t('dealer_bills_bill_total')}</Text>
                  <Text style={styles.totalValue}>{asCurrency(computedTotal)}</Text>
                </View>
              ) : <View />}
              <Pressable disabled={saving} onPress={onSaveBill} style={styles.createButton}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.createButtonText}>{editingBillId ? 'Update Bill' : t('dealer_bills_create')}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={dealerPickerVisible} onRequestClose={() => setDealerPickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setDealerPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>{t('dealer_bills_choose_dealer')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {dealers.map((dealer) => (
                <Pressable
                  key={dealer._id}
                  onPress={() => {
                    setSelectedDealerId(dealer._id);
                    setDealerPickerVisible(false);
                  }}
                  style={styles.pickerItem}>
                  <Text style={styles.pickerItemTitle}>{dealer.dealerName}</Text>
                  <Text style={styles.pickerItemSubtitle}>{[dealer.city, dealer.contactNo].filter(Boolean).join(' | ')}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(detailBill)} onRequestClose={() => setDetailBill(null)}>
        <View style={[styles.detailBackdrop, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetailBill(null)} />
          <View style={styles.detailCard}>
            {detailBill ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailHeaderCopy}>
                    <Text style={styles.detailTitle}>{detailBill.dealerId?.dealerName || t('dealer_bills_unknown_dealer')}</Text>
                    <Text style={styles.detailSubtitle}>{detailBill.dealerId?.city || t('dealer_bills_unknown_city')}</Text>
                    <Text style={styles.detailCreatedBy}>
                      {t('dealer_bills_created_by', {
                        name: detailBill.userId?.name || detailBill.userId?.email || t('dealer_bills_unknown_user'),
                      })}
                    </Text>
                  </View>
                  <Pressable onPress={() => setDetailBill(null)} style={styles.detailCloseButton}>
                    <Ionicons name="close" size={18} color="#164438" />
                  </Pressable>
                </View>

                <View style={styles.detailMetaRow}>
                  {!isDealerUser ? (
                    <View style={styles.detailMetaChip}>
                      <Text style={styles.detailMetaLabel}>{t('dealer_bills_katta')}</Text>
                      <Text style={styles.detailMetaValue}>{detailBill.kattaCount ?? 0}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailMetaChip}>
                    <Text style={styles.detailMetaLabel}>Status</Text>
                    <Text style={styles.detailMetaValue}>{getDealerBillStatus(detailBill)}</Text>
                  </View>
                  {!shouldHideAmounts ? (
                    <View style={styles.detailMetaChip}>
                      <Text style={styles.detailMetaLabel}>{t('dealer_bills_total')}</Text>
                      <Text style={[styles.detailMetaValue, styles.detailMetaValueTotal]}>{asCurrency(detailBill.totalAmount)}</Text>
                    </View>
                  ) : null}
                </View>

                <ScrollView
                  style={styles.detailList}
                  contentContainerStyle={styles.detailListContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled">
                  {orderedItems.map((item, index) => (
                    <View key={`${item.productName || 'item'}-${index}`} style={styles.detailItemCard}>
                      <View style={styles.detailItemHeader}>
                        {!shouldHideAmounts && Number(item.mrp || 0) > 0 ? (
                          <Text style={styles.detailItemMrpInline}>{Math.round(Number(item.mrp || 0))}</Text>
                        ) : null}
                        <Text style={styles.detailItemName}>{item.productName || 'Custom item'}</Text>
                      </View>
                      <View style={styles.detailItemRow}>
                        <View style={styles.detailItemStat}>
                          <Text style={styles.detailItemLabel}>{t('dealer_bills_detail_qty')}</Text>
                          <Text style={styles.detailItemValue}>{item.quantity ?? 0}</Text>
                        </View>
                        {!shouldHideAmounts ? (
                          <>
                            <View style={styles.detailItemStat}>
                              <Text style={styles.detailItemLabel}>{t('dealer_bills_detail_amount')}</Text>
                              <Text style={styles.detailItemValue}>{asCurrency(Number(item.amount || 0))}</Text>
                            </View>
                            <View style={styles.detailItemStat}>
                              <Text style={styles.detailItemLabel}>{t('dealer_bills_total')}</Text>
                              <Text style={[styles.detailItemValue, styles.detailItemTotal]}>{asCurrency(Number(item.total || 0))}</Text>
                            </View>
                          </>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </ScrollView>
                {getDealerBillStatus(detailBill) === 'ordered' ? (
                  <Pressable onPress={() => void openEditModal(detailBill)} style={styles.detailEditButton}>
                    <Ionicons name="pencil" size={17} color="#FFFFFF" />
                    <Text style={styles.detailEditButtonText}>Edit Bill</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F1F8F4' },
  content: { padding: 20, paddingBottom: 120 },
  headerRow: { marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', color: '#123D33' },
  subtitle: { marginTop: 6, fontSize: 15, lineHeight: 22, color: '#5D746C' },
  addButton: { backgroundColor: '#0E6C50', borderRadius: 16, paddingHorizontal: 16, height: 48, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { marginTop: 18, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#D8E9DF' },
  emptyText: { color: '#5D746C', fontSize: 15 },
  billCard: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#D8E9DF' },
  billCardPressed: { opacity: 0.96 },
  billTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  billHeaderMain: { flex: 1, gap: 4 },
  billShop: { fontSize: 16, fontWeight: '800', color: '#123D33' },
  billRoute: { color: '#5D746C', fontSize: 13 },
  createdBy: { marginTop: 10, color: '#5D746C', fontSize: 13 },
  billTopSide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' },
  kattaPill: { backgroundColor: '#E3F3EA', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  kattaPillText: { color: '#0E6C50', fontSize: 11, fontWeight: '800' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  statusPillOrdered: { backgroundColor: '#FFF7E6', borderColor: '#F3D19E' },
  statusPillShipped: { backgroundColor: '#E3F3EA', borderColor: '#CDE4D6' },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  statusPillTextOrdered: { color: '#A35A00' },
  statusPillTextShipped: { color: '#0E6C50' },
  billSummaryRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  billInfoChip: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#DCEBE3', backgroundColor: '#F8FCF9', paddingHorizontal: 12, paddingVertical: 9 },
  billTotalChip: { backgroundColor: '#E3F3EA', borderColor: '#CDE4D6' },
  billInfoLabel: { fontSize: 11, fontWeight: '700', color: '#60786F', textTransform: 'uppercase' },
  billInfoValue: { marginTop: 4, color: '#123D33', fontSize: 15, fontWeight: '800' },
  billTotalValue: { color: '#0E6C50' },
  billDate: { marginTop: 10, color: '#60786F', fontSize: 12 },
  billFooterRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  editButton: { minHeight: 34, borderRadius: 11, backgroundColor: '#E3F3EA', borderWidth: 1, borderColor: '#CDE4D6', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  editButtonText: { color: '#0E6C50', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10, 44, 34, 0.48)', justifyContent: 'flex-end' },
  modalCard: { width: '100%', height: '90%', backgroundColor: '#FAFFFC', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#123D33' },
  closeText: { color: '#0E6C50', fontSize: 15, fontWeight: '700' },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingTop: 2, flexGrow: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#164438', marginTop: 12, marginBottom: 8 },
  nextField: { marginTop: 18 },
  selectorInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE3D8', borderRadius: 16, minHeight: 54, justifyContent: 'center', paddingHorizontal: 14 },
  selectorInputLocked: { backgroundColor: '#F3FAF6', opacity: 0.82 },
  selectorValue: { color: '#123D33', fontSize: 15, fontWeight: '600' },
  selectorPlaceholder: { color: '#7A9188', fontSize: 15 },
  dateSelector: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE3D8', borderRadius: 16, minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  textInput: { height: 52, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#CFE3D8', paddingHorizontal: 14, color: '#123D33', fontSize: 16, fontWeight: '600' },
  productsList: { gap: 12 },
  productCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#D8E9DF', padding: 14 },
  productTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 6 },
  productName: { fontSize: 17, fontWeight: '800', color: '#123D33' },
  productMrpInline: { fontSize: 15, fontWeight: '800', color: '#0E6C50' },
  productMetaRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  metaPill: { flex: 1, minHeight: 88, borderRadius: 16, backgroundColor: '#F3FAF6', borderWidth: 1, borderColor: '#DCEBE3', paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  totalPill: { backgroundColor: '#E3F3EA', borderColor: '#CDE4D6' },
  metaLabel: { fontSize: 11, fontWeight: '700', color: '#60786F', textTransform: 'uppercase' },
  metaValue: { marginTop: 6, fontSize: 16, fontWeight: '800', color: '#123D33' },
  totalPillValue: { color: '#0E6C50' },
  quantityInput: { height: 50, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#CFE3D8', paddingHorizontal: 14, color: '#123D33', fontSize: 16, fontWeight: '700' },
  stickyFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#D8E9DF', paddingTop: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: '#FAFFFC' },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#60786F' },
  totalValue: { marginTop: 4, fontSize: 24, fontWeight: '800', color: '#0E6C50' },
  createButton: { minWidth: 148, height: 52, borderRadius: 16, backgroundColor: '#0E6C50', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  createButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(10, 44, 34, 0.4)', justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 },
  pickerCard: { backgroundColor: '#FFFFFF', borderRadius: 24, maxHeight: '62%', padding: 18 },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: '#123D33', marginBottom: 12 },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#DCEBE3' },
  pickerItemTitle: { fontSize: 16, fontWeight: '700', color: '#123D33' },
  pickerItemSubtitle: { marginTop: 4, fontSize: 13, color: '#60786F' },
  detailBackdrop: { flex: 1, backgroundColor: 'rgba(10, 44, 34, 0.5)', justifyContent: 'center', paddingHorizontal: 18 },
  detailCard: { width: '100%', maxHeight: '84%', backgroundColor: '#FAFFFC', borderRadius: 24, borderWidth: 1, borderColor: '#D8E9DF', padding: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  detailHeaderCopy: { flex: 1 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: '#123D33' },
  detailSubtitle: { marginTop: 4, fontSize: 13, color: '#5D746C' },
  detailCreatedBy: { marginTop: 6, fontSize: 13, color: '#5D746C' },
  detailCloseButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#E6F4EC', alignItems: 'center', justifyContent: 'center' },
  detailMetaRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  detailMetaChip: { flex: 1, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E9DF', paddingHorizontal: 12, paddingVertical: 10 },
  detailMetaLabel: { fontSize: 11, fontWeight: '700', color: '#60786F', textTransform: 'uppercase' },
  detailMetaValue: { marginTop: 4, fontSize: 16, fontWeight: '800', color: '#123D33' },
  detailMetaValueTotal: { color: '#0E6C50' },
  detailList: { marginTop: 16 },
  detailListContent: { paddingBottom: 8 },
  detailItemCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#DCEBE3', padding: 14, marginBottom: 10 },
  detailItemHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 6 },
  detailItemName: { fontSize: 16, fontWeight: '800', color: '#123D33' },
  detailItemMrpInline: { fontSize: 14, fontWeight: '800', color: '#0E6C50' },
  detailItemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  detailItemStat: { flexGrow: 1, minWidth: '22%', borderRadius: 14, backgroundColor: '#F3FAF6', borderWidth: 1, borderColor: '#DCEBE3', paddingHorizontal: 10, paddingVertical: 9 },
  detailItemLabel: { fontSize: 11, fontWeight: '700', color: '#60786F', textTransform: 'uppercase' },
  detailItemValue: { marginTop: 4, fontSize: 14, fontWeight: '800', color: '#123D33' },
  detailItemTotal: { color: '#0E6C50' },
  detailEditButton: { marginTop: 12, height: 48, borderRadius: 14, backgroundColor: '#0E6C50', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  detailEditButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

