import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark } from "@/components/BrandMark";
import { PlusPaywall } from "@/components/PlusPaywall";
import { ScreenShell } from "@/components/ScreenShell";
import { useAppProfile } from "@/context/AppProfileContext";
import { colors } from "@/theme";

export default function PaywallScreen() {
  const router = useRouter();
  const { analysis } = useAppProfile();
  const insets = useSafeAreaInsets();
  return <ScreenShell>
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 8, gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to welcome" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}><ChevronLeft color={colors.ink} /></Pressable>
      <BrandMark size={32} />
    </View>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 20) }}>
      <PlusPaywall onContinue={() => router.replace(analysis?.confirmedAt ? "/(main)/home" : analysis ? "/brief" : "/connect")} />
    </ScrollView>
  </ScreenShell>;
}
