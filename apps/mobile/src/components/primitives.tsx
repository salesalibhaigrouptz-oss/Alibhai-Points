import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { ComponentProps, PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

export function Page({
  children,
  contentStyle,
  withTabs = false,
}: PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  withTabs?: boolean;
}>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? Math.max(insets.top, 67) : 14;
  const webBottom = Platform.OS === "web" ? Math.max(insets.bottom, 34) : 24;

  return (
    <SafeAreaView
      edges={withTabs ? ["top", "left", "right"] : ["top", "bottom", "left", "right"]}
      style={[styles.page, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.pageContent,
          {
            paddingTop: webTop,
            paddingBottom: webBottom + (withTabs && Platform.OS === "web" ? 90 : 0),
          },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AuthPage({ children }: PropsWithChildren) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.authPage,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top,
          paddingBottom: Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function BrandHeader({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.brandRow}>
      <Image
        source={require("../../assets/logo.png")}
        style={[styles.brandIcon, compact && styles.brandIconCompact]}
        contentFit="contain"
        accessibilityLabel="Alibhai Points mark"
      />
      <View>
        <Text style={[styles.brandName, { color: colors.foreground }]}>
          Alibhai Points
        </Text>
        {!compact && (
          <Text style={[styles.brandCaption, { color: colors.mutedForeground }]}>
            Your loyalty, made simple
          </Text>
        )}
      </View>
    </View>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.heading}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
      ) : null}
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  secondary = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const backgroundColor = secondary ? colors.secondary : colors.primary;
  const textColor = secondary ? colors.secondaryForeground : colors.primaryForeground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS !== "web") void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: disabled ? 0.46 : pressed ? 0.86 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  testID,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Text style={[styles.textButtonLabel, { color: colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  inputStyle,
  keyboardType,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  inputStyle?: StyleProp<TextStyle>;
  keyboardType?: KeyboardTypeOptions;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        {...props}
        keyboardType={keyboardType}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            color: colors.foreground,
            borderColor: error ? colors.destructive : colors.input,
          },
          inputStyle,
        ]}
        accessibilityLabel={label}
      />
      {error ? (
        <Text style={[styles.fieldError, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function InlineNotice({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "warning" | "success";
}) {
  const colors = useColors();
  const color =
    tone === "warning"
      ? colors.destructive
      : tone === "success"
        ? colors.success
        : colors.primary;
  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.notice,
        {
          backgroundColor:
            tone === "warning" ? colors.warningSurface : colors.accent,
          borderColor: tone === "warning" ? colors.destructive : colors.border,
        },
      ]}
    >
      <Feather
        name={tone === "warning" ? "alert-circle" : "info"}
        size={18}
        color={color}
      />
      <Text style={[styles.noticeText, { color: colors.foreground }]}>
        {message}
      </Text>
    </View>
  );
}

export function LoadingState({ label = "Loading your account" }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.stateBox} accessibilityRole="progressbar">
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ComponentProps<typeof Feather>["name"];
  title: string;
  description: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.stateBox}>
      <View style={[styles.stateIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
        {description}
      </Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const colors = useColors();
  return (
    <Card style={styles.errorCard}>
      <View style={[styles.stateIcon, { backgroundColor: colors.accent }]}>
        <Feather name="wifi-off" size={21} color={colors.primary} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.foreground }]}>
        We couldn’t load this yet
      </Text>
      <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
        {message}
      </Text>
      <PrimaryButton label="Try again" onPress={onRetry} secondary />
    </Card>
  );
}

export function LabelValue({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ComponentProps<typeof Feather>["name"];
}) {
  const colors = useColors();
  return (
    <View style={styles.labelValue}>
      <View style={styles.labelValueTitle}>
        {icon ? <Feather name={icon} size={15} color={colors.mutedForeground} /> : null}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageContent: { paddingHorizontal: 22, gap: 20 },
  authPage: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandIcon: { width: 60, height: 60, borderRadius: 13 },
  brandIconCompact: { width: 50, height: 50, borderRadius: 10 },
  brandName: { fontSize: 16, fontWeight: "700", letterSpacing: 0.1 },
  brandCaption: { marginTop: 2, fontSize: 12 },
  heading: { gap: 6 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
  title: { fontSize: 29, lineHeight: 36, fontWeight: "700", letterSpacing: -0.6 },
  description: { fontSize: 15, lineHeight: 22, marginTop: 2 },
  button: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
  textButton: { alignSelf: "flex-start", paddingVertical: 7 },
  textButtonLabel: { fontSize: 15, fontWeight: "700" },
  field: { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: "600" },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  fieldError: { fontSize: 12, marginTop: -2 },
  card: { padding: 18, borderWidth: 1 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    padding: 14,
    borderRadius: 14,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  stateBox: { alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  stateIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stateTitle: { fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  errorCard: { alignItems: "center", gap: 12, paddingVertical: 22 },
  labelValue: { gap: 7 },
  labelValueTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 12 },
  value: { fontSize: 15, fontWeight: "600" },
});
