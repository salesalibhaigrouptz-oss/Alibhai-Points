import { zodResolver } from "@hookform/resolvers/zod";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  Redirect,
  router,
  useLocalSearchParams,
} from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { useAuth } from "@/services/auth-context";
import { useColors } from "@/hooks/useColors";
import {
  BrandHeader,
  Card,
  InlineNotice,
  PageHeading,
  PrimaryButton,
  TextButton,
  TextField,
} from "@/components/primitives";
import { toE164, PHONE_NUMBER_ERROR_MESSAGE } from "@/utils/phone";
import {
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
  maskPhoneNumber,
} from "@/services/supabase";
import {
  fetchMe,
  completeRegistration,
  apiErrorMessage,
  formatOtpError,
} from "@/services/api";
import { AUTH_MODE, authService } from "@/services/auth-service";

const useRequestPhoneOtp = () => {
  const [isPending, setIsPending] = useState(false);
  return {
    isPending,
    mutateAsync: async ({ data }: { data: { phoneNumber: string } }) => {
      setIsPending(true);
      try {
        return await sendWhatsAppOtp(data.phoneNumber);
      } finally {
        setIsPending(false);
      }
    },
  };
};

const useVerifyPhoneOtp = () => {
  const [isPending, setIsPending] = useState(false);
  return {
    isPending,
    mutateAsync: async ({
      data,
    }: {
      data: { challengeId?: string; phoneNumber: string; code: string };
    }) => {
      setIsPending(true);
      try {
        return await verifyWhatsAppOtp(data.phoneNumber, data.code);
      } finally {
        setIsPending(false);
      }
    },
  };
};

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .refine((val) => toE164(val) !== null, {
      message: PHONE_NUMBER_ERROR_MESSAGE,
    }),
});
type PhoneValues = z.infer<typeof phoneSchema>;

const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(
      /^\d{6}$/,
      "Weka tarakimu 6 za verification code / Enter the 6-digit verification code."
    ),
});
type OtpValues = z.infer<typeof otpSchema>;

const loginSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .refine((val) => toE164(val) !== null, {
      message: "Namba au PIN si sahihi",
    }),
  pin: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Namba au PIN si sahihi"),
});
type LoginValues = z.infer<typeof loginSchema>;

const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Weka jina kamili (angalau herufi 2) / Enter full name (at least 2 letters)"),
    city: z
      .string()
      .trim()
      .min(2, "Weka jiji / Enter city (at least 2 characters)")
      .max(60, "Jiji nindefu sana / City is too long (max 60 characters)"),
    phoneNumber: z
      .string()
      .trim()
      .refine((val) => toE164(val) !== null, {
        message: PHONE_NUMBER_ERROR_MESSAGE,
      }),
    pin: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "PIN lazima iwe na tarakimu 6 / PIN must be exactly 6 digits"),
    confirmPin: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Thibitisha PIN ya tarakimu 6 / Confirm your 6-digit PIN"),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "PIN hazilingani / PINs do not match",
    path: ["confirmPin"],
  });
type SignupValues = z.infer<typeof signupSchema>;

const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  city: z.string().trim().min(2, "Enter your city.").max(60),
});
type RegistrationValues = z.infer<typeof registrationSchema>;

function FormFrame({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.formScroll,
        {
          paddingTop: Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top + 24,
          paddingBottom: Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom + 24,
        },
      ]}
      bottomOffset={28}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </KeyboardAwareScrollViewCompat>
  );
}

export function WelcomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  return (
    <FormFrame>
      <BrandHeader />
      <View style={styles.welcomeContent}>
        <View style={[styles.welcomeMark, { backgroundColor: colors.accent }]}>
          <Feather name="award" size={31} color={colors.primary} />
        </View>
        <PageHeading
          eyebrow={t("auth.welcome")}
          title={t("auth.tagline")}
          description={t("auth.taglineDesc")}
        />
        <Card style={styles.welcomeNote}>
          <View style={styles.noteIcon}>
            <Feather name="shield" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            {t("auth.securityNote")}
          </Text>
        </Card>
      </View>
      <View style={styles.formActions}>
        {AUTH_MODE === "pin" ? (
          <>
            <PrimaryButton
              label={t("auth.login")}
              onPress={() => router.push("/(auth)/login" as any)}
              testID="welcome-login"
            />
            <PrimaryButton
              label={t("auth.signup")}
              onPress={() => router.push("/(auth)/signup" as any)}
              secondary
              testID="welcome-signup"
            />
          </>
        ) : (
          <PrimaryButton
            label={t("auth.getStarted")}
            onPress={() => router.push("/(auth)/phone")}
            testID="welcome-get-started"
          />
        )}
        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
          {t("auth.welcomeSubtitle")}
        </Text>
      </View>
    </FormFrame>
  );
}

