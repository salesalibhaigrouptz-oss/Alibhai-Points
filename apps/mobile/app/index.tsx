import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { BrandHeader } from "@/components/primitives";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/services/auth-context";

export default function IndexRoute() {
  const colors = useColors();
  const { status, role } = useAuth();

  if (status === "signed-in") {
    if (role === "admin") {
      return <Redirect href="/admin/dashboard" as any />;
    }
    return <Redirect href="/(tabs)" />;
  }
  if (status === "signed-out") {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <View style={[styles.splash, { backgroundColor: colors.background }]}>
      <BrandHeader />
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
        Getting your account ready
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: { fontSize: 13 },
});
