import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/constants/i18n';
import { clearAuthToken, getCurrentUser } from '@/services/api';

type SettingsSection = 'profile' | 'language' | 'logout';

export default function SettingsScreen() {
  const { language, setLanguage, t } = useI18n();
  const user = getCurrentUser();
  const [active, setActive] = useState<SettingsSection>('profile');

  const onLogout = () => {
    clearAuthToken();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.page}>
      <Text style={styles.title}>{t('settings_title')}</Text>

      <View style={styles.tabsRow}>
        <Pressable onPress={() => setActive('profile')} style={[styles.tabBtn, active === 'profile' && styles.tabBtnActive]}>
          <Text style={[styles.tabBtnText, active === 'profile' && styles.tabBtnTextActive]}>{t('settings_profile_tab')}</Text>
        </Pressable>
        <Pressable onPress={() => setActive('language')} style={[styles.tabBtn, active === 'language' && styles.tabBtnActive]}>
          <Text style={[styles.tabBtnText, active === 'language' && styles.tabBtnTextActive]}>{t('settings_language_tab')}</Text>
        </Pressable>
        <Pressable onPress={() => setActive('logout')} style={[styles.tabBtn, active === 'logout' && styles.tabBtnActive]}>
          <Text style={[styles.tabBtnText, active === 'logout' && styles.tabBtnTextActive]}>{t('settings_logout_tab')}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {active === 'profile' ? (
          <>
            <Text style={styles.sectionTitle}>{t('settings_profile_tab')}</Text>
            <Text style={styles.label}>{t('home_name')}</Text>
            <Text style={styles.value}>{user?.name ?? '-'}</Text>
            <Text style={styles.label}>{t('home_email')}</Text>
            <Text style={styles.value}>{user?.email ?? '-'}</Text>
            <Text style={styles.label}>{t('profile_role')}</Text>
            <Text style={styles.value}>{user?.roleId === 1 ? t('profile_admin') : t('profile_user')}</Text>
            <Pressable onPress={() => router.push('/profile')} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>{t('settings_open_profile')}</Text>
            </Pressable>
          </>
        ) : null}

        {active === 'language' ? (
          <>
            <Text style={styles.sectionTitle}>{t('settings_language_title')}</Text>
            <Text style={styles.hint}>{t('settings_choose_language')}</Text>
            <View style={styles.langRow}>
              <Pressable
                onPress={() => setLanguage('en')}
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]}>
                <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>English</Text>
              </Pressable>
              <Pressable
                onPress={() => setLanguage('gu')}
                style={[styles.langBtn, language === 'gu' && styles.langBtnActive]}>
                <Text style={[styles.langBtnText, language === 'gu' && styles.langBtnTextActive]}>ગુજરાતી</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {active === 'logout' ? (
          <>
            <Text style={styles.sectionTitle}>{t('settings_logout_title')}</Text>
            <Text style={styles.hint}>{t('settings_logout_message')}</Text>
            <Pressable onPress={onLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>{t('profile_logout')}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B5B35',
    marginBottom: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E6EDF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#0F5D33',
  },
  tabBtnText: {
    color: '#34424F',
    fontWeight: '700',
    fontSize: 12,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D7E1E8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#112332',
    marginBottom: 10,
  },
  hint: {
    fontSize: 14,
    color: '#5F6D78',
    marginBottom: 10,
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
  actionBtn: {
    marginTop: 16,
    backgroundColor: '#0F5D33',
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  langBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#C9D4DE',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  langBtnActive: {
    borderColor: '#0F5D33',
    backgroundColor: '#E8F5EE',
  },
  langBtnText: {
    fontSize: 14,
    color: '#2E3A4F',
    fontWeight: '700',
  },
  langBtnTextActive: {
    color: '#0F5D33',
  },
  logoutBtn: {
    marginTop: 12,
    backgroundColor: '#B73939',
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