export function LoginScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { signIn, setPendingRegistrationToken } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const { control, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phoneNumber: "", pin: "" },
  });

  const submit = handleSubmit(async ({ phoneNumber, pin }) => {
    Keyboard.dismiss();
    setFormError(null);
    setLoading(true);

    try {
      const res = await authService.signInWithPassword({
        phone: phoneNumber,
        pin,
      });

      const token = res?.token;
      if (!token) {
        throw new Error("No token returned");
      }

      const me = await signIn(token, res.role || "customer");

      if (me.registered === false) {
        router.replace("/(auth)/registration");
        return;
      }
      if (me.must_change_pin) {
        router.replace("/change-pin" as any);
        return;
      }

      if (me.role === "admin") {
        router.replace("/admin/dashboard" as any);
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        t("auth.loginError");
      setFormError(message);
    } finally {
      setLoading(false);
    }
  });

  return (
    <FormFrame>
      <BrandHeader compact />
      <PageHeading
        eyebrow="Alibhai Points"
        title={t("auth.login")}
        description={t("auth.loginSubtitle")}
      />

      <View style={styles.formFields}>
        <Controller
          control={control}
          name="phoneNumber"
          render={({ field }) => (
            <TextField
              label={t("auth.phoneNumber")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCapitalize="none"
              placeholder="07XXXXXXXX / +255XXXXXXXXX"
              error={formState.errors.phoneNumber?.message}
              testID="login-phone-input"
            />
          )}
        />

        <Controller
          control={control}
          name="pin"
          render={({ field }) => (
            <TextField
              label={t("auth.pin")}
              value={field.value}
              onChangeText={(text) => field.onChange(text.replace(/\D/g, "").slice(0, 6))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry={!showPin}
              placeholder="••••••"
              error={formState.errors.pin?.message}
              testID="login-pin-input"
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowPin(!showPin)}
                  style={styles.eyeButton}
                  accessibilityLabel={showPin ? "Hide PIN" : "Show PIN"}
                >
                  <Feather
                    name={showPin ? "eye-off" : "eye"}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              }
            />
          )}
        />

        {formError ? <InlineNotice message={formError} tone="warning" /> : null}

        <PrimaryButton
          label={t("auth.login")}
          onPress={submit}
          loading={loading}
          testID="login-submit"
        />

        {/* Specified requirement: line on Login */}
        <Text style={[styles.forgotPinNotice, { color: colors.mutedForeground }]}>
          {t("auth.forgotPin")}
        </Text>

        <TextButton
          label={t("auth.privacyPolicy")}
          onPress={() =>
            void Linking.openURL("https://alibhaipoints-legalpages.vercel.app/").catch(
              () => Alert.alert(t("common.error"), t("profile.linkError"))
            )
          }
        />

        <View style={styles.switchAuthRow}>
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
            {t("auth.dontHaveAccount")}
          </Text>
          <TextButton
            label={t("auth.signup")}
            onPress={() => router.push("/(auth)/signup" as any)}
            testID="login-to-signup"
          />
        </View>

        <TextButton label={t("common.back")} onPress={() => router.back()} />
      </View>
    </FormFrame>
  );
}

