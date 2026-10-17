import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { ErrorFallbackProps } from "@/components/ErrorBoundary";
import { PrimaryButton } from "@/components/primitives";

export function ErrorFallback({ resetError }: ErrorFallbackProps) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t("errors.crashTitle")}
      </Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        {t("errors.crashMessage")}
      </Text>
      <PrimaryButton label={t("common.retry")} onPress={resetError} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
  },
});
