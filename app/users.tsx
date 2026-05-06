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
  View,
} from 'react-native';

import {
  clearAuthToken,
  getAdminUsers,
  getCurrentUser,
  type AdminUser,
  updateAdminUserStatus,
} from '@/services/api';
import { useI18n } from '@/constants/i18n';
import { router } from 'expo-router';

export default function UsersScreen() {
  const { t } = useI18n();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.roleId === 1;
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const result = await getAdminUsers();
    setLoading(false);

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        clearAuthToken();
        router.replace('/login');
        return;
      }
      Alert.alert(t('common_error'), result.message);
      return;
    }

    const list =
      result.data &&
      typeof result.data === 'object' &&
      'data' in result.data &&
      Array.isArray((result.data as { data?: unknown }).data)
        ? ((result.data as { data: AdminUser[] }).data ?? [])
        : [];

    setUsers(list);
  }, [t]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      router.replace('/login');
      return;
    }
    if (!isAdmin) {
      setLoading(false);
      router.replace('/(tabs)');
      return;
    }
    loadUsers();
  }, [currentUser, isAdmin, loadUsers]);

  const onToggleStatus = async (user: AdminUser) => {
    if (user.id === currentUser?.id && user.isActive) {
      Alert.alert(t('common_validation'), 'You cannot deactivate your own account.');
      return;
    }

    setUpdatingUserId(user.id);
    const result = await updateAdminUserStatus(user.id, !user.isActive);
    setUpdatingUserId(null);

    if (!result.ok) {
      Alert.alert(t('common_error'), result.message);
      return;
    }

    setUsers((prev) =>
      prev.map((item) => (item.id === user.id ? { ...item, isActive: !item.isActive } : item)),
    );
  };

  if (!currentUser || !isAdmin) {
    return null;
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.subtitle}>Manage account status</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F5D33" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listWrap} showsVerticalScrollIndicator={false}>
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
                <View style={[styles.statusPill, user.isActive ? styles.activePill : styles.inactivePill]}>
                  <Text style={[styles.statusText, user.isActive ? styles.activeText : styles.inactiveText]}>
                    {user.isActive ? 'Active' : 'Deactivated'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <Text style={styles.roleText}>{user.roleId === 1 ? t('profile_admin') : t('profile_user')}</Text>
                {user.roleId === 1 ? (
                  <Text style={styles.adminHint}>Admin account</Text>
                ) : (
                  <Pressable
                    onPress={() => onToggleStatus(user)}
                    disabled={updatingUserId === user.id}
                    style={[styles.actionBtn, user.isActive ? styles.deactivateBtn : styles.activateBtn]}>
                    {updatingUserId === user.id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.actionText}>{user.isActive ? 'Deactivate' : 'Activate'}</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          ))}
          {users.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
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
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B5B35',
  },
  subtitle: {
    marginTop: 2,
    color: '#5F6D78',
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listWrap: {
    paddingBottom: 120,
    gap: 10,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7E1E8',
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#102131',
  },
  userEmail: {
    marginTop: 2,
    fontSize: 13,
    color: '#556474',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  activePill: {
    backgroundColor: '#E8F5EE',
  },
  inactivePill: {
    backgroundColor: '#FDECEC',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeText: {
    color: '#0F5D33',
  },
  inactiveText: {
    color: '#B73939',
  },
  cardBottom: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E3A4F',
  },
  adminHint: {
    fontSize: 12,
    color: '#6A7781',
    fontWeight: '600',
  },
  actionBtn: {
    minWidth: 112,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  deactivateBtn: {
    backgroundColor: '#B73939',
  },
  activateBtn: {
    backgroundColor: '#0F5D33',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    color: '#5E6A75',
  },
});
