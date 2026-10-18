import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiClient } from "@/services/api";
import { compareVersions } from "@/utils/compare-versions";

type RequiredAppUpdate = {
  packageName: string;
};

type HealthResponse = {
  success?: boolean;
  data?: {
    min_app_version?: unknown;
  };
};

export function AppReleaseManager() {
  const [requiredUpdate, setRequiredUpdate] =
    useState<RequiredAppUpdate | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    let active = true;

    const checkMinimumVersion = async () => {
      if (Platform.OS !== "android" || __DEV__) return;

      const installedVersion = Constants.expoConfig?.version;
      const packageName = Constants.expoConfig?.android?.package;
      if (!installedVersion || !packageName) return;

      try {
        const response = await apiClient.get<HealthResponse>("/api/health");
        const minimumVersion = response.data.data?.min_app_version;
        if (
          !active ||
          response.data.success !== true ||
          typeof minimumVersion !== "string"
        ) {
          return;
        }

        const comparison = compareVersions(installedVersion, minimumVersion);
        if (comparison !== null && comparison < 0) {
          setRequiredUpdate({ packageName });
        }
      } catch (error) {
        console.warn("Unable to check the minimum supported app version", error);
      }
    };

    const checkForUpdate = async () => {
      if (__DEV__ || Platform.OS === "web" || !Updates.isEnabled) return;

      try {
        const update = await Updates.checkForUpdateAsync();
        if (!active || !update.isAvailable) return;

        const downloaded = await Updates.fetchUpdateAsync();
        if (active && downloaded.isNew) {
          setUpdateReady(true);
        }
      } catch (error) {
        console.warn("Unable to check for an app update", error);
      }
    };

    void checkMinimumVersion();
    void checkForUpdate();

    return () => {
      active = false;
    };
  }, []);

  const openPlayStore = async () => {
    if (!requiredUpdate) return;

    const storeUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(requiredUpdate.packageName)}`;
    try {
      await Linking.openURL(`market://details?id=${encodeURIComponent(requiredUpdate.packageName)}`);
    } catch {
      try {
        await Linking.openURL(storeUrl);
      } catch (error) {
        console.error("Unable to open the app's Play Store page", error);
      }
    }
  };

  if (requiredUpdate) {
    return (
      <View style={styles.blocker}>
        <SafeAreaView style={styles.blockerContent}>
          <Text style={styles.blockerTitle}>
            Tafadhali sasisha app / Please update the app
          </Text>
          <Text style={styles.blockerBody}>
            A newer version is required to continue.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void openPlayStore()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Open Play Store</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (!updateReady) return null;

  return (
    <View pointerEvents="box-none" style={styles.noticeLayer}>
      <View accessibilityRole="alert" style={styles.updateNotice}>
        <Text style={styles.updateText}>Update ready - restart</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Updates.reloadAsync().catch((error: unknown) => {
              console.error("Unable to restart with the downloaded update", error);
            });
          }}
          style={styles.restartButton}
        >
          <Text style={styles.restartText}>Restart</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AppBuildInfo() {
  const version = Constants.expoConfig?.version ?? "—";
  const channel = Updates.channel ?? (__DEV__ ? "dev" : "—");
  const update = __DEV__
    ? "dev"
    : Updates.isEmbeddedLaunch
      ? "embedded"
      : Updates.updateId?.slice(0, 8) ?? "embedded";

  return (
    <Text accessibilityLabel="App version and update information" style={styles.buildInfo}>
      v{version} · {channel} · {update}
    </Text>
  );
}

const styles = StyleSheet.create({
  blocker: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    backgroundColor: "#FAFAFA",
  },
  blockerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  blockerTitle: {
    color: "#242424",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  blockerBody: {
    color: "#666666",
    fontSize: 15,
    marginTop: 12,
    marginBottom: 24,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#7A1F2B",
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  noticeLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    padding: 16,
    zIndex: 999,
  },
  updateNotice: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#242424",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    maxWidth: 440,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: "100%",
  },
  updateText: {
    color: "#FFFFFF",
    flexShrink: 1,
    fontSize: 13,
  },
  restartButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  restartText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  buildInfo: {
    color: "#888888",
    fontSize: 11,
    textAlign: "center",
    paddingVertical: 12,
  },
});
