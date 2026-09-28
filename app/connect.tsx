import { useRouter } from "expo-router";
import { ArrowLeft, Check, Globe2, Link2 } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppStoreMark } from "@/components/AppStoreMark";
import { BrandMark } from "@/components/BrandMark";
import { AppLearningModal } from "@/components/AppLearningModal";
import { OnboardingStep } from "@/components/OnboardingStep";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
import { useAppProfile } from "@/context/AppProfileContext";
import { createAppBrief } from "@/lib/api";
import { colors, fonts, radii } from "@/theme";

export default function ConnectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setAnalysis } = useAppProfile();
  const [source, setSource] = useState<"app_store" | "website">("app_store");
  const [appStoreUrl, setAppStoreUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isStore = source === "app_store";
  const selectedUrl = isStore ? appStoreUrl : websiteUrl;

  async function handleAnalyze() {
    if (!selectedUrl.trim() || loading) return;
    Keyboard.dismiss();
    setError("");
    setLoading(true);
    try {
      const result = await createAppBrief({
        appStoreUrl: isStore ? appStoreUrl.trim() : "",
        websiteUrl: isStore ? "" : websiteUrl.trim(),
        founderNote: "",
      });
      await setAnalysis(result);
      router.push("/brief");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not read your app. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
              <ArrowLeft color={colors.ink} size={21} />
            </Pressable>
            <BrandMark compact />
          </View>

          <View style={styles.heading}>
            <OnboardingStep number={1} title="Share what you built" />
            <Text style={styles.title}>You’ve built something great.{"\n"}Let’s see it.</Text>
            <Text style={styles.subtitle}>Share a link to your app to get started.</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.sourceOptions}>
            {(["app_store", "website"] as const).map((option) => {
              const selected = source === option;
              return (
                <Pressable
                  key={option} accessibilityRole="radio" aria-checked={selected} accessibilityState={{ checked: selected, disabled: loading }}
                  accessibilityLabel={option === "app_store" ? "Use App Store link" : "Use website link"}
                  disabled={loading} onPress={() => { setSource(option); setError(""); }}
                  style={[styles.sourceCard, selected && styles.sourceSelected]}
                >
                  <View style={styles.sourceTop}>
                    {option === "app_store" ? <AppStoreMark size={48} /> : <View style={styles.webMark}><Globe2 color="#504A90" size={27} strokeWidth={1.7} /></View>}
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <Check color={colors.surface} size={12} strokeWidth={3} /> : null}
                    </View>
                  </View>
                  <Text style={styles.sourceTitle}>{option === "app_store" ? "App Store" : "Website"}</Text>
                </Pressable>
              );
            })}
            </View>
            <View style={styles.linkField}>
              <Text style={styles.label}>{isStore ? "App Store link" : "Website link"}</Text>
            <View style={styles.inputRow}>
              <Link2 color={colors.muted} size={19} />
              <TextInput
                accessibilityLabel={isStore ? "App Store link" : "Website link"}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!loading}
                placeholder={isStore ? "apps.apple.com/app/your-app/id…" : "yourapp.com"}
                placeholderTextColor="#96998E" style={styles.urlInput} value={selectedUrl}
                onChangeText={isStore ? setAppStoreUrl : setWebsiteUrl} returnKeyType="done"
              />
            </View>
            </View>
          </View>

        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <PrimaryButton disabled={!selectedUrl.trim() || loading} onPress={handleAnalyze}>Analyze with Growth Agent</PrimaryButton>
        </View>
      </KeyboardAvoidingView>
      <AppLearningModal visible={loading} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { paddingHorizontal: 22, paddingTop: 12, gap: 10, backgroundColor: colors.canvas },
  content: { flexGrow: 1, gap: 28, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  heading: { gap: 12 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontFamily: fonts.heading },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  sourceOptions: { flexDirection: "row", gap: 12 },
  sourceCard: { flex: 1, backgroundColor: "#F7F7F3", borderRadius: 19, borderWidth: 1.5, borderColor: colors.border, padding: 14, gap: 5 },
  sourceSelected: { borderColor: colors.ink, backgroundColor: "#FFFDF5", shadowColor: colors.ink, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  sourceTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  webMark: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#EAE5FF", alignItems: "center", justifyContent: "center" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  sourceTitle: { color: colors.ink, fontSize: 16, fontFamily: fonts.heading },
  formCard: { backgroundColor: colors.surface, borderRadius: radii.large, padding: 18, gap: 22, borderWidth: 1, borderColor: "#E5E3DA" },
  linkField: { gap: 10 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F7F7F3", borderRadius: 14, paddingHorizontal: 13, borderColor: "#E6E6DF", borderWidth: 1 },
  urlInput: { flex: 1, minWidth: 0, minHeight: 54, fontSize: 14, color: colors.ink, paddingVertical: 12 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
