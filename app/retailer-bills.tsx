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
  type AppBill,
  type AppBillItem,
  type AppProduct,
  type AppRoute,
  type AppShop,
  createAdminRetailerBill,
  getAllAdminRoutes,
  getAllAdminShops,
  getCurrentUser,
  getAllRetailerBills,
  getAllRetailerProducts,
  markRetailerBillsAsCompleted,
} from '@/services/api';

const asCurrency = (value: number) => `Rs. ${value.toFixed(2)}`;
const asTableAmount = (value: number) => value.toFixed(2);

const getRouteLabel = (route: string | AppRoute | undefined) => {
  if (!route || typeof route === 'string') return 'Unknown route';
  return [route.routeName, route.cityName].filter(Boolean).join(', ');
};

const getShopLabel = (shop: string | AppShop | undefined) => {
  if (!shop || typeof shop === 'string') return 'Unknown shop';
  return shop.shopName;
};

const getCreatedBy = (bill: AppBill) => {
  if (bill.userId && typeof bill.userId === 'object' && 'name' in bill.userId) {
    return String(bill.userId.name || bill.userId.email || 'Unknown user');
  }
  return 'Unknown user';
};

const getBillItemProductId = (item: AppBillItem) => {
  if (typeof item.productId === 'string') return item.productId;
  if (item.productId && typeof item.productId === 'object' && '_id' in item.productId) {
    return String(item.productId._id);
  }
  return '';
};

const getBillItemMrp = (item: AppBillItem) => {
  if (typeof item.mrp === 'number' && Number.isFinite(item.mrp)) return item.mrp;
  if (item.productId && typeof item.productId === 'object' && 'mrp' in item.productId) {
    const mrp = Number(item.productId.mrp);
    return Number.isFinite(mrp) ? mrp : null;
  }
  return null;
};

const extractList = <T,>(payload: unknown): T[] => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const list = (payload as { data?: unknown }).data;
    return Array.isArray(list) ? (list as T[]) : [];
  }
  return [];
};

const sortProductsBySequence = (list: AppProduct[]) =>
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

