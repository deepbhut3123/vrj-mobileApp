import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { createRoute, getCurrentUser, getMyRoutes, type AppRoute } from '@/services/api';

export default function RouteAddScreen() {
  const { t } = useI18n();
  const user = getCurrentUser();
  const [routeName, setRouteName] = useState('');
  const [cityName, setCityName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<AppRoute[]>([]);

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

  const saveRoute = async () => {
    const name = routeName.trim();
    const city = cityName.trim();
    if (!name || !city) {
      Alert.alert(t('common_validation'), t('routes_validation_fields'));
      return;
    }

    setSaving(true);
    const result = await createRoute(name, city);
    setSaving(false);

    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    setRouteName('');
    setCityName('');
    await loadRoutes();
    Alert.alert(t('routes_modal_add'), result.message);
  };

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('routes_title')}</Text>
          <Text style={styles.subtitle}>Create a route to use while adding shops.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('routes_col_name')}</Text>
          <TextInput
            value={routeName}
            onChangeText={setRouteName}
            placeholder={t('routes_col_name')}
            placeholderTextColor="#8D95A3"
            style={styles.input}
          />
          <Text style={[styles.label, styles.nextLabel]}>{t('routes_city_name')}</Text>
          <TextInput
            value={cityName}
            onChangeText={setCityName}
            placeholder={t('routes_city_name')}
            placeholderTextColor="#8D95A3"
            style={styles.input}
          />
          <Pressable disabled={saving} onPress={saveRoute} style={styles.button}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t('routes_add')}</Text>
            )}
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
                  <Text style={styles.routeName}>{route.routeName}</Text>
                  <Text style={styles.routeCity}>{route.cityName}</Text>
                  <Text style={styles.routeDate}>
                    {new Date(route.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#EAF4F1',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
  },
  content: {
    paddingBottom: 120,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0B5B35',
  },
  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: '#4D5B66',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D7E3DD',
    padding: 18,
  },
  listSection: {
    marginTop: 18,
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
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D5E0E8',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F8FBFC',
    color: '#101827',
    fontSize: 16,
  },
  button: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F5D33',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
});
