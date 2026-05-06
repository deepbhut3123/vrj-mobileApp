import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { useI18n } from '@/constants/i18n';
import {
  type AppRoute,
  createAdminRoute,
  deleteAdminRouteById,
  getAdminRouteById,
  getAllAdminRoutes,
  getCurrentUser,
  updateAdminRouteById,
} from '@/services/api';

export default function RoutesScreen() {
  const { t } = useI18n();
  const user = getCurrentUser();
  const isAdmin = user?.roleId === 1;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routes, setRoutes] = useState<AppRoute[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    const result = await getAllAdminRoutes();
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
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadRoutes();
  }, [isAdmin, loadRoutes]);

  const openCreateModal = () => {
    setEditingId(null);
    setRouteName('');
    setModalVisible(true);
  };

  const openEditModal = async (id: string) => {
    const result = await getAdminRouteById(id);
    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    const payload = result.data;
    const route =
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      (payload as { data?: AppRoute }).data
        ? (payload as { data: AppRoute }).data
        : null;

    if (!route) {
      Alert.alert(t('common_error'), t('routes_not_found'));
      return;
    }

    setEditingId(route._id);
    setRouteName(route.routeName);
    setModalVisible(true);
  };

  const saveRoute = async () => {
    const trimmed = routeName.trim();
    if (!trimmed) {
      Alert.alert(t('common_validation'), t('routes_validation_name'));
      return;
    }

    setSaving(true);

    const result = editingId
      ? await updateAdminRouteById(editingId, trimmed)
      : await createAdminRoute(trimmed);

    setSaving(false);

    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    setModalVisible(false);
    setRouteName('');
    setEditingId(null);
    await loadRoutes();
  };

  const removeRoute = (id: string) => {
    Alert.alert('Delete route', 'Are you sure you want to delete this route?', [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteAdminRouteById(id);
          if (!result.ok) {
            Alert.alert(t('common_error'), result.message);
            return;
          }
          await loadRoutes();
        },
      },
    ]);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{t('routes_login_required')}</Text>
          <Text style={styles.subtitle}>{t('routes_signin_first')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{t('routes_no_access')}</Text>
          <Text style={styles.subtitle}>{t('routes_admin_only')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{t('routes_title')}</Text>
          <Text style={styles.subtitle}>{t('routes_subtitle')}</Text>
        </View>
        <Pressable onPress={openCreateModal} style={styles.addButton}>
          <Text style={styles.addButtonText}>{t('routes_add')}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F5D33" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listWrap}>
          {routes.map((item, index) => (
            <View key={item._id} style={styles.routeCard}>
              <View style={styles.routeCardTop}>
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeText}>{index + 1}</Text>
                </View>
                <View style={styles.routeCardHeaderText}>
                  <Text style={styles.routeName}>{item.routeName}</Text>
                  <Text style={styles.routeCreated}>
                    {t('routes_col_created')}: {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={styles.routeMetaRow}>
                <Text style={styles.routeMetaLabel}>{t('routes_col_no')}</Text>
                <Text style={styles.routeMetaValue}>#{index + 1}</Text>
              </View>
              <View style={styles.routeActions}>
                <Pressable onPress={() => openEditModal(item._id)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>{t('routes_edit')}</Text>
                </Pressable>
                <Pressable onPress={() => removeRoute(item._id)} style={[styles.smallBtn, styles.deleteBtn]}>
                  <Text style={styles.smallBtnText}>{t('routes_delete')}</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {routes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('routes_no_data')}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHero}>
              <Text style={styles.modalEyebrow}>{editingId ? 'Update Route' : 'New Route'}</Text>
              <Text style={styles.modalTitle}>{editingId ? t('routes_modal_edit') : t('routes_modal_add')}</Text>
              <Text style={styles.modalSubtitle}>
                Keep route names short and clear so the shop team can find them quickly.
              </Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>{t('routes_col_name')}</Text>
              <TextInput
                value={routeName}
                onChangeText={setRouteName}
                placeholder={t('routes_col_name')}
                style={styles.input}
                placeholderTextColor="#8D95A3"
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModalVisible(false)} style={[styles.modalBtn, styles.cancelBtn]}>
                <Text style={styles.cancelText}>{t('common_cancel')}</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={saveRoute} style={[styles.modalBtn, styles.primaryBtn]}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnText}>{editingId ? t('routes_edit') : t('common_save')}</Text>
                )}
              </Pressable>
            </View>
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
    height: 42,
    minWidth: 92,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  listWrap: {
    paddingBottom: 28,
    gap: 12,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D7E1E8',
    padding: 14,
  },
  routeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E7F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B5B35',
  },
  routeCardHeaderText: {
    flex: 1,
  },
  routeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#132433',
  },
  routeCreated: {
    marginTop: 4,
    fontSize: 13,
    color: '#5D6C79',
  },
  routeMetaRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E7EDF2',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeMetaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6A7781',
  },
  routeMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C2D3A',
  },
  routeActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    flex: 1,
    backgroundColor: '#0F5D33',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#B73939',
  },
  smallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 36,
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
  },
  modalCard: {
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
  modalHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#C7D3DA',
    marginTop: 12,
  },
  modalHero: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
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
    paddingTop: 16,
    paddingBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D5E0E8',
    borderRadius: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#101827',
    backgroundColor: '#F8FBFC',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E4ECE8',
    backgroundColor: '#FFFFFF',
  },
  modalBtn: {
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    flex: 1,
  },
  cancelBtn: {
    backgroundColor: '#E8EDF3',
  },
  primaryBtn: {
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
