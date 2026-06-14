import { Link, router } from 'expo-router';
import { useState } from 'react';
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
import { forgotPassword, verifyResetOtp } from '@/services/api';

export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert(t('forgot_missing_email_title'), t('forgot_missing_email_message'));
      return;
    }

    setSubmitting(true);
    const result = await forgotPassword(email.trim());
    setSubmitting(false);

    if (!result.ok) {
      Alert.alert(t('forgot_failed'), result.message);
      return;
    }

    setOtpStep(true);
    Alert.alert(t('forgot_success_title'), result.message || t('forgot_otp_sent_message'));
  };

  const onVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert(t('common_validation'), t('forgot_missing_otp'));
      return;
    }

    setSubmitting(true);
    const result = await verifyResetOtp(email.trim(), otp.trim());
    setSubmitting(false);

    if (!result.ok) {
      Alert.alert(t('forgot_failed'), result.message);
      return;
    }

    const resetToken =
      result.data && typeof result.data === 'object' && 'resetToken' in result.data
        ? String(result.data.resetToken || '')
        : '';

    if (!resetToken) {
      Alert.alert(t('forgot_failed'), t('forgot_missing_reset_token'));
      return;
    }

    Alert.alert(t('forgot_otp_verified_title'), result.message || t('forgot_otp_verified_message'), [
      {
        text: t('common_close'),
        onPress: () => router.push({ pathname: '/reset-password', params: { token: resetToken } }),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}>
        <View style={styles.card}>
          <Text style={styles.heading}>{t('forgot_title')}</Text>
          <Text style={styles.subheading}>{otpStep ? t('forgot_enter_otp') : t('forgot_subtitle')}</Text>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder={t('auth_email')}
            placeholderTextColor="#8D95A3"
            style={styles.input}
            value={email}
            editable={!otpStep}
          />

          {otpStep ? (
            <>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setOtp}
                placeholder={t('forgot_otp_placeholder')}
                placeholderTextColor="#8D95A3"
                style={styles.input}
                value={otp}
              />

              <Pressable disabled={submitting} onPress={onVerifyOtp} style={styles.primaryButton}>
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>{t('forgot_verify_otp')}</Text>
                )}
              </Pressable>
            </>
          ) : (
            <Pressable disabled={submitting} onPress={onSendOtp} style={styles.primaryButton}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('forgot_send_link')}</Text>
              )}
            </Pressable>
          )}

          <Link href="/" style={styles.backLink}>
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
  },
  primaryButton: {
    marginTop: 14,
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
