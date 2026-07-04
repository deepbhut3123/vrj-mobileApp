import { router } from 'expo-router';
import { Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/constants/i18n';
import { getCurrentUser, getRoleLabel, logoutCurrentUser } from '@/services/api';

export default function SettingsScreen() {
  const { language, setLanguage, t } = useI18n();
  const user = getCurrentUser();
  const roleLabel = getRoleLabel(user?.roleId);
  const initials = (user?.name ?? 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const onLogout = async () => {
    await logoutCurrentUser();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings_title')}</Text>
          <Text style={styles.subtitle}>{t('profile_subtitle')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings_profile_tab')}</Text>
          <View style={styles.profileHero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || 'U'}</Text>
            </View>

            <View style={styles.profileSummary}>
              <Text style={styles.profileName}>{user?.name ?? '-'}</Text>
              <Text style={styles.profileEmail}>{user?.email ?? '-'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('home_name')}</Text>
              <Text style={styles.infoValue}>{user?.name ?? '-'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('home_email')}</Text>
              <Text style={styles.infoValue}>{user?.email ?? '-'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('profile_role')}</Text>
              <Text style={styles.infoValue}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings_language_title')}</Text>
          <Text style={styles.hint}>{t('settings_choose_language')}</Text>
          <View style={styles.langRow}>
            <Pressable onPress={() => setLanguage('en')} style={[styles.langBtn, language === 'en' && styles.langBtnActive]}>
              <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>English</Text>
            </Pressable>
            <Pressable onPress={() => setLanguage('gu')} style={[styles.langBtn, language === 'gu' && styles.langBtnActive]}>
              <Text style={[styles.langBtnText, language === 'gu' && styles.langBtnTextActive]}>Gujarati</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings_logout_title')}</Text>
          <Text style={styles.hint}>{t('settings_logout_message')}</Text>
          <Pressable onPress={onLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>{t('profile_logout')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#EAF4F1',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
    paddingBottom: 28,
    gap: 14,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B5B35',
  },
  subtitle: {
    fontSize: 14,
    color: '#5F6D78',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D7E1E8',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#112332',
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0F5D33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  profileSummary: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#182430',
  },
  profileEmail: {
    fontSize: 14,
    color: '#5F6D78',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E8F5EE',
  },
  roleBadgeText: {
    color: '#0F5D33',
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    borderWidth: 1,
    borderColor: '#E1E8EE',
    borderRadius: 14,
    overflow: 'hidden',
  },
  infoRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#5F6D78',
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 16,
    color: '#182430',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8EEF2',
  },
  hint: {
    fontSize: 14,
    color: '#5F6D78',
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#C9D4DE',
    borderRadius: 12,
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
    marginTop: 4,
    backgroundColor: '#B73939',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
