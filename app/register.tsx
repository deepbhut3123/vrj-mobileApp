import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { register } from '@/services/api';

export default function RegisterScreen() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('common_validation'), 'Please fill name, email, and password.');
      return;
    }

    setSubmitting(true);
    const result = await register(name.trim(), email.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      Alert.alert(t('register_failed'), result.message);
      return;
    }

    Alert.alert(t('register_success_title'), result.message || t('register_success_message'));
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}>
        <View style={styles.card}>
          <Image
            source={require('../assets/images/image.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.heading}>{t('register_title')}</Text>
          <Text style={styles.subheading}>{t('register_subtitle')}</Text>

          <TextInput
            onChangeText={setName}
            placeholder={t('register_full_name')}
            placeholderTextColor="#8D95A3"
            style={styles.input}
            value={name}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder={t('auth_email')}
            placeholderTextColor="#8D95A3"
            style={styles.input}
            value={email}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setPassword}
            placeholder={t('auth_password')}
            placeholderTextColor="#8D95A3"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <Pressable disabled={submitting} onPress={onRegister} style={styles.primaryButton}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('auth_register')}</Text>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/" style={styles.footerAction}>
              Sign In
            </Link>
          </View>
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
  logo: {
    width: '100%',
    height: 92,
    marginBottom: 10,
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
    marginBottom: 12,
  },
  primaryButton: {
    marginTop: 6,
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
  footerRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#2E3A4F',
  },
  footerAction: {
    fontSize: 16,
    color: '#0D5F37',
    fontWeight: '700',
  },
});
