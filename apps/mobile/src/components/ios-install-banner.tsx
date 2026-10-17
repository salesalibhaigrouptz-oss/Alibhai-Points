import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IosNavigator = Navigator & { standalone?: boolean };

export function IosInstallBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const userAgent = window.navigator.userAgent;
    const isIos =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1);
    const isSafari =
      /Safari/i.test(userAgent) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
    const isInstalled =
      (window.navigator as IosNavigator).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    setVisible(isIos && isSafari && !isInstalled);
  }, []);

  if (!visible) return null;

  return (
    <View style={[styles.banner, { top: insets.top + 8 }]}>
      <Text style={styles.message}>{t("pwa.installBanner")}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("pwa.dismissInstallBanner")}
        hitSlop={10}
        onPress={() => setVisible(false)}
        style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
      >
        <Text style={styles.dismissText}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    zIndex: 1000,
    left: 12,
    right: 12,
    alignSelf: "center",
    maxWidth: 456,
    minHeight: 56,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 14,
    backgroundColor: "#7A1F2B",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#242424",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  message: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  dismiss: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: "#FFFFFF22",
  },
  dismissText: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 30,
  },
});