export function SignupScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const { control, handleSubmit, formState } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", city: "", phoneNumber: "", pin: "", confirmPin: "" },
  });

  const submit = handleSubmit(async ({ fullName, city, phoneNumber, pin }) => {
    Keyboard.dismiss();
    setFormError(null);
    setLoading(true);

    try {
      const res = await authService.signUp({
        fullName,
        city,
        phone: phoneNumber,
        pin,
      });

      const token = res?.token;
      if (!token) {
        throw new Error(
          "Imeshindikana kusajili akaunti. Tafadhali jaribu tena."
        );
      }

      await signIn(token, "customer");
      router.replace("/(tabs)");
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Imeshindikana kusajili akaunti. Tafadhali jaribu tena.";
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  });

  return (
    <FormFrame>
      <BrandHeader compact />
      <PageHeading
        eyebrow="Alibhai Points"
        title={t("auth.signup")}
        description={t("auth.signupSubtitle")}
      />

      <View style={styles.formFields}>
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <TextField
              label={t("auth.fullName")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoComplete="name"
              autoCapitalize="words"
              placeholder="e.g. Juma Rashid"
              error={formState.errors.fullName?.message}
              testID="signup-name-input"
            />
          )}
        />

        <Controller
          control={control}
          name="city"
          render={({ field }) => (
            <TextField
              label={t("auth.city")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="words"
              placeholder="e.g. Dar es Salaam"
              error={formState.errors.city?.message}
              testID="signup-city-input"
            />
          )}
        />

        <Controller
          control={control}
          name="phoneNumber"
          render={({ field }) => (
            <TextField
              label={t("auth.phoneNumber")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCapitalize="none"
              placeholder="07XXXXXXXX / +255XXXXXXXXX"
              error={formState.errors.phoneNumber?.message}
              testID="signup-phone-input"
            />
          )}
        />

        <Controller
          control={control}
          name="pin"
          render={({ field }) => (
            <TextField
              label={t("auth.pin")}
              value={field.value}
              onChangeText={(text) => field.onChange(text.replace(/\D/g, "").slice(0, 6))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry={!showPin}
              placeholder="••••••"
              error={formState.errors.pin?.message}
              testID="signup-pin-input"
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowPin(!showPin)}
                  style={styles.eyeButton}
                  accessibilityLabel={showPin ? "Hide PIN" : "Show PIN"}
                >
                  <Feather
                    name={showPin ? "eye-off" : "eye"}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              }
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPin"
          render={({ field }) => (
            <TextField
              label={t("auth.confirmPin")}
              value={field.value}
              onChangeText={(text) => field.onChange(text.replace(/\D/g, "").slice(0, 6))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry={!showConfirmPin}
              placeholder="••••••"
              error={formState.errors.confirmPin?.message}
              testID="signup-confirmpin-input"
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowConfirmPin(!showConfirmPin)}
                  style={styles.eyeButton}
                  accessibilityLabel={showConfirmPin ? "Hide PIN" : "Show PIN"}
                >
                  <Feather
                    name={showConfirmPin ? "eye-off" : "eye"}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              }
            />
          )}
        />

        {formError ? <InlineNotice message={formError} tone="warning" /> : null}

        <PrimaryButton
          label={t("auth.signup")}
          onPress={submit}
          loading={loading}
          testID="signup-submit"
        />

        <View style={styles.switchAuthRow}>
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
            {t("auth.alreadyHaveAccount")}
          </Text>
          <TextButton
            label={t("auth.login")}
            onPress={() => router.push("/(auth)/login" as any)}
            testID="signup-to-login"
          />
        </View>

        <TextButton label={t("common.back")} onPress={() => router.back()} />
      </View>
    </FormFrame>
  );
}

export function PhoneScreen() {
  const colors = useColors();
  const requestOtp = useRequestPhoneOtp();
  const [requestError, setRequestError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<PhoneValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: "" },
  });

  const submit = handleSubmit(async ({ phoneNumber }) => {
    Keyboard.dismiss();
    setRequestError(null);
    const formattedPhone = toE164(phoneNumber);
    if (!formattedPhone) {
      setRequestError(PHONE_NUMBER_ERROR_MESSAGE);
      return;
    }
    try {
      const response = await requestOtp.mutateAsync({
        data: { phoneNumber: formattedPhone },
      });
      router.push({
        pathname: "/(auth)/otp",
        params: {
          challengeId: response.challengeId,
          phoneNumber: formattedPhone,
          maskedPhoneNumber:
            response.maskedPhoneNumber || maskPhoneNumber(formattedPhone),
        },
      });
    } catch (error) {
      setRequestError(formatOtpError(error));
    }
  });

  return (
    <FormFrame>
      <BrandHeader compact />
      <PageHeading
        eyebrow="Sign in or join"
        title="Your WhatsApp number"
        description="We’ll send a WhatsApp verification code to verify it’s you."
      />
      <View style={styles.formFields}>
        <Controller
          control={control}
          name="phoneNumber"
          render={({ field }) => (
            <TextField
              label="Namba ya WhatsApp / WhatsApp number"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCapitalize="none"
              placeholder="07XXXXXXXX au +255XXXXXXXXX"
              error={formState.errors.phoneNumber?.message}
              testID="phone-number-input"
            />
          )}
        />
        <Text style={[styles.legalText, { color: colors.mutedForeground, marginTop: -8 }]}>
          Code itatumwa kwa WhatsApp / The code will be sent on WhatsApp
        </Text>
        {requestError ? <InlineNotice message={requestError} tone="warning" /> : null}
        <PrimaryButton
          label="Send verification code"
          onPress={submit}
          loading={requestOtp.isPending}
          testID="phone-submit"
        />
        <TextButton label="Back" onPress={() => router.back()} />
      </View>
      <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
        By continuing, you agree to receive a one-time verification code on WhatsApp.
      </Text>
    </FormFrame>
  );
}

