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

import { useI18n } from '@/constants/i18n';
import {
  type AppBill,
  type AppBillItem,
  type AppProduct,
  type AppRoute,
  type AppShop,
  createBill,
  deleteBillById,
  getBillProducts,
  getCurrentUser,
  getMyRoutes,
  getMyBills,
  getMyShops,
  updateBillById,
} from '@/services/api';

const asCurrency = (value: number) => `Rs. ${value.toFixed(2)}`;
const asTableAmount = (value: number) => value.toFixed(2);

const pickLocalizedValue = (
  language: 'en' | 'gu',
  englishValue?: string,
  gujaratiValue?: string,
) => {
  const english = englishValue?.trim() ?? '';
  const gujarati = gujaratiValue?.trim() ?? '';

  if (language === 'gu') {
    return gujarati || english;
  }

  return english || gujarati;
};

const getRouteLabel = (route: string | AppRoute | undefined, language: 'en' | 'gu') => {
  if (!route || typeof route === 'string') {
    return 'Unknown route';
  }
  return [
    pickLocalizedValue(language, route.routeName, route.routeNameGujarati),
    pickLocalizedValue(language, route.cityName, route.cityNameGujarati),
  ].filter(Boolean).join(', ');
};

const getShopLabel = (shop: string | AppShop | undefined, language: 'en' | 'gu') => {
  if (!shop || typeof shop === 'string') {
    return 'Unknown shop';
  }
  return pickLocalizedValue(language, shop.shopName, shop.shopNameGujarati);
};

const getBillItemProductId = (item: AppBillItem) => {
  if (typeof item.productId === 'string') {
    return item.productId;
  }
  if (item.productId && typeof item.productId === 'object' && '_id' in item.productId) {
    return String(item.productId._id);
  }
  return '';
};

