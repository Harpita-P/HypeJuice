import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";

export default function PlansScreen() {
  return <WorkspacePage compact title="Your plan" subtitle="Discover for free. Create your own way with Studio.">
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/(main)/your-app")}><Text style={s.copy}>← Back</Text></Pressable>
    <SubscriptionPlans />
  </WorkspacePage>;
}
