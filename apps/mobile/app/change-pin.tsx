import { useCallback, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, Redirect, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import {
  AuthPage,
  InlineNotice,
  PageHeading,
  PrimaryButton,
  TextButton,
  TextField,
} from '@/components/primitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/services/auth-context';
import { changePin, getStoredToken } from '@/services/api';
import { supabase } from '@/services/supabase';
import { phoneToEmail } from '@/utils/phone';

export const CHANGE_PIN_TEXT = {
  title: 'Badilisha PIN yako / Change your PIN',
  explanation:
    'Kwa usalama, lazima ubadilishe PIN ya mwanzo kabla ya kuendelea / For security you must change your starting PIN before continuing',
  currentPin: 'PIN ya sasa / Current PIN',
  newPin: 'PIN mpya / New PIN',
  confirmPin: 'Thibitisha PIN mpya / Confirm new PIN',
  submit: 'Badilisha PIN / Change PIN',
  logout: 'Toka / Log out',
  success: 'PIN imebadilishwa kwa mafanikio / PIN changed successfully',
  validationPin: 'Weka PIN yenye tarakimu 6 / Enter a 6-digit PIN.',
  validationServer:
    'PIN lazima iwe na tarakimu 6 / PIN must contain exactly 6 digits.',
  validationMatch: 'PIN mpya hazilingani / New PINs do not match.',
  validationSame: 'PIN mpya lazima iwe tofauti / New PIN must be different.',
  invalidCurrent:
    'PIN ya sasa si sahihi. Jaribu tena / Current PIN is incorrect. Please try again.',
  weak:
    'Chagua PIN imara zaidi, epuka tarakimu zinazofanana au mfuatano / Choose a stronger PIN; avoid repeated digits or sequences.',
  same:
    'PIN mpya lazima iwe tofauti na ya sasa / New PIN must differ from your current PIN.',
  limited:
    'Umejaribu mara nyingi. Subiri dakika 15 ujaribu tena / Too many attempts. Please wait 15 minutes and try again.',
  required:
    'Lazima ubadilishe PIN kabla ya kuendelea / You must change your PIN before continuing.',
  generic:
    'Imeshindikana kubadilisha PIN. Jaribu tena / Could not change PIN. Please try again.',
  signIn:
    'PIN imebadilishwa lakini kuingia upya kumeshindikana. Jaribu kuingia tena / PIN changed, but signing in again failed. Please log in again.',
  show: 'Onyesha PIN / Show PIN',
  hide: 'Ficha PIN / Hide PIN',
} as const;

function getChangePinError(error: unknown): string {
  const code = axios.isAxiosError(error)
    ? String(error.response?.data?.error?.code || '')
    : '';

  switch (code) {
    case 'INVALID_CURRENT_PIN':
      return CHANGE_PIN_TEXT.invalidCurrent;
    case 'WEAK_PIN':
      return CHANGE_PIN_TEXT.weak;
    case 'SAME_PIN':
      return CHANGE_PIN_TEXT.same;
    case 'PIN_CHANGE_RATE_LIMITED':
      return CHANGE_PIN_TEXT.limited;
    case 'PIN_CHANGE_REQUIRED':
      return CHANGE_PIN_TEXT.required;
    case 'VALIDATION_ERROR':
      return CHANGE_PIN_TEXT.validationServer;
    default:
      return CHANGE_PIN_TEXT.generic;
  }
}

export default function ChangePinScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { phone, role, status, mustChangePin, signIn, signOut, showPinChangeSuccess } =
    useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [visible, setVisible] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []));

  if (status === 'restoring') return null;
  if (status !== 'signed-in') {
    return <Redirect href={role === 'admin' ? '/admin/login' : '/(auth)/welcome'} />;
  }
  if (!mustChangePin) {
    return <Redirect href={role === 'admin' ? '/admin/dashboard' : '/(tabs)'} />;
  }

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setErrorMessage(null);

    if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin) || !/^\d{6}$/.test(confirmPin)) {
      setErrorMessage(CHANGE_PIN_TEXT.validationPin);
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMessage(CHANGE_PIN_TEXT.validationMatch);
      return;
    }
    if (newPin === currentPin) {
      setErrorMessage(CHANGE_PIN_TEXT.validationSame);
      return;
    }
    if (!phone) {
      setErrorMessage(CHANGE_PIN_TEXT.generic);
      return;
    }

    setLoading(true);
    try {
      const result = await changePin(currentPin, newPin);

      try {
        await supabase.auth.signInWithPassword({
          email: phoneToEmail(phone),
          password: newPin,
        });
      } catch {
        // Ignored if email provider is disabled in Supabase
      }

      queryClient.clear();
      const token = result?.token || (await getStoredToken());
      if (!token) {
        throw new Error('Missing access token');
      }

      const me = await signIn(token);
      showPinChangeSuccess();
      router.replace(me.role === 'admin' ? '/admin/dashboard' : '/(tabs)');
    } catch (error) {
      setErrorMessage(
        error instanceof Error && !('response' in error)
          ? CHANGE_PIN_TEXT.signIn
          : getChangePinError(error),
      );
    } finally {
      setLoading(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    }
  };

  const handleLogout = async () => {
    try {
      const wasAdmin = role === 'admin';
      await signOut();
      router.replace(wasAdmin ? '/admin/login' : '/(auth)/welcome');
    } catch {
      setErrorMessage(CHANGE_PIN_TEXT.generic);
    }
  };

  const pinVisibilityButton = (field: 'current' | 'new' | 'confirm') => (
    <Pressable
      onPress={() => setVisible((state) => ({ ...state, [field]: !state[field] }))}
      accessibilityRole="button"
      accessibilityLabel={visible[field] ? CHANGE_PIN_TEXT.hide : CHANGE_PIN_TEXT.show}
      style={styles.visibilityButton}
    >
      <Feather
        name={visible[field] ? 'eye-off' : 'eye'}
        size={20}
        color={colors.mutedForeground}
      />
    </Pressable>
  );

  return (
    <AuthPage>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <PageHeading title={CHANGE_PIN_TEXT.title} description={CHANGE_PIN_TEXT.explanation} />
          <View style={styles.fields}>
            <TextField
              label={CHANGE_PIN_TEXT.currentPin}
              value={currentPin}
              onChangeText={(value) => setCurrentPin(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry={!visible.current}
              placeholder="••••••"
              rightElement={pinVisibilityButton('current')}
            />
            <TextField
              label={CHANGE_PIN_TEXT.newPin}
              value={newPin}
              onChangeText={(value) => setNewPin(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry={!visible.new}
              placeholder="••••••"
              rightElement={pinVisibilityButton('new')}
            />
            <TextField
              label={CHANGE_PIN_TEXT.confirmPin}
              value={confirmPin}
              onChangeText={(value) => setConfirmPin(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry={!visible.confirm}
              placeholder="••••••"
              rightElement={pinVisibilityButton('confirm')}
            />
          </View>

          {errorMessage ? <InlineNotice message={errorMessage} tone="warning" /> : null}

          <View style={styles.actions}>
            <PrimaryButton
              label={CHANGE_PIN_TEXT.submit}
              onPress={() => void handleSubmit()}
              loading={loading}
            />
            <TextButton
              label={CHANGE_PIN_TEXT.logout}
              disabled={loading}
              onPress={() => void handleLogout()}
            />
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: 26,
    paddingVertical: 28,
  },
  fields: {
    gap: 18,
  },
  visibilityButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: 12,
  },
});