export function OtpScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{
    challengeId?: string;
    phoneNumber?: string;
    maskedPhoneNumber?: string;
  }>();
  const phoneNumber =
    typeof params.phoneNumber === "string" ? params.phoneNumber : "";
  const routeChallengeId =
    typeof params.challengeId === "string" ? params.challengeId : "";
  const [challengeId, setChallengeId] = useState(routeChallengeId);
  const [formError, setFormError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const isSubmittingRef = useRef(false);

  const { setPendingRegistrationToken, signIn } = useAuth();
  const verifyOtp = useVerifyPhoneOtp();
  const requestOtp = useRequestPhoneOtp();

  const { control, handleSubmit, formState } = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  // 60-second countdown timer for Resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const handleVerifyCode = async (codeToVerify: string) => {
    if (isSubmittingRef.current || verifyOtp.isPending) return;
    isSubmittingRef.current = true;
    Keyboard.dismiss();
    setFormError(null);

    try {
      const response = await verifyOtp.mutateAsync({
        data: { challengeId, phoneNumber, code: codeToVerify },
      });

      // If registered is false or registration is required, go to RegistrationScreen
      if (
        response.status === "registration_required" ||
        response.registered === false
      ) {
        setPendingRegistrationToken(
          response.registrationToken || `reg-token-${Date.now()}`
        );
        router.replace("/(auth)/registration");
        return;
      }

      // If registered succeeds: GET /api/me -> admin or customer navigator
      let destination: "/admin/dashboard" | "/(tabs)" = "/(tabs)";
      let role: "admin" | "customer" = "customer";

      try {
        const me = await fetchMe(response.accessToken);
        if (me?.role === "admin") {
          role = "admin";
          destination = "/admin/dashboard";
        }
      } catch {
        // Fallback to customer navigation
      }

      if (response.accessToken) {
        await signIn(response.accessToken, role);
      }
      router.replace(destination as any);
    } catch (error) {
      setFormError(formatOtpError(error));
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const submit = handleSubmit(async ({ code }) => {
    await handleVerifyCode(code);
  });

  const resend = async () => {
    if (countdown > 0 || requestOtp.isPending) return;
    setFormError(null);
    try {
      const response = await requestOtp.mutateAsync({
        data: { phoneNumber },
      });
      setChallengeId(response.challengeId);
      setCountdown(60);
    } catch (error) {
      setFormError(formatOtpError(error));
    }
  };

  const handleOpenWhatsApp = async () => {
    try {
      await Linking.openURL("whatsapp://send");
    } catch {
      // Ignore errors if WhatsApp is not installed
    }
  };

  if (!phoneNumber) {
    return <Redirect href="/(auth)/phone" />;
  }

  return (
    <FormFrame>
      <BrandHeader compact />
      <PageHeading
        eyebrow="WhatsApp verification"
        title="Tumekutumia code kwa WhatsApp / We sent you a code on WhatsApp"
        description=""
      />

      <View style={styles.phoneChangeRow}>
        <Text style={[styles.phoneTargetText, { color: colors.foreground }]}>
          {phoneNumber}
        </Text>
        <TextButton
          label="Change number"
          onPress={() => router.replace("/(auth)/phone")}
        />
      </View>

      <View style={styles.formFields}>
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextField
              label="Verification code"
              value={field.value}
              onChangeText={(value) => {
                const cleaned = value.replace(/\D/g, "").slice(0, 6);
                field.onChange(cleaned);
                if (cleaned.length === 6) {
                  void handleVerifyCode(cleaned);
                }
              }}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              autoCapitalize="none"
              placeholder="000000"
              error={formState.errors.code?.message}
              inputStyle={styles.codeInput}
              testID="otp-code-input"
            />
          )}
        />

        <Text style={[styles.legalText, { color: colors.mutedForeground, marginTop: -8 }]}>
          Hupati code? Hakikisha namba ina WhatsApp.
        </Text>

        {formError ? <InlineNotice message={formError} tone="warning" /> : null}

        <PrimaryButton
          label="Verify and continue"
          onPress={submit}
          loading={verifyOtp.isPending}
          testID="otp-submit"
        />

        <View style={styles.resendRow}>
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
            Didn’t receive a code?
          </Text>
          <TextButton
            label={
              countdown > 0
                ? `Tuma tena / Resend (${countdown}s)`
                : "Tuma tena / Resend"
            }
            onPress={() => void resend()}
            disabled={countdown > 0 || requestOtp.isPending}
            testID="otp-resend"
          />
        </View>

        <TextButton
          label="Fungua WhatsApp"
          onPress={handleOpenWhatsApp}
          testID="open-whatsapp-button"
        />

        <TextButton
          label="Change number"
          onPress={() => router.replace("/(auth)/phone")}
        />
      </View>
    </FormFrame>
  );
}