export default function RetailerBillsScreen() {
  const insets = useSafeAreaInsets();
  const user = getCurrentUser();
  const isDeliveryMan = user?.roleId === 6;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [bills, setBills] = useState<AppBill[]>([]);
  const [routes, setRoutes] = useState<AppRoute[]>([]);
  const [shops, setShops] = useState<AppShop[]>([]);
  const [products, setProducts] = useState<AppProduct[]>([]);
  const [detailBill, setDetailBill] = useState<AppBill | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [routePickerVisible, setRoutePickerVisible] = useState(false);
  const [shopPickerVisible, setShopPickerVisible] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      if (typeof shop.routeId === 'string') return shop.routeId === selectedRouteId;
      if (shop.routeId && typeof shop.routeId === 'object' && '_id' in shop.routeId) {
        return String(shop.routeId._id) === selectedRouteId;
      }
      return false;
    });
  }, [selectedRouteId, shops]);

  const selectedRouteName = useMemo(() => {
    const route = routes.find((item) => item._id === selectedRouteId);
    return route ? `${route.routeName}, ${route.cityName}` : 'Select route';
  }, [routes, selectedRouteId]);

  const selectedShopName = useMemo(() => {
    const shop = filteredShops.find((item) => item._id === selectedShopId);
    return shop ? shop.shopName : 'Select shop';
  }, [filteredShops, selectedShopId]);

  const computedTotal = useMemo(() => {
    return products.reduce((sum, product) => {
      const quantity = Number(quantities[product._id] || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return sum;
      return sum + product.productRate * quantity;
    }, 0);
  }, [products, quantities]);

  const loadBills = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);

    const result = await getAllRetailerBills();
    if (result.ok) setBills(extractList<AppBill>(result.data));

    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadCatalogData = useCallback(async () => {
    setCatalogLoading(true);
    const [routesResult, shopsResult, productsResult] = await Promise.all([
      getAllAdminRoutes(),
      getAllAdminShops(),
      getAllRetailerProducts(),
    ]);
    setCatalogLoading(false);

    if (!routesResult.ok || !shopsResult.ok || !productsResult.ok) {
      Alert.alert('Unable to load bill form', routesResult.message || shopsResult.message || productsResult.message);
      return false;
    }

    setRoutes(extractList<AppRoute>(routesResult.data));
    setShops(extractList<AppShop>(shopsResult.data));
    setProducts(sortProductsBySequence(extractList<AppProduct>(productsResult.data)));
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

  const openCreateModal = async () => {
    const ready = await loadCatalogData();
    if (!ready) return;
    setSelectedRouteId('');
    setSelectedShopId('');
    setQuantities({});
    setModalVisible(true);
  };

  const closeCreateModal = () => {
    setModalVisible(false);
    setRoutePickerVisible(false);
    setShopPickerVisible(false);
  };

  const onQuantityChange = (productId: string, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setQuantities((prev) => ({ ...prev, [productId]: cleaned }));
  };

  const onSaveBill = async () => {
    const items = products
      .map((product) => ({ productId: product._id, quantity: Number(quantities[product._id] || 0) }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    if (!selectedRouteId || !selectedShopId || items.length === 0) {
      Alert.alert('Validation', 'Select route, shop, and at least one product quantity.');
      return;
    }

    setSaving(true);
    const result = await createAdminRetailerBill({ routeId: selectedRouteId, shopId: selectedShopId, items });
    setSaving(false);

    if (!result.ok) {
      Alert.alert('Unable to create bill', result.message);
      return;
    }

    closeCreateModal();
    await loadBills();
    Alert.alert('Retailer Bill', result.message);
  };

  const onMarkDelivered = async (billId: string) => {
    setSaving(true);
    const result = await markRetailerBillsAsCompleted([billId]);
    setSaving(false);

    if (!result.ok) {
      Alert.alert('Unable to update bill', result.message);
      return;
    }

    setDetailBill(null);
    await loadBills();
    Alert.alert('Retailer Bill', result.message);
  };

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadBills('refresh')} tintColor="#0F5D33" />}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Retailer Bills</Text>
            <Text style={styles.subtitle}>Track all retailer bills created across the team.</Text>
          </View>
          {!isDeliveryMan ? (
            <Pressable disabled={catalogLoading} onPress={openCreateModal} style={styles.addButton}>
              <Text style={styles.addButtonText}>{catalogLoading ? '...' : 'Add Bill'}</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0F5D33" />
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No retailer bills found.</Text>
          </View>
        ) : (
          bills.map((bill) => (
            <Pressable key={bill._id} style={({ pressed }) => [styles.billCard, pressed ? styles.billCardPressed : null]} onPress={() => setDetailBill(bill)}>
              <View style={styles.billTopRow}>
                <View style={styles.billHeaderMain}>
                  <Text style={styles.billShop}>{getShopLabel(bill.shopId)}</Text>
                  <Text style={styles.billRoute}>{getRouteLabel(bill.routeId)}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>{bill.status || 'ordered'}</Text>
                </View>
              </View>
              {!isDeliveryMan ? (
                <Text style={styles.createdBy}>Created by {getCreatedBy(bill)}</Text>
              ) : null}
              <View style={styles.billSummaryRow}>
                <View style={styles.billInfoChip}>
                  <Text style={styles.billInfoLabel}>Items</Text>
                  <Text style={styles.billInfoValue}>{bill.items.length}</Text>
                </View>
                <View style={[styles.billInfoChip, styles.billTotalChip]}>
                  <Text style={styles.billInfoLabel}>Total</Text>
                  <Text style={[styles.billInfoValue, styles.billTotalValue]}>{asCurrency(bill.totalAmount)}</Text>
                </View>
              </View>
              {!isDeliveryMan ? (
                <Text style={styles.billDate}>{new Date(bill.createdAt).toLocaleString()}</Text>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeCreateModal}>
        <View style={[styles.modalBackdrop, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Retailer Bill</Text>
              <Pressable onPress={closeCreateModal}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Route</Text>
              <Pressable onPress={() => setRoutePickerVisible(true)} style={styles.selectorInput}>
                <Text style={selectedRouteId ? styles.selectorValue : styles.selectorPlaceholder}>{selectedRouteName}</Text>
              </Pressable>

              <Text style={[styles.fieldLabel, styles.nextField]}>Shop</Text>
              <Pressable
                onPress={() => {
                  if (!selectedRouteId) {
                    Alert.alert('Validation', 'Select route first.');
                    return;
                  }
                  setShopPickerVisible(true);
                }}
                style={styles.selectorInput}>
                <Text style={selectedShopId ? styles.selectorValue : styles.selectorPlaceholder}>{selectedShopName}</Text>
              </Pressable>

              <Text style={[styles.fieldLabel, styles.nextField]}>Products</Text>
              <View style={styles.productsList}>
                {products.map((product) => (
                  <View key={product._id} style={styles.productCard}>
                    <View style={styles.productCardHeader}>
                      <Text style={styles.productTitleLine} numberOfLines={2}>
                        <Text style={styles.productMrpInline}>{Math.round(product.mrp)} </Text>
                        <Text style={styles.productName}>{product.productName}</Text>
                      </Text>
                    </View>
                    <View style={styles.productMetaRow}>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaLabel}>Rate</Text>
                        <Text style={styles.metaValue}>{asTableAmount(product.productRate)}</Text>
                      </View>
                      <View style={[styles.metaPill, styles.totalPill]}>
                        <Text style={styles.metaLabel}>Total</Text>
                        <Text style={[styles.metaValue, styles.totalPillValue]}>
                          {asTableAmount(product.productRate * Number(quantities[product._id] || 0))}
                        </Text>
                      </View>
                    </View>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={(value) => onQuantityChange(product._id, value)}
                      placeholder="Quantity"
                      placeholderTextColor="#83938D"
                      style={styles.quantityInput}
                      value={quantities[product._id] ?? ''}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.stickyFooter}>
              <View>
                <Text style={styles.totalLabel}>Bill Total</Text>
                <Text style={styles.totalValue}>{asCurrency(computedTotal)}</Text>
              </View>
              <Pressable disabled={saving} onPress={onSaveBill} style={styles.createButton}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.createButtonText}>Create Bill</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={routePickerVisible} onRequestClose={() => setRoutePickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setRoutePickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Choose Route</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {routes.map((route) => (
                <Pressable
                  key={route._id}
                  onPress={() => {
                    setSelectedRouteId(route._id);
                    setSelectedShopId('');
                    setRoutePickerVisible(false);
                  }}
                  style={styles.pickerItem}>
                  <Text style={styles.pickerItemTitle}>{route.routeName}</Text>
                  <Text style={styles.pickerItemSubtitle}>{route.cityName}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={shopPickerVisible} onRequestClose={() => setShopPickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setShopPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Choose Shop</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredShops.map((shop) => (
                <Pressable key={shop._id} onPress={() => { setSelectedShopId(shop._id); setShopPickerVisible(false); }} style={styles.pickerItem}>
                  <Text style={styles.pickerItemTitle}>{shop.shopName}</Text>
                  <Text style={styles.pickerItemSubtitle}>{shop.shopAddress}</Text>
                </Pressable>
              ))}
              {filteredShops.length === 0 ? <Text style={styles.emptyPickerText}>No shops found for this route.</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(detailBill)} onRequestClose={() => setDetailBill(null)}>
        <Pressable style={[styles.detailBackdrop, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => setDetailBill(null)}>
          <Pressable style={styles.detailCard} onPress={() => {}}>
            {detailBill ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailHeaderCopy}>
                    <Text style={styles.detailTitle}>{getShopLabel(detailBill.shopId)}</Text>
                    <Text style={styles.detailSubtitle}>{getRouteLabel(detailBill.routeId)}</Text>
                    {!isDeliveryMan ? (
                      <Text style={styles.detailCreatedBy}>Created by {getCreatedBy(detailBill)}</Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => setDetailBill(null)} style={styles.detailCloseButton}>
                    <Ionicons name="close" size={18} color="#355246" />
                  </Pressable>
                </View>

                <View style={styles.detailMetaRow}>
                  <View style={styles.detailMetaChip}>
                    <Text style={styles.detailMetaLabel}>Status</Text>
                    <Text style={styles.detailMetaValue}>{detailBill.status || 'ordered'}</Text>
                  </View>
                  <View style={styles.detailMetaChip}>
                    <Text style={styles.detailMetaLabel}>Total</Text>
                    <Text style={[styles.detailMetaValue, styles.detailMetaValueTotal]}>{asCurrency(detailBill.totalAmount)}</Text>
                  </View>
                </View>

                <ScrollView style={styles.detailList} showsVerticalScrollIndicator={false}>
                  {detailBill.items.map((item, index) => {
                    const itemMrp = getBillItemMrp(item);
                    return (
                      <View key={`${getBillItemProductId(item)}-${index}`} style={styles.detailItemCard}>
                        <Text style={styles.detailItemName}>{item.productName}</Text>
                        <View style={styles.detailItemRow}>
                          {itemMrp !== null ? (
                            <View style={styles.detailItemStat}>
                              <Text style={styles.detailItemLabel}>MRP</Text>
                              <Text style={styles.detailItemValue}>{asCurrency(itemMrp)}</Text>
                            </View>
                          ) : null}
                          <View style={styles.detailItemStat}>
                            <Text style={styles.detailItemLabel}>Qty</Text>
                            <Text style={styles.detailItemValue}>{item.quantity}</Text>
                          </View>
                          <View style={styles.detailItemStat}>
                            <Text style={styles.detailItemLabel}>Rate</Text>
                            <Text style={styles.detailItemValue}>{asCurrency(item.productRate)}</Text>
                          </View>
                          <View style={styles.detailItemStat}>
                            <Text style={styles.detailItemLabel}>Total</Text>
                            <Text style={[styles.detailItemValue, styles.detailItemTotal]}>{asCurrency(item.total)}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {isDeliveryMan && !['completed', 'delivered', 'cancelled'].includes(String(detailBill.status || '').toLowerCase()) ? (
                  <Pressable
                    disabled={saving}
                    onPress={() => void onMarkDelivered(detailBill._id)}
                    style={[styles.deliveredButton, saving ? styles.deliveredButtonDisabled : null]}>
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.deliveredButtonText}>Delivered</Text>
                    )}
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F8F6' },
  content: { padding: 20, paddingBottom: 120 },
  headerRow: { marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', color: '#103728' },
  subtitle: { marginTop: 6, fontSize: 15, lineHeight: 22, color: '#587068' },
  addButton: { backgroundColor: '#0F5D33', borderRadius: 16, paddingHorizontal: 16, height: 48, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { marginTop: 18, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#DCE9E2' },
  emptyText: { color: '#61736D', fontSize: 15 },
  billCard: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#DFEAE4' },
  billCardPressed: { opacity: 0.96 },
  billTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  billHeaderMain: { flex: 1, gap: 4 },
  billShop: { fontSize: 16, fontWeight: '800', color: '#133426' },
  billRoute: { color: '#496158', fontSize: 13 },
  createdBy: { marginTop: 10, color: '#5A7068', fontSize: 13 },
  statusPill: { backgroundColor: '#E7F6EE', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { color: '#0F6B42', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  billSummaryRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  billInfoChip: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#E3ECE7', backgroundColor: '#F7FBF9', paddingHorizontal: 12, paddingVertical: 9 },
  billTotalChip: { backgroundColor: '#EEF8F2', borderColor: '#D6E8DC' },
  billInfoLabel: { fontSize: 11, fontWeight: '700', color: '#72837C', textTransform: 'uppercase' },
  billInfoValue: { marginTop: 4, color: '#1D342A', fontSize: 15, fontWeight: '800' },
  billTotalValue: { color: '#0E6B43' },
  billDate: { marginTop: 10, color: '#748680', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7, 20, 15, 0.48)', justifyContent: 'flex-end' },
  modalCard: { width: '100%', height: '90%', backgroundColor: '#F9FCFB', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0D3525' },
  closeText: { color: '#0D5F37', fontSize: 15, fontWeight: '700' },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingTop: 2, flexGrow: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#27463B', marginTop: 12, marginBottom: 8 },
  nextField: { marginTop: 18 },
  selectorInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D3E0DA', borderRadius: 16, minHeight: 54, justifyContent: 'center', paddingHorizontal: 14 },
  selectorValue: { color: '#10251D', fontSize: 15, fontWeight: '600' },
  selectorPlaceholder: { color: '#83938D', fontSize: 15 },
  productsList: { gap: 12 },
  productCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DDE8E3', padding: 14 },
  productCardHeader: { marginBottom: 12 },
  productTitleLine: { fontSize: 17, fontWeight: '800', color: '#103728' },
  productMrpInline: { fontSize: 17, fontWeight: '800', color: '#0E6B43' },
  productName: { fontSize: 17, fontWeight: '800', color: '#103728' },
  productMetaRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metaPill: { flex: 1, minHeight: 88, borderRadius: 16, backgroundColor: '#F5F9F7', borderWidth: 1, borderColor: '#DDE8E3', paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  totalPill: { backgroundColor: '#EEF8F2', borderColor: '#CDE3D4' },
  metaLabel: { fontSize: 11, fontWeight: '700', color: '#6A7C74', textTransform: 'uppercase' },
  metaValue: { marginTop: 6, fontSize: 16, fontWeight: '800', color: '#173126' },
  totalPillValue: { color: '#0E6B43' },
  quantityInput: { height: 50, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#CFE0D8', paddingHorizontal: 14, color: '#0F201A', fontSize: 16, fontWeight: '700' },
  stickyFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#DCE7E2', paddingTop: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: '#F9FCFB' },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#60756C' },
  totalValue: { marginTop: 4, fontSize: 24, fontWeight: '800', color: '#0E5C35' },
  createButton: { minWidth: 148, height: 52, borderRadius: 16, backgroundColor: '#0F5D33', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  createButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(7, 20, 15, 0.4)', justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 },
  pickerCard: { backgroundColor: '#FFFFFF', borderRadius: 24, maxHeight: '62%', padding: 18 },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: '#113223', marginBottom: 12 },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ECF1EF' },
  pickerItemTitle: { fontSize: 16, fontWeight: '700', color: '#112D22' },
  pickerItemSubtitle: { marginTop: 4, fontSize: 13, color: '#678078' },
  emptyPickerText: { color: '#6F807B', fontSize: 14, paddingVertical: 16 },
  detailBackdrop: { flex: 1, backgroundColor: 'rgba(7, 20, 15, 0.5)', justifyContent: 'center', paddingHorizontal: 18 },
  detailCard: { width: '100%', maxHeight: '84%', backgroundColor: '#F9FCFB', borderRadius: 24, borderWidth: 1, borderColor: '#DCE7E2', padding: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  detailHeaderCopy: { flex: 1 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: '#123528' },
  detailSubtitle: { marginTop: 4, fontSize: 13, color: '#5C7269' },
  detailCreatedBy: { marginTop: 6, fontSize: 13, color: '#5C7269' },
  detailCloseButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EEF4F1', alignItems: 'center', justifyContent: 'center' },
  detailMetaRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  detailMetaChip: { flex: 1, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE7E2', paddingHorizontal: 12, paddingVertical: 10 },
  detailMetaLabel: { fontSize: 11, fontWeight: '700', color: '#6F837B', textTransform: 'uppercase' },
  detailMetaValue: { marginTop: 4, fontSize: 16, fontWeight: '800', color: '#173126', textTransform: 'capitalize' },
  detailMetaValueTotal: { color: '#0E6B43' },
  detailList: { marginTop: 16 },
  detailItemCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E1EBE6', padding: 14, marginBottom: 10 },
  detailItemName: { fontSize: 16, fontWeight: '800', color: '#123528' },
  detailItemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  detailItemStat: { flexGrow: 1, minWidth: '22%', borderRadius: 14, backgroundColor: '#F5F9F7', borderWidth: 1, borderColor: '#E2ECE7', paddingHorizontal: 10, paddingVertical: 9 },
  detailItemLabel: { fontSize: 11, fontWeight: '700', color: '#72837C', textTransform: 'uppercase' },
  detailItemValue: { marginTop: 4, fontSize: 14, fontWeight: '800', color: '#173126' },
  detailItemTotal: { color: '#0E6B43' },
  deliveredButton: {
    marginTop: 14,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#0F5D33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveredButtonDisabled: {
    opacity: 0.7,
  },
  deliveredButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
