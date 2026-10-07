import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/services/auth-context";
import { toE164 } from "@/utils/phone";
import { apiLogin } from "@/services/api";

export default function AdminLogin() {
  const router = useRouter();
  const { signIn, signOut } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      Alert.alert("Hitilafu / Error", "Tafadhali weka namba/barua pepe na nenosiri / Please enter username/phone and password/PIN");
      return;
    }

    setLoading(true);

    try {
      const normalized = toE164(trimmedUser);
      if (!normalized) {
        Alert.alert(
          "Hitilafu / Error",
          "Namba ya simu si sahihi / Invalid phone number"
        );
        setLoading(false);
        return;
      }

      const res = await apiLogin(trimmedUser, trimmedPass);

      if (res.role !== "admin") {
        await signOut();
        Alert.alert(
          "Ufikiaji Umekataliwa / Access Denied",
          "Akaunti hii haina ruhusa ya Admin / This account does not have admin permissions."
        );
        setLoading(false);
        return;
      }

      await signIn(res.token, "admin");
      router.replace("/admin/dashboard" as any);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        "Namba au PIN si sahihi / Invalid credentials";
      Alert.alert("Hitilafu / Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.subtitle}>Alibhai Points Dashboard</Text>

        <TextInput
          style={styles.input}
          placeholder="Namba ya simu au Barua pepe / Phone or Email"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor="#999999"
        />

        <TextInput
          style={styles.input}
          placeholder="PIN au Nenosiri / PIN or Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor="#999999"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>Rudi / Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#7A1F2B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#777777",
    marginBottom: 32,
  },
  input: {
    backgroundColor: "#F3F3F3",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: "#242424",
  },
  button: {
    backgroundColor: "#7A1F2B",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    marginTop: 16,
    alignItems: "center",
  },
  backButtonText: {
    color: "#777777",
    fontSize: 14,
  },
});
