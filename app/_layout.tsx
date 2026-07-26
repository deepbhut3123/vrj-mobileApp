import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { I18nProvider } from '@/constants/i18n';
import * as apiService from '@/services/api';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      if (typeof apiService.hydrateAuthSession === 'function') {
        await apiService.hydrateAuthSession();
      }
      if (mounted) {
        setReady(true);
      }
    };
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EAF4F1' }}>
        <ActivityIndicator size="large" color="#0E6C50" />
      </View>
    );
  }

  return (
    <I18nProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="dealer-statement" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="dark" />
    </I18nProvider>
  );
}
