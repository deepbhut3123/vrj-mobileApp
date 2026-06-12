import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/constants/i18n';
import { clearAuthToken, getCurrentUser } from '@/services/api';

export default function ProfileScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const user = getCurrentUser();

  const onLogout = () => {
    clearAuthToken();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('profile_title')}</Text>
        <Text style={styles.subtitle}>{t('profile_subtitle')}</Text>

        <View style={styles.userBlock}>
          <Text style={styles.label}>{t('home_name')}</Text>
          <Text style={styles.value}>{user?.name ?? 'User'}</Text>
          <Text style={styles.label}>{t('home_email')}</Text>
          <Text style={styles.value}>{user?.email ?? '-'}</Text>
          <Text style={styles.label}>{t('profile_role')}</Text>
          <Text style={styles.value}>{t('profile_user')}</Text>
        </View>

        <Pressable onPress={onLogout} style={styles.button}>
          <Text style={styles.buttonText}>{t('profile_logout')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#EAF4F1',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0B5B35',
  },
  subtitle: {
    marginTop: 6,
    color: '#4B5B68',
    fontSize: 16,
  },
  userBlock: {
    marginTop: 16,
    backgroundColor: '#F3F7F6',
    borderRadius: 12,
    padding: 12,
  },
  label: {
    fontSize: 12,
    color: '#5F6D78',
    fontWeight: '700',
    marginTop: 6,
  },
  value: {
    fontSize: 16,
    color: '#182430',
    marginTop: 2,
  },
  button: {
    marginTop: 18,
    backgroundColor: '#B73939',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
