import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useI18n } from '@/constants/i18n';
import { resetPassword } from '@/services/api';

export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const initialToken = useMemo(() => {
    const value = params.token;
    return Array.isArray(value) ? value[0] || '' : value || '';
  }, [params.token]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!initialToken.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert(t('common_validation'), t('reset_missing_fields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('common_validation'), t('reset_password_mismatch'));
      return;
    }

    setSubmitting(true);
    const result = await resetPassword(initialToken.trim(), newPassword);
    setSubmitting(false);

    if (!result.ok) {
      Alert.alert(t('reset_failed'), result.message);
      return;
    }

    Alert.alert(t('reset_success_title'), result.message || t('reset_success_message'), [
      {
        text: t('common_close'),
        onPress: () => router.replace('/login'),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}>
        <View style={styles.card}>
          <Text style={styles.heading}>{t('reset_title')}</Text>
          <Text style={styles.subheading}>{t('reset_subtitle')}</Text>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setNewPassword}
            placeholder={t('reset_new_password')}
            placeholderTextColor="#8D95A3"
            secureTextEntry
            style={styles.input}
            value={newPassword}
          />

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setConfirmPassword}
            placeholder={t('reset_confirm_password')}
            placeholderTextColor="#8D95A3"
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
          />

          <Pressable disabled={submitting} onPress={onSubmit} style={styles.primaryButton}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('reset_submit')}</Text>
            )}
          </Pressable>

          <Link href="/login" style={styles.backLink}>
            {t('forgot_back_signin')}
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#7FD0C2',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#F5F7FA',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  heading: {
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '700',
    color: '#09101D',
  },
  subheading: {
    textAlign: 'center',
    fontSize: 17,
    color: '#556070',
    marginTop: 6,
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CFD6DF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
    fontSize: 17,
    color: '#101827',
    backgroundColor: '#FFFFFF',
    marginTop: 12,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#0F5D33',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  backLink: {
    marginTop: 16,
    textAlign: 'center',
    color: '#0D5F37',
    fontWeight: '700',
    fontSize: 16,
  },
});
