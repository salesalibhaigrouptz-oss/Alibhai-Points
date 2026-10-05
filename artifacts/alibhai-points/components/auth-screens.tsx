import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCompleteCustomerRegistration,
  useRequestPhoneOtp,
  useVerifyPhoneOtp,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  Redirect,
  router,
  useLocalSearchParams,
} from "expo-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Enter a valid phone number with country code."),
});
type PhoneValues = z.infer<typeof phoneSchema>;

const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "Enter the verification code sent to your phone."),
});
type OtpValues = z.infer<typeof otpSchema>;

const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
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
  return (
    <FormFrame>
      <BrandHeader />
      <View style={styles.welcomeContent}>
        <View style={[styles.welcomeMark, { backgroundColor: colors.accent }]}>
          <Feather name="award" size={31} color={colors.primary} />
        </View>
        <PageHeading
          eyebrow="Your Alibhai account"
          title="Points, made simple."
          description="See your balance, know what’s ready to redeem, and keep track of your rewards in one place."
        />
        <Card style={styles.welcomeNote}>
          <View style={styles.noteIcon}>
            <Feather name="shield" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            Your points and account status always come directly from Alibhai.
          </Text>
        </Card>
      </View>
      <View style={styles.formActions}>
        <PrimaryButton
          label="Get started"
          onPress={() => router.push("/(auth)/phone")}
          testID="welcome-get-started"
        />
        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
          Sign in or create an account with your Tanzanian mobile number.
        </Text>
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
    defaultValues: { phoneNumber: "+255" },
  });

  const submit = handleSubmit(async ({ phoneNumber }) => {
    Keyboard.dismiss();
    setRequestError(null);
    try {
      const response = await requestOtp.mutateAsync({
        data: { phoneNumber },
      });
      router.push({
        pathname: "/(auth)/otp",
        params: {
          challengeId: response.challengeId,
          phoneNumber,
          maskedPhoneNumber: response.maskedPhoneNumber,
        },
      });
    } catch (error) {
      setRequestError(apiErrorMessage(error));
    }
  });

  return (
    <FormFrame>
      <BrandHeader compact />
      <PageHeading
        eyebrow="Sign in or join"
        title="Your phone number"
        description="We’ll send a one-time code to verify it’s you."
      />
      <View style={styles.formFields}>
        <Controller
          control={control}
          name="phoneNumber"
          render={({ field }) => (
            <TextField
              label="Mobile number"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCapitalize="none"
              placeholder="+255 7XX XXX XXX"
              error={formState.errors.phoneNumber?.message}
              testID="phone-number-input"
            />
          )}
        />
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
        By continuing, you agree to receive a one-time verification message.
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
  const maskedPhone =
    typeof params.maskedPhoneNumber === "string"
      ? params.maskedPhoneNumber
      : phoneNumber;
  const [challengeId, setChallengeId] = useState(routeChallengeId);
  const [formError, setFormError] = useState<string | null>(null);
  const { setPendingRegistrationToken, signIn } = useAuth();
  const verifyOtp = useVerifyPhoneOtp();
  const requestOtp = useRequestPhoneOtp();
  const { control, handleSubmit, formState } = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  const submit = handleSubmit(async ({ code }) => {
    Keyboard.dismiss();
    setFormError(null);
    try {
      const response = await verifyOtp.mutateAsync({
        data: { challengeId, phoneNumber, code },
      });
      if (response.status === "authenticated" && response.accessToken) {
        await signIn(response.accessToken);
        router.replace("/(tabs)");
        return;
      }
      if (
        response.status === "registration_required" &&
        response.registrationToken
      ) {
        setPendingRegistrationToken(response.registrationToken);
        router.replace("/(auth)/registration");
        return;
      }
      setFormError("The verification service returned an incomplete sign-in response.");
    } catch (error) {
      setFormError(apiErrorMessage(error));
    }
  });

  const resend = async () => {
    setFormError(null);
    try {
      const response = await requestOtp.mutateAsync({
        data: { phoneNumber },
      });
      setChallengeId(response.challengeId);
    } catch (error) {
      setFormError(apiErrorMessage(error));
    }
  };

  if (!phoneNumber || !challengeId) {
    return <Redirect href="/(auth)/phone" />;
  }

  return (
    <FormFrame>
      <BrandHeader compact />
      <PageHeading
        eyebrow="Phone verification"
        title="Enter your code"
        description={`We sent a one-time code to ${maskedPhone}.`}
      />
      <View style={styles.formFields}>
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextField
              label="Verification code"
              value={field.value}
              onChangeText={(value) => field.onChange(value.replace(/\D/g, ""))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              maxLength={8}
              autoComplete="one-time-code"
              autoCapitalize="none"
              placeholder="Enter code"
              error={formState.errors.code?.message}
              inputStyle={styles.codeInput}
              testID="otp-code-input"
            />
          )}
        />
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
            label="Resend"
            onPress={() => void resend()}
            disabled={requestOtp.isPending}
            testID="otp-resend"
          />
        </View>
        <TextButton label="Change number" onPress={() => router.replace("/(auth)/phone")} />
      </View>
    </FormFrame>
  );
}

export function RegistrationScreen() {
  const colors = useColors();
  const { pendingRegistrationToken, setPendingRegistrationToken, signIn } =
    useAuth();
  const registerCustomer = useCompleteCustomerRegistration();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { fullName: "" },
  });

  const submit = handleSubmit(async ({ fullName }) => {
    if (!pendingRegistrationToken) return;
    Keyboard.dismiss();
    setFormError(null);
    try {
      const response = await registerCustomer.mutateAsync({
        data: {
          registrationToken: pendingRegistrationToken,
          fullName,
        },
      });
      setPendingRegistrationToken(null);
      await signIn(response.accessToken);
      router.replace("/(tabs)");
    } catch (error) {
      setFormError(apiErrorMessage(error));
    }
  });

  if (!pendingRegistrationToken) {
    return <Redirect href="/(auth)/phone" />;
  }

  return (
    <FormFrame>
      <BrandHeader compact />
      <PageHeading
        eyebrow="Almost there"
        title="Create your account"
        description="Add your name to finish setting up your Alibhai Points account."
      />
      <View style={styles.formFields}>
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <TextField
              label="Full name"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoComplete="name"
              autoCapitalize="words"
              placeholder="Your full name"
              error={formState.errors.fullName?.message}
              testID="registration-name-input"
            />
          )}
        />
        {formError ? <InlineNotice message={formError} tone="warning" /> : null}
        <PrimaryButton
          label="Create account"
          onPress={submit}
          loading={registerCustomer.isPending}
          testID="registration-submit"
        />
        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
          Your customer ID will be created by Alibhai when registration is complete.
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
  formActions: { gap: 8, marginTop: 4 },
  formFields: { gap: 17 },
  legalText: { fontSize: 12, lineHeight: 18 },
  codeInput: { fontSize: 22, letterSpacing: 7, fontWeight: "700" },
  resendRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
});
