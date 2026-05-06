import RoutesScreen from '../routes';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getCurrentUser } from '@/services/api';

export default function AdminRoutesTab() {
  const router = useRouter();
  const user = getCurrentUser();

  useEffect(() => {
    if (!user || user.roleId !== 1) {
      router.replace('/(tabs)');
    }
  }, [router, user]);

  if (!user || user.roleId !== 1) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EAF4F1' }}>
        <ActivityIndicator size="large" color="#0E6C50" />
      </View>
    );
  }

  return <RoutesScreen />;
}
