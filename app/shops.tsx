import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  type AppRoute,
  type AppShop,
  type UploadImageFile,
  createShop,
  deleteShopById,
  getCurrentUser,
  getMyShops,
  getShopRoutes,
  updateShopById,
} from '@/services/api';
import { useI18n } from '@/constants/i18n';

const getRouteName = (shop: AppShop) => {
  if (shop.route && typeof shop.route === 'object' && 'routeName' in shop.route) {
    return [shop.route.routeName, shop.route.cityName].filter(Boolean).join(', ');
  }
  if (shop.routeId && typeof shop.routeId === 'object' && 'routeName' in shop.routeId) {
    return [shop.routeId.routeName, shop.routeId.cityName].filter(Boolean).join(', ');
  }
  return 'Unknown route';
};

const getShopImage = (shop: AppShop) => shop.shopImage || shop.image || '';
const asCoordinate = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const extractShopCoordinates = (shop: AppShop) => {
  const asRecord = shop as Record<string, unknown>;

  const latitude = asCoordinate(
    asRecord.latitude ??
    asRecord.lat ??
    (asRecord.location &&
    typeof asRecord.location === 'object' &&
    'coordinates' in (asRecord.location as Record<string, unknown>) &&
    Array.isArray((asRecord.location as { coordinates?: unknown }).coordinates)
      ? ((asRecord.location as { coordinates?: unknown[] }).coordinates?.[1] ?? null)
      : null)
  );
  const longitude = asCoordinate(
    asRecord.longitude ??
    asRecord.lng ??
    asRecord.lon ??
    (asRecord.location &&
    typeof asRecord.location === 'object' &&
    'coordinates' in (asRecord.location as Record<string, unknown>) &&
    Array.isArray((asRecord.location as { coordinates?: unknown }).coordinates)
      ? ((asRecord.location as { coordinates?: unknown[] }).coordinates?.[0] ?? null)
      : null)
  );

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};
const getShopCoordinates = (shop: AppShop) => {
  return extractShopCoordinates(shop);
};
const getRouteId = (shop: AppShop) => {
  if (typeof shop.routeId === 'string') {
    return shop.routeId;
  }
  if (shop.routeId && typeof shop.routeId === 'object' && '_id' in shop.routeId) {
    return String(shop.routeId._id);
  }
  if (shop.route && typeof shop.route === 'object' && '_id' in shop.route) {
    return String(shop.route._id);
  }
  return '';
};

