import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuth } from '@/services/auth-context';

export default function AdminLayout() {
  const { role } = useAuth();
  const segments = useSegments();
  const currentRoute = segments[segments.length - 1];

  // Allow login screen to be accessible without auth
  if (currentRoute !== 'login' && role !== 'admin') {
    return <Redirect href={"/admin/login" as any} />;
  }

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="customers" options={{ headerShown: false }} />
      <Stack.Screen name="customer-details" options={{ headerShown: false }} />
      <Stack.Screen name="record-purchase" options={{ headerShown: false }} />
      <Stack.Screen name="purchases" options={{ headerShown: false }} />
      <Stack.Screen name="redemptions" options={{ headerShown: false }} />
      <Stack.Screen name="point-rules" options={{ headerShown: false }} />
      <Stack.Screen name="audit-logs" options={{ headerShown: false }} />
    </Stack>
  );
}
