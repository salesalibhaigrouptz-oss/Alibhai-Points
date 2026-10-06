import { Stack, Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/services/auth-context";

export default function AuthLayout() {
  const colors = useColors();
  const { status, role } = useAuth();
  if (status === "restoring") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (status === "signed-in") {
    if (role === "admin") {
      return <Redirect href={"/admin/dashboard" as any} />;
    }
    return <Redirect href="/(tabs)" />;
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
      }}
    />
  );
}