export default function ShopsScreen() {
  const { t } = useI18n();
  const user = getCurrentUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [shops, setShops] = useState<AppShop[]>([]);
  const [routes, setRoutes] = useState<AppRoute[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [routePickerVisible, setRoutePickerVisible] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [shopLatitude, setShopLatitude] = useState<number | null>(null);
  const [shopLongitude, setShopLongitude] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<UploadImageFile | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const modalBackdropOpacity = useRef(new Animated.Value(0)).current;
  const modalCardScale = useRef(new Animated.Value(0.94)).current;
  const modalCardTranslateY = useRef(new Animated.Value(26)).current;

  const selectedRouteName = useMemo(
    () => {
      const route = routes.find((item) => item._id === selectedRouteId);
      return route ? `${route.routeName}, ${route.cityName}` : t('shops_select_route');
    },
    [routes, selectedRouteId, t],
  );

  const animateShopModalIn = useCallback(() => {
    modalBackdropOpacity.setValue(0);
    modalCardScale.setValue(0.94);
    modalCardTranslateY.setValue(26);

    Animated.parallel([
      Animated.timing(modalBackdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(modalCardScale, {
        toValue: 1,
        damping: 18,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(modalCardTranslateY, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [modalBackdropOpacity, modalCardScale, modalCardTranslateY]);

  const openShopModal = useCallback(() => {
    setModalVisible(true);
    requestAnimationFrame(() => {
      animateShopModalIn();
    });
  }, [animateShopModalIn]);

  const closeShopModal = useCallback((afterClose?: () => void) => {
    Animated.parallel([
      Animated.timing(modalBackdropOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(modalCardScale, {
        toValue: 0.97,
        duration: 180,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(modalCardTranslateY, {
        toValue: 18,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }
      setModalVisible(false);
      afterClose?.();
    });
  }, [modalBackdropOpacity, modalCardScale, modalCardTranslateY]);

  const loadShops = useCallback(async () => {
    setLoading(true);
    const result = await getMyShops();
    setLoading(false);

    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    const payload = result.data;
    const list =
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: AppShop[] }).data ?? [])
        : [];

    setShops(list);
  }, [t]);

  const loadRoutes = useCallback(async () => {
    setRoutesLoading(true);
    const result = await getShopRoutes();
    setRoutesLoading(false);
    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    const payload = result.data;
    const list =
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: AppRoute[] }).data ?? [])
        : [];

    setRoutes(list);
  }, [t]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadShops();
  }, [loadShops, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    loadRoutes();
  }, [loadRoutes, user]);

  const openCreateModal = () => {
    setEditingShopId(null);
    setSelectedRouteId('');
    setShopName('');
    setShopAddress('');
    setMobileNumber('');
    setShopLatitude(null);
    setShopLongitude(null);
    setImageFile(null);
    setExistingImageUrl('');
    openShopModal();
  };

  const onAddShopPress = async () => {
    await loadRoutes();
    openCreateModal();
  };

  const openEditModal = (shop: AppShop) => {
    const coordinates = getShopCoordinates(shop);
    setEditingShopId(shop._id);
    setSelectedRouteId(getRouteId(shop));
    setShopName(shop.shopName);
    setShopAddress(shop.shopAddress);
    setMobileNumber(shop.mobileNumber ?? '');
    setShopLatitude(coordinates?.latitude ?? null);
    setShopLongitude(coordinates?.longitude ?? null);
    setImageFile(null);
    setExistingImageUrl(getShopImage(shop));
    openShopModal();
  };

  const getCurrentCoordinates = useCallback(async () => {
    const existingPermission = await Location.getForegroundPermissionsAsync();
    const permission =
      existingPermission.status === 'granted'
        ? existingPermission
        : await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return null;
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled && Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
      } catch {
        // Ignore and continue with fallback APIs.
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
        maxAge: 1000 * 60 * 10,
        requiredAccuracy: 1000,
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

  const openShopInMaps = useCallback(async (shop: AppShop) => {
    const coordinates = getShopCoordinates(shop);
    if (!coordinates) {
      Alert.alert('Location unavailable', 'This shop does not have saved coordinates yet.');
      return;
    }

    const label = encodeURIComponent(shop.shopName || 'Shop');
    const { latitude, longitude } = coordinates;
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`
        : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common_error'), 'Unable to open maps right now.');
    }
  }, [t]);

  const pickImage = async () => {
    try {
      const existingPermission = await ImagePicker.getCameraPermissionsAsync();
      const permission =
        existingPermission.status === 'granted'
          ? existingPermission
          : await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(t('shops_permission_title'), t('shops_permission_message'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      if ((asset.fileSize ?? 0) > 10 * 1024 * 1024) {
        Alert.alert(t('common_error'), 'Please take an image smaller than 10MB.');
        return;
      }

      setImageFile({
        uri: asset.uri,
        name: asset.fileName ?? asset.assetId ?? `shop-image-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? undefined,
        size: asset.fileSize ?? undefined,
      });
    } catch {
      Alert.alert(
        t('shops_picker_unavailable_title'),
        t('shops_picker_unavailable_message')
      );
    }
  };

  const onSaveShop = useCallback(async () => {
    const name = shopName.trim();
    const address = shopAddress.trim();
    const mobile = mobileNumber.trim();
    const imageUrl = existingImageUrl.trim();
    if (!selectedRouteId || !name || !address || !mobile) {
      Alert.alert(t('common_validation'), t('shops_validation_fields'));
      return;
    }
    if (name.length < 2) {
      Alert.alert(t('common_validation'), 'Shop name must be at least 2 characters.');
      return;
    }
    if (address.length < 5) {
      Alert.alert(t('common_validation'), 'Shop address must be at least 5 characters.');
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      Alert.alert(t('common_validation'), 'Mobile number must be exactly 10 digits.');
      return;
    }
    if (!editingShopId && !imageFile?.uri) {
      Alert.alert(t('common_validation'), 'Please take a shop photo before saving.');
      return;
    }

    setSaving(true);
    let nextLatitude = shopLatitude;
    let nextLongitude = shopLongitude;

    if (!editingShopId && (nextLatitude === null || nextLongitude === null)) {
      try {
        const current = await getCurrentCoordinates();
        if (current) {
          nextLatitude = current.latitude;
          nextLongitude = current.longitude;
          setShopLatitude(current.latitude);
          setShopLongitude(current.longitude);
        } else {
          Alert.alert('Location permission', 'Location permission denied. Shop will be saved without map location.');
        }
      } catch {
        Alert.alert('Location unavailable', 'Could not fetch current location. Shop will be saved without map location.');
      }
    }

    const payload = {
      routeId: selectedRouteId,
      shopName: name,
      shopAddress: address,
      mobileNumber: mobile,
      latitude: nextLatitude ?? undefined,
      longitude: nextLongitude ?? undefined,
      imageFile: imageFile ?? undefined,
      imageUrl: !imageFile?.uri && imageUrl ? imageUrl : undefined,
    };
    const result = editingShopId
      ? await updateShopById(editingShopId, payload)
      : await createShop(payload);
    setSaving(false);

    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    closeShopModal(() => {
      setEditingShopId(null);
    });
    await loadShops();
  }, [closeShopModal, editingShopId, existingImageUrl, getCurrentCoordinates, imageFile, loadShops, mobileNumber, selectedRouteId, shopAddress, shopLatitude, shopLongitude, shopName, t]);

  const onDeleteShop = (id: string) => {
    Alert.alert('Delete Shop', 'Are you sure you want to delete this shop?', [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteShopById(id);
          if (!result.ok) {
            Alert.alert(t('common_error'), result.message);
            return;
          }
          await loadShops();
        },
      },
    ]);
  };

  const openImagePreview = useCallback((uri: string) => {
    if (!uri) {
      return;
    }
    setPreviewImageUri(uri);
    setImagePreviewVisible(true);
  }, []);

  const closeImagePreview = useCallback(() => {
    setImagePreviewVisible(false);
    setPreviewImageUri('');
  }, []);

  if (!user) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>Login required</Text>
          <Text style={styles.subtitle}>Please sign in first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{t('shops_title')}</Text>
          <Text style={styles.subtitle}>{t('shops_user_subtitle')}</Text>
        </View>
        <Pressable disabled={routesLoading} onPress={onAddShopPress} style={styles.addButton}>
          <Text style={styles.addButtonText}>{t('shops_add')}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F5D33" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listWrap}>
          {shops.map((shop) => {
            const image = getShopImage(shop);
            return (
              <View key={shop._id} style={styles.shopCard}>
                {image ? (
                  <Pressable onPress={() => openImagePreview(image)}>
                    <Image source={{ uri: image }} style={styles.shopImage} resizeMode="cover" />
                  </Pressable>
                ) : null}
                <Text style={styles.shopName}>{shop.shopName}</Text>
                <Text style={styles.shopRoute}>{t('shops_route')}: {getRouteName(shop)}</Text>
                <Text style={styles.shopAddress}>{shop.shopAddress}</Text>
                {shop.mobileNumber ? <Text style={styles.shopPhone}>Mobile: {shop.mobileNumber}</Text> : null}
                <View style={styles.cardActions}>
                  <Pressable onPress={() => openEditModal(shop)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => onDeleteShop(shop._id)} style={[styles.smallBtn, styles.deleteBtn]}>
                    <Text style={styles.smallBtnText}>Delete</Text>
                  </Pressable>
                  <Pressable onPress={() => openShopInMaps(shop)} style={[styles.smallBtn, styles.mapBtn]}>
                    <Text style={styles.smallBtnText}>Map</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {shops.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('shops_no_data')}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal animationType="none" transparent visible={modalVisible} onRequestClose={() => closeShopModal()}>
        <Animated.View style={[styles.modalBackdrop, { opacity: modalBackdropOpacity }]}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                transform: [
                  { scale: modalCardScale },
                  { translateY: modalCardTranslateY },
                ],
              },
            ]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHero}>
              <Text style={styles.modalEyebrow}>{editingShopId ? 'Update Details' : 'New Shop Entry'}</Text>
              <Text style={styles.modalTitle}>{editingShopId ? 'Edit Shop' : t('shops_modal_title')}</Text>
              <Text style={styles.modalSubtitle}>
                Save route, contact details, address, and a fresh photo in one place.
              </Text>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Route</Text>
                <Pressable onPress={() => setRoutePickerVisible(true)} style={[styles.input, styles.selectorInput]}>
                  <Text style={selectedRouteId ? styles.inputValue : styles.inputPlaceholder}>{selectedRouteName}</Text>
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Shop Name</Text>
                <TextInput
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder={t('shops_shop_name')}
                  style={styles.input}
                  placeholderTextColor="#8D95A3"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Shop Address</Text>
                <TextInput
                  value={shopAddress}
                  onChangeText={setShopAddress}
                  placeholder={t('shops_shop_address')}
                  style={[styles.input, styles.addressInput]}
                  multiline
                  placeholderTextColor="#8D95A3"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <TextInput
                  value={mobileNumber}
                  onChangeText={(value) => setMobileNumber(value.replace(/\D/g, ''))}
                  placeholder={t('shops_mobile_number')}
                  style={styles.input}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholderTextColor="#8D95A3"
                />
              </View>

              <View style={styles.photoSection}>
                <View>
                  <Text style={styles.fieldLabel}>Shop Photo</Text>
                  <Text style={styles.photoHint}>Camera capture only for clearer shop records.</Text>
                </View>
                {imageFile?.uri ? (
                  <Pressable onPress={() => openImagePreview(imageFile.uri)}>
                    <Image source={{ uri: imageFile.uri }} style={styles.previewImage} resizeMode="cover" />
                  </Pressable>
                ) : (
                  <View style={styles.emptyPreview}>
                    <Text style={styles.emptyPreviewTitle}>Photo preview will appear here</Text>
                    <Text style={styles.emptyPreviewText}>Capture the storefront or board so records stay easy to identify.</Text>
                  </View>
                )}
                <Pressable onPress={pickImage} style={styles.uploadBtn}>
                  <Text style={styles.uploadBtnText}>{imageFile?.uri ? t('shops_change_image') : t('shops_upload_image')}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => closeShopModal()} style={[styles.modalBtn, styles.cancelBtn]}>
                <Text style={styles.cancelText}>{t('common_cancel')}</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={onSaveShop} style={[styles.modalBtn, styles.primaryModalBtn]}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnText}>{editingShopId ? 'Update' : t('common_save')}</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={routePickerVisible}
        onRequestClose={() => setRoutePickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRoutePickerVisible(false)}>
          <Pressable style={styles.routePickerCard} onPress={() => {}}>
            <View style={styles.routePickerHeader}>
              <View style={styles.routePickerHandle} />
              <Text style={styles.routePickerEyebrow}>Choose Route</Text>
              <Text style={styles.routePickerTitle}>{t('shops_select_route')}</Text>
              <Text style={styles.routePickerSubtitle}>
                Pick the route this shop should belong to.
              </Text>
            </View>
            <ScrollView style={styles.routePickerList} showsVerticalScrollIndicator={false}>
              {routes.map((route) => (
                <Pressable
                  key={route._id}
                  onPress={() => {
                    setSelectedRouteId(route._id);
                    setRoutePickerVisible(false);
                  }}
                  style={[
                    styles.routeOption,
                    selectedRouteId === route._id ? styles.routeOptionActive : null,
                  ]}>
                  <Text
                    style={[
                      styles.routeOptionText,
                      selectedRouteId === route._id ? styles.routeOptionTextActive : null,
                    ]}>
                    {route.routeName} - {route.cityName}
                  </Text>
                </Pressable>
              ))}
              {routes.length === 0 ? <Text style={styles.emptyText}>{t('shops_no_routes')}</Text> : null}
            </ScrollView>
            <Pressable onPress={() => setRoutePickerVisible(false)} style={[styles.modalBtn, styles.routePickerCloseBtn]}>
              <Text style={styles.cancelText}>{t('common_close')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={imagePreviewVisible}
        onRequestClose={closeImagePreview}>
        <Pressable style={styles.imagePreviewBackdrop} onPress={closeImagePreview}>
          <Pressable style={styles.imagePreviewCard} onPress={() => {}}>
            {previewImageUri ? (
              <Image source={{ uri: previewImageUri }} style={styles.imagePreviewFull} resizeMode="contain" />
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
    backgroundColor: '#EAF4F1',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B5B35',
  },
  subtitle: {
    fontSize: 14,
    color: '#4D5B66',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#0F5D33',
    height: 40,
    minWidth: 100,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  listWrap: {
    paddingBottom: 120,
    gap: 12,
  },
  shopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D7E1E8',
  },
  shopImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#E6ECEF',
  },
  shopName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102131',
  },
  shopRoute: {
    marginTop: 4,
    fontSize: 14,
    color: '#0B5B35',
    fontWeight: '600',
  },
  shopAddress: {
    marginTop: 6,
    fontSize: 14,
    color: '#44525D',
  },
  shopPhone: {
    marginTop: 6,
    fontSize: 14,
    color: '#44525D',
    fontWeight: '600',
  },
  cardActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    backgroundColor: '#0F5D33',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deleteBtn: {
    backgroundColor: '#B73939',
  },
  mapBtn: {
    backgroundColor: '#1D4ED8',
  },
  smallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#5E6A75',
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 17, 28, 0.52)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  modalCard: {
    backgroundColor: '#FDFEFE',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D7E3DD',
    overflow: 'hidden',
    shadowColor: '#102131',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  routePickerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FCFDFD',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D7E3DD',
    overflow: 'hidden',
    shadowColor: '#102131',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  routePickerHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#F3F8F5',
    borderBottomWidth: 1,
    borderBottomColor: '#DCE7E1',
  },
  routePickerHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#C7D3DA',
    marginBottom: 10,
  },
  routePickerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#0B7A47',
    marginBottom: 5,
  },
  routePickerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#112332',
  },
  routePickerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: '#5C6B78',
  },
  routePickerList: {
    maxHeight: 280,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#C7D3DA',
    marginTop: 10,
  },
  modalHero: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#F3F8F5',
    borderBottomWidth: 1,
    borderBottomColor: '#DCE7E1',
  },
  modalEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#0B7A47',
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#112332',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: '#5C6B78',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D5E0E8',
    borderRadius: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#101827',
    backgroundColor: '#F8FBFC',
    justifyContent: 'center',
  },
  selectorInput: {
    paddingRight: 40,
  },
  inputPlaceholder: {
    color: '#8D95A3',
    fontSize: 16,
  },
  inputValue: {
    color: '#101827',
    fontSize: 16,
  },
  addressInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  photoSection: {
    marginTop: 2,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#F6FAF8',
    borderWidth: 1,
    borderColor: '#DDE8E3',
    gap: 10,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  photoHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
    maxWidth: 220,
  },
  uploadBtn: {
    backgroundColor: '#0F5D33',
    borderRadius: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewImage: {
    width: '100%',
    height: 132,
    borderRadius: 18,
    backgroundColor: '#E6ECEF',
  },
  imagePreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 20, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  imagePreviewCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0F1720',
  },
  imagePreviewFull: {
    width: '100%',
    height: 420,
    backgroundColor: '#0F1720',
  },
  emptyPreview: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8E4DE',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyPreviewText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
    textAlign: 'center',
  },
  routeOption: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    backgroundColor: '#F8FBFC',
    borderWidth: 1,
    borderColor: '#E3EBF0',
    marginBottom: 10,
  },
  routeOptionActive: {
    backgroundColor: '#E7F4EC',
    borderColor: '#0F5D33',
  },
  routeOptionText: {
    fontSize: 15,
    color: '#182430',
    fontWeight: '600',
  },
  routeOptionTextActive: {
    color: '#0B5B35',
  },
  routePickerCloseBtn: {
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E4ECE8',
    backgroundColor: '#FFFFFF',
  },
  modalBtn: {
    height: 48,
    minWidth: 118,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    flex: 1,
  },
  cancelBtn: {
    backgroundColor: '#EEF3F6',
  },
  primaryModalBtn: {
    backgroundColor: '#0F5D33',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelText: {
    color: '#2E3A4F',
    fontSize: 14,
    fontWeight: '700',
  },
});
