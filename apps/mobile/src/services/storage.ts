import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

function getSecureStoreKey(key: string): string {
  if (!key) {
    throw new Error("Secure storage keys must not be empty");
  }

  if (/^[A-Za-z0-9._-]+$/.test(key)) {
    return key;
  }

  const encoded = Array.from(key)
    .map((character) => character.codePointAt(0)?.toString(16) ?? "")
    .join(".");
  return `alibhai_${encoded}`;
}

async function getNativeSecureItem(key: string): Promise<string | null> {
  const SecureStore = await import("expo-secure-store");
  const secureKey = getSecureStoreKey(key);
  const secureValue = await SecureStore.getItemAsync(secureKey);
  const legacyValue = await AsyncStorage.getItem(key);

  if (secureValue !== null) {
    if (legacyValue !== null) await AsyncStorage.removeItem(key);
    return secureValue;
  }

  if (legacyValue === null) return null;

  await SecureStore.setItemAsync(secureKey, legacyValue);
  await AsyncStorage.removeItem(key);
  return legacyValue;
}

export const appStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") {
        throw new Error("Browser storage is unavailable outside the web runtime");
      }
      return window.localStorage.getItem(key);
    }

    if (Platform.OS === "android" || Platform.OS === "ios") {
      return getNativeSecureItem(key);
    }

    throw new Error(`Secure storage is unsupported on ${Platform.OS}`);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") {
        throw new Error("Browser storage is unavailable outside the web runtime");
      }
      window.localStorage.setItem(key, value);
      return;
    }

    if (Platform.OS === "android" || Platform.OS === "ios") {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.setItemAsync(getSecureStoreKey(key), value);
      await AsyncStorage.removeItem(key);
      return;
    }

    throw new Error(`Secure storage is unsupported on ${Platform.OS}`);
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") {
        throw new Error("Browser storage is unavailable outside the web runtime");
      }
      window.localStorage.removeItem(key);
      return;
    }

    if (Platform.OS === "android" || Platform.OS === "ios") {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.deleteItemAsync(getSecureStoreKey(key));
      await AsyncStorage.removeItem(key);
      return;
    }

    throw new Error(`Secure storage is unsupported on ${Platform.OS}`);
  },
};
