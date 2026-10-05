import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

export const ACCESS_TOKEN_KEY = "alibhai-points.access-token";

type AuthStatus = "restoring" | "signed-in" | "signed-out";

type AuthContextValue = {
  status: AuthStatus;
  pendingRegistrationToken: string | null;
  setPendingRegistrationToken: (token: string | null) => void;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [pendingRegistrationToken, setPendingRegistrationToken] = useState<
    string | null
  >(null);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
      .then((token) => {
        if (active) setStatus(token ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (active) setStatus("signed-out");
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(
    async (token: string) => {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
      setPendingRegistrationToken(null);
      queryClient.clear();
      setStatus("signed-in");
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    setPendingRegistrationToken(null);
    queryClient.clear();
    setStatus("signed-out");
  }, [queryClient]);

  const value = useMemo(
    () => ({
      status,
      pendingRegistrationToken,
      setPendingRegistrationToken,
      signIn,
      signOut,
    }),
    [status, pendingRegistrationToken, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}
