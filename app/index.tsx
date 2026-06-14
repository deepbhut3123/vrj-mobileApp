import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useI18n } from "@/constants/i18n";
import { getCurrentUser, login, verifyLoginCode } from "@/services/api";

export default function LoginScreen() {
  const { t } = useI18n();
  const user = getCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isVerificationStep = Boolean(verificationToken);

  useEffect(() => {
    if (user) {
      router.replace("/(tabs)");
    }
  }, [user]);

  const onLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t("common_validation"), t("auth_missing_details"));
      return;
    }

    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      Alert.alert(t("auth_login_failed"), result.message);
      return;
    }

    if (result.data?.requiresVerification && result.data.verificationToken) {
      setVerificationToken(result.data.verificationToken);
      setVerificationCode("");
      return;
    }

    router.replace("/(tabs)");
  };

  const onVerifyCode = async () => {
    if (!verificationCode.trim() || !verificationToken) {
      Alert.alert(t("common_validation"), t("auth_verification_missing_code"));
      return;
    }

    setSubmitting(true);
    const result = await verifyLoginCode(
      verificationToken,
      verificationCode.trim(),
    );
    setSubmitting(false);

    if (!result.ok) {
      Alert.alert(t("auth_login_failed"), result.message);
      return;
    }

    setVerificationToken("");
    setVerificationCode("");
    router.replace("/(tabs)");
  };

  const resetVerificationStep = () => {
    setVerificationToken("");
    setVerificationCode("");
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardWrap}
      >
        <View style={styles.card}>
          <Image
            source={require("../assets/images/image.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.heading}>{t("auth_login_title")}</Text>
          <Text style={styles.subheading}>
            {isVerificationStep
              ? t("auth_verification_heading")
              : t("auth_login_subtitle")}
          </Text>

          {isVerificationStep ? (
            <>
              <Text style={styles.verificationHelper}>
                {t("auth_verification_helper")}
              </Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setVerificationCode}
                placeholder={t("auth_verification_code")}
                placeholderTextColor="#8D95A3"
                style={[styles.input, styles.verificationInput]}
                value={verificationCode}
              />
              <Pressable
                disabled={submitting}
                onPress={onVerifyCode}
                style={[styles.primaryButton, styles.verificationButton]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {t("auth_verify_code")}
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={resetVerificationStep}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  {t("auth_change_credentials")}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder={t("auth_email")}
                placeholderTextColor="#8D95A3"
                style={styles.input}
                value={email}
              />

              <View style={styles.passwordWrap}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setPassword}
                  placeholder={t("auth_password")}
                  placeholderTextColor="#8D95A3"
                  secureTextEntry={!showPassword}
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                />
                <Pressable
                  hitSlop={10}
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#7D8592"
                  />
                </Pressable>
              </View>

              <Link href="/forgot-password" style={styles.forgotLink}>
                {t("auth_forgot_password")}
              </Link>

              <Pressable
                disabled={submitting}
                onPress={onLogin}
                style={styles.primaryButton}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {t("auth_sign_in")}
                  </Text>
                )}
              </Pressable>

              {/* <View style={styles.footerRow}>
                <Text style={styles.footerText}>{t("auth_no_account")} </Text>
                <Link href="/register" style={styles.footerAction}>
                  {t("auth_register")}
                </Link>
              </View> */}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#7FD0C2",
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#F5F7FA",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
    shadowColor: "#0A3A32",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 8,
  },
  logo: {
    width: "100%",
    height: 92,
    marginBottom: 10,
  },
  heading: {
    textAlign: "center",
    fontSize: 36,
    fontWeight: "700",
    color: "#09101D",
  },
  subheading: {
    textAlign: "center",
    fontSize: 18,
    color: "#556070",
    marginTop: 4,
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CFD6DF",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
    fontSize: 17,
    color: "#101827",
    backgroundColor: "#FFFFFF",
  },
  passwordWrap: {
    marginTop: 12,
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: 16,
  },
  forgotLink: {
    alignSelf: "flex-end",
    color: "#0D5F37",
    marginTop: 12,
    marginBottom: 16,
    fontWeight: "600",
    fontSize: 14,
  },
  verificationInput: {
    marginTop: 12,
  },
  verificationButton: {
    marginTop: 14,
  },
  verificationHelper: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#52645E",
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#0F5D33",
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    height: 44,
  },
  secondaryButtonText: {
    color: "#0D5F37",
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  footerRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 16,
    color: "#2E3A4F",
  },
  footerAction: {
    fontSize: 16,
    color: "#0D5F37",
    fontWeight: "700",
  },
});
