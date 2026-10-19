import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IosInstallBanner } from '@/components/ios-install-banner';
import { AppReleaseManager } from '@/components/app-release-manager';
import { AuthProvider } from '@/services/auth-context';
import { configureApiClient } from '@/services/api';
import { useColors } from '@/hooks/useColors';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import initI18n from '@/i18n';
import { useAuth } from '@/services/auth-context';

const PIN_CHANGE_SUCCESS_MESSAGE =
  'PIN imebadilishwa kwa mafanikio / PIN changed successfully';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});
configureApiClient();

function RootLayoutNav() {
  const colors = useColors();
  const segments = useSegments();
  const { mustChangePin, status } = useAuth();

  useEffect(() => {
    if (status === 'restoring') return;

    const rootSegment = (segments as string[])[0];

    if (status === 'signed-in' && mustChangePin) {
      if (rootSegment !== 'change-pin') {
        router.replace('/change-pin' as any);
      }
    }
  }, [status, mustChangePin, segments]);

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="change-pin" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="transactions"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="redeem"
        options={{
          headerShown: false,
          presentation: 'modal',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="deletion-request"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}

function AppProviders() {
  const colors = useColors();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function AuthenticatedApp() {
  const { mustChangePin } = useAuth();
  return (
    <>
      <RootLayoutNav />
      <PinChangeSuccessNotice />
      {!mustChangePin ? (
        <>
          <IosInstallBanner />
          <AppReleaseManager />
        </>
      ) : null}
    </>
  );
}

function PinChangeSuccessNotice() {
  const { pinChangeSuccess } = useAuth();
  if (!pinChangeSuccess) return null;

  return (
    <View pointerEvents="none" style={styles.successToast}>
      <Text style={styles.successToastText}>
        {PIN_CHANGE_SUCCESS_MESSAGE}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [i18nInitialized, setI18nInitialized] = useState(false);

  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('Service worker registration failed', error);
      });
    }
  }, []);

  useEffect(() => {
    initI18n().then(() => setI18nInitialized(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;
  if (!i18nInitialized) return null;

  return (
    <SafeAreaProvider>
      <View
        style={Platform.OS === 'web' ? styles.webShell : styles.nativeShell}
      >
        <View
          style={Platform.OS === 'web' ? styles.webAppFrame : styles.nativeAppFrame}
        >
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AppProviders />
            </QueryClientProvider>
          </ErrorBoundary>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webShell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  webAppFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FAFAFA',
  },
  nativeShell: {
    flex: 1,
  },
  nativeAppFrame: {
    flex: 1,
    width: '100%',
  },
  successToast: {
    position: 'absolute',
    top: 48,
    left: 20,
    right: 20,
    zIndex: 10,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#236B45',
  },
  successToastText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});