export function RegistrationScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { pendingRegistrationToken, setPendingRegistrationToken, signIn } =
    useAuth();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { fullName: "", city: "" },
  });

  const submit = handleSubmit(async ({ fullName, city }) => {
    if (!pendingRegistrationToken) return;
    Keyboard.dismiss();
    setFormError(null);
    setLoading(true);

    try {
      const result = await completeRegistration(fullName, city, pendingRegistrationToken);
      const token = pendingRegistrationToken;
      setPendingRegistrationToken(null);
      setCustomerId(result.customer_code || null);
      await signIn(token, "customer");
    } catch (error) {
      setFormError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  });

  if (!pendingRegistrationToken) {
    return <Redirect href={(AUTH_MODE === "pin" ? "/(auth)/login" : "/(auth)/phone") as any} />;
  }

  // Show welcome screen with customer ID after successful registration
  if (customerId) {
    return (
      <FormFrame>
        <BrandHeader compact />
        <View style={styles.welcomeContent}>
          <View style={[styles.welcomeMark, { backgroundColor: colors.accent }]}>
            <Feather name="check-circle" size={31} color={colors.primary} />
          </View>
          <PageHeading
            eyebrow="Alibhai Points"
            title={t("auth.welcomeMessage")}
            description=""
          />
          <Card style={styles.customerIdCard}>
            <Text style={[styles.customerIdText, { color: colors.foreground }]}>
              {customerId}
            </Text>
          </Card>
        </View>
        <View style={styles.formActions}>
          <PrimaryButton
            label={t("common.continue")}
            onPress={() => router.replace("/(tabs)" as any)}
            testID="registration-continue"
          />
        </View>
      </FormFrame>
    );
  }

  return (
    <FormFrame>
      <BrandHeader compact />
      <PageHeading
        eyebrow="Alibhai Points"
        title={t("auth.signupTitle")}
        description={t("auth.signupSubtitle")}
      />
      <View style={styles.formFields}>
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <TextField
              label={t("auth.fullName")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoComplete="name"
              autoCapitalize="words"
              placeholder="e.g. Juma Rashid"
              error={formState.errors.fullName?.message}
              testID="registration-name-input"
            />
          )}
        />
        <Controller
          control={control}
          name="city"
          render={({ field }) => (
            <TextField
              label={t("auth.city")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="words"
              placeholder="e.g. Dar es Salaam"
              error={formState.errors.city?.message}
              testID="registration-city-input"
            />
          )}
        />
        {formError ? <InlineNotice message={formError} tone="warning" /> : null}
        <PrimaryButton
          label={t("auth.register")}
          onPress={submit}
          loading={loading}
          testID="registration-submit"
        />
        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
          {t("auth.welcomeSubtitle")}
        </Text>
      </View>
    </FormFrame>
  );
}

const styles = StyleSheet.create({
  formScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 27,
  },
  welcomeContent: { gap: 18, marginTop: 18 },
  welcomeMark: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  welcomeNote: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14 },
  noteIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  formActions: { gap: 12, marginTop: 4 },
  formFields: { gap: 17 },
  legalText: { fontSize: 12, lineHeight: 18 },
  codeInput: { fontSize: 22, letterSpacing: 7, fontWeight: "700" },
  resendRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  adminLink: { fontSize: 14, fontWeight: "600", marginTop: 8, textAlign: "center" },
  phoneChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: -12,
  },
  phoneTargetText: {
    fontSize: 15,
    fontWeight: "600",
  },
  eyeButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  forgotPinNotice: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginVertical: 4,
    fontStyle: "italic",
  },
  switchAuthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 4,
  },
  customerIdCard: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  customerIdText: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
  },
});
