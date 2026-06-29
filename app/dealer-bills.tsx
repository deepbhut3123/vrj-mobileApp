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
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  type AppDealer,
  type DealerBill,
  type DealerProduct,
  createAdminDealerBill,
  getCurrentUser,
  getAllDealerBills,
  getAllDealerProducts,
  getAllDealers,
} from '@/services/api';

const asCurrency = (value: number) => `Rs. ${Math.round(value).toFixed(0)}`;
const todayValue = () => new Date().toISOString().slice(0, 10);

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
  const insets = useSafeAreaInsets();
  const user = getCurrentUser();
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
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [billDate, setBillDate] = useState(todayValue());
  const [kattaCount, setKattaCount] = useState('0');
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
      Alert.alert('Unable to load dealer bill form', dealersResult.message || productsResult.message);
      return false;
    }

    setDealers(extractList<AppDealer>(dealersResult.data));
    setProducts(sortDealerProductsBySequence(extractList<DealerProduct>(productsResult.data)));
    return true;
  }, []);

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
    const ready = await loadCatalogData();
    if (!ready) return;
    setSelectedDealerId('');
    setBillDate(todayValue());
    setKattaCount('0');
    setQuantities({});
    setModalVisible(true);
  };

  const closeCreateModal = () => {
    setModalVisible(false);
    setDealerPickerVisible(false);
  };

  const onQuantityChange = (productId: string, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setQuantities((prev) => ({ ...prev, [productId]: cleaned }));
  };

  const onSaveBill = async () => {
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

    if (!selectedDealerId || !billDate.trim() || items.length === 0) {
      Alert.alert('Validation', 'Select dealer, date, and at least one product quantity.');
      return;
    }

    setSaving(true);
    const result = await createAdminDealerBill({
      dealerId: selectedDealerId,
      billDate: billDate.trim(),
      kattaCount: Number(kattaCount || 0),
      items,
    });
    setSaving(false);

    if (!result.ok) {
      Alert.alert('Unable to create dealer bill', result.message);
      return;
    }

    closeCreateModal();
    await loadBills();
    Alert.alert('Dealer Bill', result.message);
  };

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadBills('refresh')} tintColor="#7A1F1F" />
        }>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Dealer Bills</Text>
            <Text style={styles.subtitle}>Review dealer bills, katta count, and item totals.</Text>
          </View>
          <Pressable disabled={catalogLoading} onPress={openCreateModal} style={styles.addButton}>
            <Text style={styles.addButtonText}>{catalogLoading ? '...' : 'Add Bill'}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#9B2C2C" />
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No dealer bills found.</Text>
          </View>
        ) : (
          bills.map((bill) => (
            <Pressable
              key={bill._id}
              style={({ pressed }) => [styles.billCard, pressed ? styles.billCardPressed : null]}
              onPress={() => setDetailBill(bill)}>
              <View style={styles.billTopRow}>
                <View style={styles.billHeaderMain}>
                  <Text style={styles.billShop}>{bill.dealerId?.dealerName || 'Unknown dealer'}</Text>
                  <Text style={styles.billRoute}>{bill.dealerId?.city || 'Unknown city'}</Text>
                </View>
                <View style={styles.kattaPill}>
                  <Text style={styles.kattaPillText}>Katta {bill.kattaCount ?? 0}</Text>
                </View>
              </View>
              <Text style={styles.createdBy}>Created by {bill.userId?.name || bill.userId?.email || 'Unknown user'}</Text>
              <View style={styles.billSummaryRow}>
                <View style={styles.billInfoChip}>
                  <Text style={styles.billInfoLabel}>Items</Text>
                  <Text style={styles.billInfoValue}>{bill.items?.length ?? 0}</Text>
                </View>
                {!shouldHideAmounts ? (
                  <View style={[styles.billInfoChip, styles.billTotalChip]}>
                    <Text style={styles.billInfoLabel}>Total</Text>
                    <Text style={[styles.billInfoValue, styles.billTotalValue]}>{asCurrency(bill.totalAmount)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.billDate}>{bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '-'}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeCreateModal}>
        <View style={[styles.modalBackdrop, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Dealer Bill</Text>
              <Pressable onPress={closeCreateModal}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Dealer</Text>
              <Pressable onPress={() => setDealerPickerVisible(true)} style={styles.selectorInput}>
                <Text style={selectedDealer ? styles.selectorValue : styles.selectorPlaceholder}>
                  {selectedDealer ? selectedDealer.dealerName : 'Select dealer'}
                </Text>
              </Pressable>

              <Text style={[styles.fieldLabel, styles.nextField]}>Bill Date</Text>
              <TextInput
                value={billDate}
                onChangeText={setBillDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9B7D7D"
                style={styles.textInput}
              />

              <Text style={[styles.fieldLabel, styles.nextField]}>Katta Count</Text>
              <TextInput
                keyboardType="number-pad"
                value={kattaCount}
                onChangeText={(value) => setKattaCount(value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                placeholderTextColor="#9B7D7D"
                style={styles.textInput}
              />

              <Text style={[styles.fieldLabel, styles.nextField]}>Products</Text>
              <View style={styles.productsList}>
                {products.map((product) => (
                  <View key={product._id} style={styles.productCard}>
                    <Text style={styles.productTitleLine}>
                      <Text style={styles.productMrpInline}>{Math.round(product.mrp)} </Text>
                      <Text style={styles.productName}>{product.productName}</Text>
                    </Text>
                    {!shouldHideAmounts ? (
                      <View style={styles.productMetaRow}>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaLabel}>Rate</Text>
                          <Text style={styles.metaValue}>{asCurrency(product.productRate)}</Text>
                        </View>
                        <View style={[styles.metaPill, styles.totalPill]}>
                          <Text style={styles.metaLabel}>Total</Text>
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
                      placeholderTextColor="#9B7D7D"
                      style={styles.quantityInput}
                      value={quantities[product._id] ?? ''}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.stickyFooter}>
              {!shouldHideAmounts ? (
                <View>
                  <Text style={styles.totalLabel}>Bill Total</Text>
                  <Text style={styles.totalValue}>{asCurrency(computedTotal)}</Text>
                </View>
              ) : <View />}
              <Pressable disabled={saving} onPress={onSaveBill} style={styles.createButton}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.createButtonText}>Create Bill</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={dealerPickerVisible} onRequestClose={() => setDealerPickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setDealerPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Choose Dealer</Text>
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
        <Pressable
          style={[styles.detailBackdrop, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={() => setDetailBill(null)}>
          <Pressable style={styles.detailCard} onPress={() => {}}>
            {detailBill ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailHeaderCopy}>
                    <Text style={styles.detailTitle}>{detailBill.dealerId?.dealerName || 'Unknown dealer'}</Text>
                    <Text style={styles.detailSubtitle}>{detailBill.dealerId?.city || 'Unknown city'}</Text>
                    <Text style={styles.detailCreatedBy}>Created by {detailBill.userId?.name || detailBill.userId?.email || 'Unknown user'}</Text>
                  </View>
                  <Pressable onPress={() => setDetailBill(null)} style={styles.detailCloseButton}>
                    <Ionicons name="close" size={18} color="#5B2121" />
                  </Pressable>
                </View>

                <View style={styles.detailMetaRow}>
                  <View style={styles.detailMetaChip}>
                    <Text style={styles.detailMetaLabel}>Katta</Text>
                    <Text style={styles.detailMetaValue}>{detailBill.kattaCount ?? 0}</Text>
                  </View>
                  {!shouldHideAmounts ? (
                    <View style={styles.detailMetaChip}>
                      <Text style={styles.detailMetaLabel}>Total</Text>
                      <Text style={[styles.detailMetaValue, styles.detailMetaValueTotal]}>{asCurrency(detailBill.totalAmount)}</Text>
                    </View>
                  ) : null}
                </View>

                <ScrollView style={styles.detailList} showsVerticalScrollIndicator={false}>
                  {orderedItems.map((item, index) => (
                    <View key={`${item.productName || 'item'}-${index}`} style={styles.detailItemCard}>
                      <Text style={styles.detailItemName}>{item.productName || 'Custom item'}</Text>
                      <View style={styles.detailItemRow}>
                        <View style={styles.detailItemStat}>
                          <Text style={styles.detailItemLabel}>Qty</Text>
                          <Text style={styles.detailItemValue}>{item.quantity ?? 0}</Text>
                        </View>
                        {!shouldHideAmounts ? (
                          <>
                            <View style={styles.detailItemStat}>
                              <Text style={styles.detailItemLabel}>MRP</Text>
                              <Text style={styles.detailItemValue}>{asCurrency(Number(item.mrp || 0))}</Text>
                            </View>
                            <View style={styles.detailItemStat}>
                              <Text style={styles.detailItemLabel}>Amount</Text>
                              <Text style={styles.detailItemValue}>{asCurrency(Number(item.amount || 0))}</Text>
                            </View>
                            <View style={styles.detailItemStat}>
                              <Text style={styles.detailItemLabel}>Total</Text>
                              <Text style={[styles.detailItemValue, styles.detailItemTotal]}>{asCurrency(Number(item.total || 0))}</Text>
                            </View>
                          </>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FBF3F1' },
  content: { padding: 20, paddingBottom: 120 },
  headerRow: { marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', color: '#5A1717' },
  subtitle: { marginTop: 6, fontSize: 15, lineHeight: 22, color: '#7B5252' },
  addButton: { backgroundColor: '#9B2C2C', borderRadius: 16, paddingHorizontal: 16, height: 48, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { marginTop: 18, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#F0D8D2' },
  emptyText: { color: '#7B6560', fontSize: 15 },
  billCard: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#F1DAD4' },
  billCardPressed: { opacity: 0.96 },
  billTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  billHeaderMain: { flex: 1, gap: 4 },
  billShop: { fontSize: 16, fontWeight: '800', color: '#5A1717' },
  billRoute: { color: '#7A5850', fontSize: 13 },
  createdBy: { marginTop: 10, color: '#7A5850', fontSize: 13 },
  kattaPill: { backgroundColor: '#FDECEC', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  kattaPillText: { color: '#A03232', fontSize: 11, fontWeight: '800' },
  billSummaryRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  billInfoChip: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#F2E3DF', backgroundColor: '#FFF8F6', paddingHorizontal: 12, paddingVertical: 9 },
  billTotalChip: { backgroundColor: '#FDECEC', borderColor: '#F0CFCA' },
  billInfoLabel: { fontSize: 11, fontWeight: '700', color: '#8B6B63', textTransform: 'uppercase' },
  billInfoValue: { marginTop: 4, color: '#4B2320', fontSize: 15, fontWeight: '800' },
  billTotalValue: { color: '#A03232' },
  billDate: { marginTop: 10, color: '#8B6B63', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(39, 15, 15, 0.48)', justifyContent: 'flex-end' },
  modalCard: { width: '100%', height: '90%', backgroundColor: '#FFF9F8', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#5A1717' },
  closeText: { color: '#8B2D2D', fontSize: 15, fontWeight: '700' },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingTop: 2, flexGrow: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#6B3A33', marginTop: 12, marginBottom: 8 },
  nextField: { marginTop: 18 },
  selectorInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6CFC8', borderRadius: 16, minHeight: 54, justifyContent: 'center', paddingHorizontal: 14 },
  selectorValue: { color: '#4B2320', fontSize: 15, fontWeight: '600' },
  selectorPlaceholder: { color: '#9B7D7D', fontSize: 15 },
  textInput: { height: 52, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E6CFC8', paddingHorizontal: 14, color: '#4B2320', fontSize: 16, fontWeight: '600' },
  productsList: { gap: 12 },
  productCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#F1DAD4', padding: 14 },
  productTitleLine: { fontSize: 17, fontWeight: '800', color: '#5A1717' },
  productMrpInline: { fontSize: 17, fontWeight: '800', color: '#A03232' },
  productName: { fontSize: 17, fontWeight: '800', color: '#5A1717' },
  productMetaRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  metaPill: { flex: 1, minHeight: 88, borderRadius: 16, backgroundColor: '#FFF6F4', borderWidth: 1, borderColor: '#F2E3DF', paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  totalPill: { backgroundColor: '#FDECEC', borderColor: '#F0CFCA' },
  metaLabel: { fontSize: 11, fontWeight: '700', color: '#8B6B63', textTransform: 'uppercase' },
  metaValue: { marginTop: 6, fontSize: 16, fontWeight: '800', color: '#4B2320' },
  totalPillValue: { color: '#A03232' },
  quantityInput: { height: 50, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E6CFC8', paddingHorizontal: 14, color: '#4B2320', fontSize: 16, fontWeight: '700' },
  stickyFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F0DBD6', paddingTop: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: '#FFF9F8' },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#8B6B63' },
  totalValue: { marginTop: 4, fontSize: 24, fontWeight: '800', color: '#A03232' },
  createButton: { minWidth: 148, height: 52, borderRadius: 16, backgroundColor: '#9B2C2C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  createButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(39, 15, 15, 0.4)', justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 },
  pickerCard: { backgroundColor: '#FFFFFF', borderRadius: 24, maxHeight: '62%', padding: 18 },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: '#5A1717', marginBottom: 12 },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2E3DF' },
  pickerItemTitle: { fontSize: 16, fontWeight: '700', color: '#4B2320' },
  pickerItemSubtitle: { marginTop: 4, fontSize: 13, color: '#8B6B63' },
  detailBackdrop: { flex: 1, backgroundColor: 'rgba(39, 15, 15, 0.5)', justifyContent: 'center', paddingHorizontal: 18 },
  detailCard: { width: '100%', maxHeight: '84%', backgroundColor: '#FFF9F8', borderRadius: 24, borderWidth: 1, borderColor: '#F0DBD6', padding: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  detailHeaderCopy: { flex: 1 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: '#5A1717' },
  detailSubtitle: { marginTop: 4, fontSize: 13, color: '#7A5850' },
  detailCreatedBy: { marginTop: 6, fontSize: 13, color: '#7A5850' },
  detailCloseButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FBEDEC', alignItems: 'center', justifyContent: 'center' },
  detailMetaRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  detailMetaChip: { flex: 1, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0DBD6', paddingHorizontal: 12, paddingVertical: 10 },
  detailMetaLabel: { fontSize: 11, fontWeight: '700', color: '#8B6B63', textTransform: 'uppercase' },
  detailMetaValue: { marginTop: 4, fontSize: 16, fontWeight: '800', color: '#4B2320' },
  detailMetaValueTotal: { color: '#A03232' },
  detailList: { marginTop: 16 },
  detailItemCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F2E3DF', padding: 14, marginBottom: 10 },
  detailItemName: { fontSize: 16, fontWeight: '800', color: '#5A1717' },
  detailItemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  detailItemStat: { flexGrow: 1, minWidth: '22%', borderRadius: 14, backgroundColor: '#FFF6F4', borderWidth: 1, borderColor: '#F2E3DF', paddingHorizontal: 10, paddingVertical: 9 },
  detailItemLabel: { fontSize: 11, fontWeight: '700', color: '#8B6B63', textTransform: 'uppercase' },
  detailItemValue: { marginTop: 4, fontSize: 14, fontWeight: '800', color: '#4B2320' },
  detailItemTotal: { color: '#A03232' },
});
