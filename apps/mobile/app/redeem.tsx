import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { RedeemScreen } from "@/components/customer-screens";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/services/auth-context";

export default function RedeemRoute() {
  const colors = useColors();
  const { status } = useAuth();
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
  if (status !== "signed-in") {
    return <Redirect href="/(auth)/welcome" />;
  }
  return <RedeemScreen />;
}