const getBillItemMrp = (item: AppBillItem) => {
  if (typeof item.mrp === 'number' && Number.isFinite(item.mrp)) {
    return item.mrp;
  }
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

export default function BillsScreen() {
  const { language, t } = useI18n();
  const user = getCurrentUser();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [bills, setBills] = useState<AppBill[]>([]);
  const [routes, setRoutes] = useState<AppRoute[]>([]);
  const [shops, setShops] = useState<AppShop[]>([]);
  const [products, setProducts] = useState<AppProduct[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [detailBill, setDetailBill] = useState<AppBill | null>(null);
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
    return route ? getRouteLabel(route, language) : t('bills_select_route');
  }, [language, routes, selectedRouteId, t]);

  const selectedShopName = useMemo(() => {
    const shop = filteredShops.find((item) => item._id === selectedShopId);
    return shop ? getShopLabel(shop, language) : t('bills_select_shop');
  }, [filteredShops, language, selectedShopId, t]);

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

    setBills(
      extractList<AppBill>(result.data).filter(
        (bill) => String(bill.status || '').toLowerCase() === 'shipped',
      ),
    );
  }, [t]);

  const loadCatalogData = useCallback(async () => {
    setCatalogLoading(true);
    const [routesResult, shopsResult, productsResult] = await Promise.all([
      getMyRoutes(),
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
    setProducts(sortProductsBySequence(extractList<AppProduct>(productsResult.data)));
    return true;
  }, [t]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void loadBills();
  }, [loadBills, user]);

  const refreshScreen = useCallback(async () => {
    setRefreshing(true);
    await loadBills();
    setRefreshing(false);
  }, [loadBills]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        return;
      }
      void refreshScreen();
    }, [refreshScreen, user]),
  );

  const openCreateModal = async () => {
    const ready = await loadCatalogData();
    if (!ready) {
      return;
    }

    setEditingBillId(null);
    setSelectedRouteId('');
    setSelectedShopId('');
    setQuantities({});
    setModalVisible(true);
  };

  const openEditModal = async (bill: AppBill) => {
    const ready = await loadCatalogData();
    if (!ready) {
      return;
    }

    const nextQuantities = bill.items.reduce<Record<string, string>>((acc, item) => {
      const productId = getBillItemProductId(item);
      if (productId && item.quantity > 0) {
        acc[productId] = String(item.quantity);
      }
      return acc;
    }, {});

    const routeId =
      typeof bill.routeId === 'string'
        ? bill.routeId
        : bill.routeId && typeof bill.routeId === 'object' && '_id' in bill.routeId
        ? String(bill.routeId._id)
        : '';
    const shopId =
      typeof bill.shopId === 'string'
        ? bill.shopId
        : bill.shopId && typeof bill.shopId === 'object' && '_id' in bill.shopId
        ? String(bill.shopId._id)
        : '';

    setEditingBillId(bill._id);
    setSelectedRouteId(routeId);
    setSelectedShopId(shopId);
    setQuantities(nextQuantities);
    setModalVisible(true);
  };

  const closeCreateModal = () => {
    setModalVisible(false);
    setEditingBillId(null);
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

  const onSaveBill = async () => {
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
    const payload = {
      routeId: selectedRouteId,
      shopId: selectedShopId,
      items,
    };
    const result = editingBillId
      ? await updateBillById(editingBillId, payload)
      : await createBill(payload);
    setSaving(false);

    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    closeCreateModal();
    await loadBills();
    Alert.alert(editingBillId ? 'Bill updated' : t('bills_modal_title'), result.message);
  };

  const onDeleteBill = (billId: string) => {
    Alert.alert('Delete Bill', 'Are you sure you want to delete this bill?', [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteBillById(billId);
          if (!result.ok) {
            Alert.alert(t('common_error'), result.message);
            return;
          }
          await loadBills();
        },
      },
    ]);
  };

  const openBillDetails = (bill: AppBill) => {
    setDetailBill(bill);
  };

  const closeBillDetails = () => {
    setDetailBill(null);
  };

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refreshScreen()} tintColor="#0F5D33" />
        }>
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
            <Pressable
              key={bill._id}
              style={({ pressed }) => [styles.billCard, pressed ? styles.billCardPressed : null]}
              onPress={() => openBillDetails(bill)}>
              <View style={styles.billTopRow}>
                <View style={styles.billHeaderMain}>
                  <Text style={styles.billShop}>{getShopLabel(bill.shopId, language)}</Text>
                  <Text style={styles.billRoute}>{getRouteLabel(bill.routeId, language)}</Text>
                </View>
                <View style={styles.billHeaderSide}>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{bill.status || t('bills_ordered')}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.billSummaryRow}>
                <View style={styles.billInfoChip}>
                  <Text style={styles.billInfoLabel}>{t('bills_items')}</Text>
                  <Text style={styles.billInfoValue}>{bill.items.length}</Text>
                </View>
                <View style={[styles.billInfoChip, styles.billTotalChip]}>
                  <Text style={styles.billInfoLabel}>{t('bills_total')}</Text>
                  <Text style={[styles.billInfoValue, styles.billTotalValue]}>{asCurrency(bill.totalAmount)}</Text>
                </View>
              </View>
              <View style={styles.billFooterRow}>
                <Text style={styles.billDate}>
                  {new Date(bill.createdAt).toLocaleString()}
                </Text>
                {bill.status === 'ordered' ? (
                  <View style={styles.billActionRow}>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        void openEditModal(bill);
                      }}
                      style={styles.billIconButton}>
                      <Ionicons name="pencil" size={16} color="#0F5D33" />
                    </Pressable>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        onDeleteBill(bill._id);
                      }}
                      style={[styles.billIconButton, styles.deleteBillIconButton]}>
                      <Ionicons name="trash-outline" size={16} color="#B73939" />
                    </Pressable>
                  </View>
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
              <Text style={styles.modalTitle}>{editingBillId ? 'Edit Bill' : t('bills_modal_title')}</Text>
              <Pressable onPress={closeCreateModal}>
                <Text style={styles.closeText}>{t('common_close')}</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: 24 + Math.max(insets.bottom, 8) },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
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
                        <Text style={styles.metaLabel}>Quantity</Text>
                        <TextInput
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor="#8BA099"
                          style={styles.quantityInput}
                          value={quantities[product._id] ?? ''}
                          onChangeText={(value) => onQuantityChange(product._id, value)}
                        />
                      </View>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaLabel}>Unit Price</Text>
                        <Text style={styles.metaValue}>{asTableAmount(product.productRate)}</Text>
                      </View>
                      <View style={[styles.metaPill, styles.totalPill]}>
                        <Text style={styles.metaLabel}>Total</Text>
                        <Text style={[styles.metaValue, styles.totalPillValue]}>
                          {asTableAmount(product.productRate * Number(quantities[product._id] || 0))}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View>
                <Text style={styles.totalLabel}>{t('bills_total_sticky')}</Text>
                <Text style={styles.totalValue}>{asCurrency(computedTotal)}</Text>
              </View>
              <Pressable disabled={saving} onPress={onSaveBill} style={styles.createButton}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.createButtonText}>{editingBillId ? 'Update Bill' : t('bills_create')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={routePickerVisible} onRequestClose={() => setRoutePickerVisible(false)}>
        <Pressable
          style={[styles.pickerBackdrop, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onPress={() => setRoutePickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>{t('bills_route_picker_title')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {routes.map((route) => (
                <Pressable key={route._id} onPress={() => onSelectRoute(route._id)} style={styles.pickerItem}>
                  <Text style={styles.pickerItemTitle}>
                    {pickLocalizedValue(language, route.routeName, route.routeNameGujarati)}
                  </Text>
                  <Text style={styles.pickerItemSubtitle}>
                    {pickLocalizedValue(language, route.cityName, route.cityNameGujarati)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={shopPickerVisible} onRequestClose={() => setShopPickerVisible(false)}>
        <Pressable
          style={[styles.pickerBackdrop, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onPress={() => setShopPickerVisible(false)}>
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
                  <Text style={styles.pickerItemTitle}>
                    {pickLocalizedValue(language, shop.shopName, shop.shopNameGujarati)}
                  </Text>
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

      <Modal transparent visible={Boolean(detailBill)} onRequestClose={closeBillDetails} animationType="fade">
        <Pressable
          style={[styles.detailBackdrop, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={closeBillDetails}>
          <Pressable style={styles.detailCard} onPress={() => {}}>
            {detailBill ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailHeaderCopy}>
                    <Text style={styles.detailTitle}>{getShopLabel(detailBill.shopId, language)}</Text>
                    <Text style={styles.detailSubtitle}>{getRouteLabel(detailBill.routeId, language)}</Text>
                  </View>
                  <Pressable onPress={closeBillDetails} style={styles.detailCloseButton}>
                    <Ionicons name="close" size={18} color="#355246" />
                  </Pressable>
                </View>

                <View style={styles.detailMetaRow}>
                  <View style={styles.detailMetaChip}>
                    <Text style={styles.detailMetaLabel}>{t('bills_status')}</Text>
                    <Text style={styles.detailMetaValue}>{detailBill.status || t('bills_ordered')}</Text>
                  </View>
                  <View style={styles.detailMetaChip}>
                    <Text style={styles.detailMetaLabel}>{t('bills_total')}</Text>
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
                            <Text style={styles.detailItemLabel}>{t('bills_quantity')}</Text>
                            <Text style={styles.detailItemValue}>{item.quantity}</Text>
                          </View>
                          <View style={styles.detailItemStat}>
                            <Text style={styles.detailItemLabel}>Unit Price</Text>
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

                <Text style={styles.detailDate}>{new Date(detailBill.createdAt).toLocaleString()}</Text>
              </>
            ) : null}
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
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DFEAE4',
    shadowColor: '#123524',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  billCardPressed: {
    opacity: 0.96,
  },
  billTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
  },
  billHeaderMain: {
    flex: 1,
    gap: 4,
  },
  billHeaderSide: {
    alignItems: 'flex-end',
    gap: 8,
  },
  billShop: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#133426',
  },
  statusPill: {
    backgroundColor: '#E7F6EE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    color: '#0F6B42',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  billRoute: {
    color: '#496158',
    fontSize: 13,
  },
  billSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  billInfoChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3ECE7',
    backgroundColor: '#F7FBF9',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  billTotalChip: {
    backgroundColor: '#EEF8F2',
    borderColor: '#D6E8DC',
  },
  billInfoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#72837C',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  billInfoValue: {
    marginTop: 4,
    color: '#1D342A',
    fontSize: 15,
    fontWeight: '800',
  },
  billTotalValue: {
    color: '#0E6B43',
  },
  billDate: {
    color: '#748680',
    fontSize: 12,
  },
  billFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  billActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  billIconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#E8F6EE',
    borderWidth: 1,
    borderColor: '#B9DDC7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBillIconButton: {
    backgroundColor: '#FDECEC',
    borderColor: '#F2B8B8',
  },
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 20, 15, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  detailCard: {
    width: '100%',
    maxHeight: '84%',
    backgroundColor: '#F9FCFB',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DCE7E2',
    padding: 18,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailHeaderCopy: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#123528',
  },
  detailSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#5C7269',
  },
  detailCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  detailMetaChip: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7E2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6F837B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailMetaValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: '#173126',
    textTransform: 'capitalize',
  },
  detailMetaValueTotal: {
    color: '#0E6B43',
  },
  detailList: {
    marginTop: 16,
  },
  detailItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1EBE6',
    padding: 14,
    marginBottom: 10,
  },
  detailItemName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#123528',
  },
  detailItemRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  detailItemStat: {
    flexGrow: 1,
    minWidth: '22%',
    borderRadius: 14,
    backgroundColor: '#F5F9F7',
    borderWidth: 1,
    borderColor: '#E2ECE7',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  detailItemLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#72837C',
    textTransform: 'uppercase',
  },
  detailItemValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#173126',
  },
  detailItemTotal: {
    color: '#0E6B43',
  },
  detailDate: {
    marginTop: 6,
    color: '#748680',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 20, 15, 0.48)',
    justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'android' ? 12 : 20,
  },
  modalCard: {
    width: '100%',
    height: '90%',
    backgroundColor: '#F9FCFB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    overflow: 'hidden',
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
    paddingTop: 2,
    flexGrow: 1,
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
  productsList: {
    gap: 12,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDE8E3',
    padding: 14,
  },
  productCardHeader: {
    marginBottom: 12,
  },
  productTitleLine: {
    fontSize: 17,
    fontWeight: '800',
    color: '#103728',
  },
  productMrpInline: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0E6B43',
  },
  productName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#103728',
  },
  productMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metaPill: {
    flex: 1,
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: '#F5F9F7',
    borderWidth: 1,
    borderColor: '#DDE8E3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  totalPill: {
    backgroundColor: '#EEF8F2',
    borderColor: '#CDE3D4',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6A7C74',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '800',
    color: '#173126',
  },
  totalPillValue: {
    color: '#0E6B43',
  },
  quantityInput: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE0D8',
    paddingHorizontal: 14,
    color: '#0F201A',
    fontSize: 16,
    fontWeight: '700',
  },
  stickyFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DCE7E2',
    paddingTop: 14,
    paddingBottom: 12,
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
    justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'android' ? 12 : 20,
    paddingHorizontal: 18,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    maxHeight: '62%',
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
