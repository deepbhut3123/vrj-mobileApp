import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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

import { useI18n } from '@/constants/i18n';
import { createRoute, getCurrentUser, getMyRoutes, type AppRoute } from '@/services/api';

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

export default function RouteAddScreen() {
  const { language, t } = useI18n();
  const user = getCurrentUser();
  const insets = useSafeAreaInsets();
  const [routeName, setRouteName] = useState('');
  const [routeNameGujarati, setRouteNameGujarati] = useState('');
  const [cityName, setCityName] = useState('');
  const [cityNameGujarati, setCityNameGujarati] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routes, setRoutes] = useState<AppRoute[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const modalBackdropOpacity = useRef(new Animated.Value(0)).current;
  const modalCardScale = useRef(new Animated.Value(0.94)).current;
  const modalCardTranslateY = useRef(new Animated.Value(26)).current;

  const modalTitle = useMemo(() => t('routes_modal_add'), [t]);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    const result = await getMyRoutes();
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
        ? ((payload as { data: AppRoute[] }).data ?? [])
        : [];

    setRoutes(list);
  }, [t]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void loadRoutes();
  }, [loadRoutes, user]);

  const refreshScreen = useCallback(async () => {
    setRefreshing(true);
    await loadRoutes();
    setRefreshing(false);
  }, [loadRoutes]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        return;
      }
      void refreshScreen();
    }, [refreshScreen, user]),
  );

  const animateRouteModalIn = useCallback(() => {
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

  const openRouteModal = useCallback(() => {
    setModalVisible(true);
    requestAnimationFrame(() => {
      animateRouteModalIn();
    });
  }, [animateRouteModalIn]);

  const closeRouteModal = useCallback((afterClose?: () => void) => {
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

  const saveRoute = async () => {
    const name = routeName.trim();
    const gujaratiName = routeNameGujarati.trim();
    const city = cityName.trim();
    const gujaratiCity = cityNameGujarati.trim();
    if (!name || !city) {
      Alert.alert(t('common_validation'), t('routes_validation_fields'));
      return;
    }

    setSaving(true);
    const result = await createRoute({
      routeName: name,
      routeNameGujarati: gujaratiName,
      cityName: city,
      cityNameGujarati: gujaratiCity,
    });
    setSaving(false);

    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    setRouteName('');
    setRouteNameGujarati('');
    setCityName('');
    setCityNameGujarati('');
    closeRouteModal();
    await loadRoutes();
    Alert.alert(t('routes_modal_add'), result.message);
  };

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 120) }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refreshScreen()} tintColor="#0F5D33" />
        }>
        <View style={styles.headerRow}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>{t('routes_title')}</Text>
            <Text style={styles.subtitle}>Create a route to use while adding shops.</Text>
          </View>
          <Pressable disabled={saving} onPress={openRouteModal} style={styles.addButton}>
            <Text style={styles.addButtonText}>{t('routes_add')}</Text>
          </Pressable>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>{t('routes_title')}</Text>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#0F5D33" />
            </View>
          ) : routes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('routes_no_data')}</Text>
            </View>
          ) : (
            routes.map((route, index) => (
              <View key={route._id} style={styles.routeCard}>
                <View style={styles.routeIndex}>
                  <Text style={styles.routeIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeName}>
                    {pickLocalizedValue(language, route.routeName, route.routeNameGujarati)}
                  </Text>
                  <Text style={styles.routeCity}>
                    {pickLocalizedValue(language, route.cityName, route.cityNameGujarati)}
                  </Text>
                  <Text style={styles.routeDate}>
                    {new Date(route.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal animationType="none" transparent visible={modalVisible} onRequestClose={() => closeRouteModal()}>
        <Animated.View
          style={[
            styles.modalBackdrop,
            {
              opacity: modalBackdropOpacity,
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
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
              <Text style={styles.modalEyebrow}>New Route Entry</Text>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Text style={styles.modalSubtitle}>
                Save both English and Gujarati names so route lists follow the selected app language.
              </Text>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={styles.modalBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('routes_col_name')}</Text>
                  <TextInput
                    value={routeName}
                    onChangeText={setRouteName}
                    placeholder={t('routes_col_name')}
                    placeholderTextColor="#8D95A3"
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('routes_col_name_gujarati')}</Text>
                  <TextInput
                    value={routeNameGujarati}
                    onChangeText={setRouteNameGujarati}
                    placeholder={t('routes_col_name_gujarati')}
                    placeholderTextColor="#8D95A3"
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('routes_city_name')}</Text>
                  <TextInput
                    value={cityName}
                    onChangeText={setCityName}
                    placeholder={t('routes_city_name')}
                    placeholderTextColor="#8D95A3"
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('routes_city_name_gujarati')}</Text>
                  <TextInput
                    value={cityNameGujarati}
                    onChangeText={setCityNameGujarati}
                    placeholder={t('routes_city_name_gujarati')}
                    placeholderTextColor="#8D95A3"
                    style={styles.input}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <Pressable onPress={() => closeRouteModal()} style={[styles.modalBtn, styles.cancelBtn]}>
                <Text style={styles.cancelText}>{t('common_cancel')}</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={saveRoute} style={[styles.modalBtn, styles.primaryModalBtn]}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnText}>{t('common_save')}</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#EAF4F1',
    paddingHorizontal: 18,
  },
  content: {
    paddingBottom: 120,
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
  listSection: {
    marginTop: 6,
  },
  listTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B5B35',
    marginBottom: 12,
  },
  label: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  nextLabel: {
    marginTop: 16,
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
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D7E3DD',
    padding: 18,
  },
  emptyText: {
    fontSize: 15,
    color: '#5D6B74',
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D7E3DD',
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  routeIndex: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeIndexText: {
    color: '#0F5D33',
    fontSize: 15,
    fontWeight: '800',
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#143728',
  },
  routeCity: {
    marginTop: 4,
    fontSize: 14,
    color: '#4D5B66',
    fontWeight: '600',
  },
  routeDate: {
    marginTop: 6,
    fontSize: 12,
    color: '#7A8791',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 17, 28, 0.52)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
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
  modalScrollView: {
    flexShrink: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingTop: 2,
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
