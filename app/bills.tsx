import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/constants/i18n';
import {
  type AppBill,
  type AppProduct,
  type AppRoute,
  type AppShop,
  createBill,
  getBillProducts,
  getCurrentUser,
  getMyBills,
  getMyShops,
  getShopRoutes,
} from '@/services/api';

const asCurrency = (value: number) => `Rs. ${value.toFixed(2)}`;

const getRouteLabel = (route: string | AppRoute | undefined) => {
  if (!route || typeof route === 'string') {
    return 'Unknown route';
  }
  return [route.routeName, route.cityName].filter(Boolean).join(', ');
};

const getShopLabel = (shop: string | AppShop | undefined) => {
  if (!shop || typeof shop === 'string') {
    return 'Unknown shop';
  }
  return shop.shopName;
};

const extractList = <T,>(payload: unknown): T[] => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const list = (payload as { data?: unknown }).data;
    return Array.isArray(list) ? (list as T[]) : [];
  }
  return [];
};

export default function BillsScreen() {
  const { t } = useI18n();
  const user = getCurrentUser();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [bills, setBills] = useState<AppBill[]>([]);
  const [routes, setRoutes] = useState<AppRoute[]>([]);
  const [shops, setShops] = useState<AppShop[]>([]);
  const [products, setProducts] = useState<AppProduct[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [routePickerVisible, setRoutePickerVisible] = useState(false);
  const [shopPickerVisible, setShopPickerVisible] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      if (typeof shop.routeId === 'string') {
        return shop.routeId === selectedRouteId;
      }
      if (shop.routeId && typeof shop.routeId === 'object' && '_id' in shop.routeId) {
        return String(shop.routeId._id) === selectedRouteId;
      }
      return false;
    });
  }, [selectedRouteId, shops]);

  const selectedRouteName = useMemo(() => {
    const route = routes.find((item) => item._id === selectedRouteId);
    return route ? `${route.routeName}, ${route.cityName}` : t('bills_select_route');
  }, [routes, selectedRouteId, t]);

  const selectedShopName = useMemo(() => {
    const shop = filteredShops.find((item) => item._id === selectedShopId);
    return shop ? shop.shopName : t('bills_select_shop');
  }, [filteredShops, selectedShopId, t]);

  const computedTotal = useMemo(() => {
    return products.reduce((sum, product) => {
      const quantity = Number(quantities[product._id] || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return sum;
      }
      return sum + product.productRate * quantity;
    }, 0);
  }, [products, quantities]);

  const loadBills = useCallback(async () => {
    setLoading(true);
    const result = await getMyBills();
    setLoading(false);

    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    setBills(extractList<AppBill>(result.data));
  }, [t]);

  const loadCatalogData = useCallback(async () => {
    setCatalogLoading(true);
    const [routesResult, shopsResult, productsResult] = await Promise.all([
      getShopRoutes(),
      getMyShops(),
      getBillProducts(),
    ]);
    setCatalogLoading(false);

    if (!routesResult.ok) {
      Alert.alert(t('common_error'), routesResult.message);
      return false;
    }
    if (!shopsResult.ok) {
      Alert.alert(t('common_error'), shopsResult.message);
      return false;
    }
    if (!productsResult.ok) {
      Alert.alert(t('common_error'), productsResult.message);
      return false;
    }

    setRoutes(extractList<AppRoute>(routesResult.data));
    setShops(extractList<AppShop>(shopsResult.data));
    setProducts(extractList<AppProduct>(productsResult.data));
    return true;
  }, [t]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void loadBills();
  }, [loadBills, user]);

  const openCreateModal = async () => {
    const ready = await loadCatalogData();
    if (!ready) {
      return;
    }

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

  const onSelectRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    setSelectedShopId('');
    setRoutePickerVisible(false);
  };

  const onQuantityChange = (productId: string, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setQuantities((prev) => ({
      ...prev,
      [productId]: cleaned,
    }));
  };

  const onCreateBill = async () => {
    const items = products
      .map((product) => ({
        productId: product._id,
        quantity: Number(quantities[product._id] || 0),
      }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    if (!selectedRouteId || !selectedShopId || items.length === 0) {
      Alert.alert(t('common_validation'), t('bills_validation'));
      return;
    }

    setSaving(true);
    const result = await createBill({
      routeId: selectedRouteId,
      shopId: selectedShopId,
      items,
    });
    setSaving(false);

    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    closeCreateModal();
    await loadBills();
    Alert.alert(t('bills_modal_title'), result.message);
  };

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{t('bills_title')}</Text>
            <Text style={styles.subtitle}>{t('bills_subtitle')}</Text>
          </View>
          <Pressable disabled={catalogLoading} onPress={openCreateModal} style={styles.addButton}>
            <Text style={styles.addButtonText}>{catalogLoading ? '...' : t('bills_add')}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0F5D33" />
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('bills_no_data')}</Text>
          </View>
        ) : (
          bills.map((bill) => (
            <View key={bill._id} style={styles.billCard}>
              <View style={styles.billTopRow}>
                <Text style={styles.billShop}>{getShopLabel(bill.shopId)}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>{bill.status || t('bills_ordered')}</Text>
                </View>
              </View>
              <Text style={styles.billRoute}>{getRouteLabel(bill.routeId)}</Text>
              <Text style={styles.billMeta}>
                {t('bills_items')}: {bill.items.length}
              </Text>
              <Text style={styles.billMeta}>
                {t('bills_total')}: {asCurrency(bill.totalAmount)}
              </Text>
              <Text style={styles.billDate}>
                {new Date(bill.createdAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeCreateModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('bills_modal_title')}</Text>
              <Pressable onPress={closeCreateModal}>
                <Text style={styles.closeText}>{t('common_close')}</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.fieldLabel}>Route</Text>
              <Pressable onPress={() => setRoutePickerVisible(true)} style={styles.selectorInput}>
                <Text style={selectedRouteId ? styles.selectorValue : styles.selectorPlaceholder}>
                  {selectedRouteName}
                </Text>
              </Pressable>

              <Text style={[styles.fieldLabel, styles.nextField]}>{t('shops_title')}</Text>
              <Pressable
                onPress={() => {
                  if (!selectedRouteId) {
                    Alert.alert(t('common_validation'), t('bills_select_route'));
                    return;
                  }
                  setShopPickerVisible(true);
                }}
                style={styles.selectorInput}>
                <Text style={selectedShopId ? styles.selectorValue : styles.selectorPlaceholder}>
                  {selectedShopName}
                </Text>
              </Pressable>

              <Text style={[styles.fieldLabel, styles.nextField]}>{t('bills_products_title')}</Text>

              {products.map((product) => (
                <View key={product._id} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productName}>{product.productName}</Text>
                  </View>
                  <View style={styles.productRow}>
                    <View style={styles.readonlyRate}>
                      <Text style={styles.readonlyLabel}>Unit Price</Text>
                      <Text style={styles.readonlyValue}>{asCurrency(product.productRate)}</Text>
                    </View>
                    <View style={styles.quantityWrap}>
                      <Text style={styles.readonlyLabel}>{t('bills_quantity')}</Text>
                      <TextInput
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#91A09B"
                        style={styles.quantityInput}
                        value={quantities[product._id] ?? ''}
                        onChangeText={(value) => onQuantityChange(product._id, value)}
                      />
                    </View>
                    <View style={styles.lineTotalWrap}>
                      <Text style={styles.readonlyLabel}>Total</Text>
                      <Text style={styles.lineTotalValue}>
                        {asCurrency(product.productRate * Number(quantities[product._id] || 0))}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.stickyFooter}>
              <View>
                <Text style={styles.totalLabel}>{t('bills_total_sticky')}</Text>
                <Text style={styles.totalValue}>{asCurrency(computedTotal)}</Text>
              </View>
              <Pressable disabled={saving} onPress={onCreateBill} style={styles.createButton}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.createButtonText}>{t('bills_create')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={routePickerVisible} onRequestClose={() => setRoutePickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setRoutePickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>{t('bills_route_picker_title')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {routes.map((route) => (
                <Pressable key={route._id} onPress={() => onSelectRoute(route._id)} style={styles.pickerItem}>
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
            <Text style={styles.pickerTitle}>{t('bills_shop_picker_title')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredShops.map((shop) => (
                <Pressable
                  key={shop._id}
                  onPress={() => {
                    setSelectedShopId(shop._id);
                    setShopPickerVisible(false);
                  }}
                  style={styles.pickerItem}>
                  <Text style={styles.pickerItemTitle}>{shop.shopName}</Text>
                  <Text style={styles.pickerItemSubtitle}>{shop.shopAddress}</Text>
                </Pressable>
              ))}
              {filteredShops.length === 0 ? (
                <Text style={styles.emptyPickerText}>No shops found for this route.</Text>
              ) : null}
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
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#103728',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: '#587068',
  },
  addButton: {
    backgroundColor: '#0F5D33',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DCE9E2',
  },
  emptyText: {
    color: '#61736D',
    fontSize: 15,
  },
  billCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DFEAE4',
    shadowColor: '#123524',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  billTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  billShop: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#133426',
  },
  statusPill: {
    backgroundColor: '#E7F6EE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    color: '#0F6B42',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  billRoute: {
    marginTop: 8,
    color: '#496158',
    fontSize: 14,
  },
  billMeta: {
    marginTop: 6,
    color: '#2D3F39',
    fontSize: 14,
    fontWeight: '600',
  },
  billDate: {
    marginTop: 10,
    color: '#748680',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 20, 15, 0.48)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    height: '88%',
    backgroundColor: '#F9FCFB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D3525',
  },
  closeText: {
    color: '#0D5F37',
    fontSize: 15,
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#27463B',
    marginTop: 12,
    marginBottom: 8,
  },
  nextField: {
    marginTop: 18,
  },
  selectorInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D3E0DA',
    borderRadius: 16,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  selectorValue: {
    color: '#10251D',
    fontSize: 15,
    fontWeight: '600',
  },
  selectorPlaceholder: {
    color: '#83938D',
    fontSize: 15,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDE8E3',
    padding: 14,
    marginBottom: 12,
  },
  productHeader: {
    gap: 12,
    alignItems: 'flex-start',
  },
  productName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F2E23',
  },
  productRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    alignItems: 'flex-end',
  },
  readonlyRate: {
    flex: 1,
    backgroundColor: '#F4F8F6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E4DF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readonlyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7C76',
    marginBottom: 4,
  },
  readonlyValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#19352B',
  },
  quantityWrap: {
    width: 104,
  },
  lineTotalWrap: {
    minWidth: 92,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  lineTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0E6B43',
  },
  quantityInput: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D3E0DA',
    paddingHorizontal: 12,
    color: '#0F201A',
    fontSize: 16,
    fontWeight: '700',
  },
  stickyFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DCE7E2',
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    backgroundColor: '#F9FCFB',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#60756C',
  },
  totalValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800',
    color: '#0E5C35',
  },
  createButton: {
    minWidth: 148,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0F5D33',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 20, 15, 0.4)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    maxHeight: '70%',
    padding: 18,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#113223',
    marginBottom: 12,
  },
  pickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF1EF',
  },
  pickerItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#112D22',
  },
  pickerItemSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#678078',
  },
  emptyPickerText: {
    color: '#6F807B',
    fontSize: 14,
    paddingVertical: 16,
  },
});
