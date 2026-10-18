import type { ExpoConfig } from "expo/config";
import { isAllowedApiUrl } from "./src/config/url-validation.js";

function isSupabaseServiceRoleKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) {
    return true;
  }

  const payloadPart = key.split(".")[1];
  if (!payloadPart) {
    return false;
  }

  try {
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(paddedBase64)) as {
      role?: unknown;
    };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

const requiredPublicVariables = [
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_AUTH_EMAIL_DOMAIN",
] as const;

for (const name of requiredPublicVariables) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing required EAS environment variable: ${name}`);
  }
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
if (apiUrl && !isAllowedApiUrl(apiUrl)) {
  throw new Error(
    "EXPO_PUBLIC_API_URL must use HTTPS, except for a local/private-network HTTP URL during development"
  );
}

for (const name of [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_PRIVACY_POLICY_URL",
  "EXPO_PUBLIC_ACCOUNT_DELETION_URL",
]) {
  const value = process.env[name]?.trim();
  if (value && new URL(value).protocol !== "https:") {
    throw new Error(`${name} must use HTTPS`);
  }
}

const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
if (isSupabaseServiceRoleKey(supabaseKey)) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY must be an anonymous or publishable key, never a secret key"
  );
}

const config: ExpoConfig = {
  owner: "alibhai-group-tanzanias-team",
  name: "Alibhai Points",
  slug: "alibhai-points",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "alibhai-points",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: false,
  },
  android: {
    package: "com.alibhai.points",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon-foreground.png",
      backgroundColor: "#7A1F2B",
    },
    permissions: ["android.permission.INTERNET"],
    blockedPermissions: [
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.ACCESS_WIFI_STATE",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.VIBRATE",
    ],
  },
  web: {
    favicon: "./public/favicon.png",
    output: "single",
    name: "Alibhai Points",
    shortName: "Alibhai Pts",
    backgroundColor: "#FAFAFA",
    themeColor: "#7A1F2B",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 220,
        resizeMode: "contain",
        backgroundColor: "#FAFAFA",
        dark: {
          backgroundColor: "#FAFAFA",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: "36.0.0",
          usesCleartextTraffic: false,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  updates: {
    url: "https://u.expo.dev/75f03987-9115-460e-ae2e-d6a6b01eef75",
  },
  runtimeVersion: {
    policy: "fingerprint",
  },
  extra: {
    eas: {
      projectId: "75f03987-9115-460e-ae2e-d6a6b01eef75",
    },
  },
};

export default config;
