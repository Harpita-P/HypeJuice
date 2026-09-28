import { Redirect, Tabs } from "expo-router";
import { Smartphone, House, Layers3, Send, Clapperboard } from "lucide-react-native";
import { useAppProfile } from "@/context/AppProfileContext";
import { colors, fonts } from "@/theme";

export default function MainLayout() {
  const { analysis, hydrated } = useAppProfile();
  if (!hydrated) return null;
  if (!analysis) return <Redirect href="/connect" />;
  if (!analysis.confirmedAt) return <Redirect href="/taste" />;
  return <Tabs initialRouteName="home" screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarLabelStyle: { fontFamily: fonts.heading, fontSize: 10 },
  }}>
    <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
    <Tabs.Screen name="library" options={{ title: "Library", tabBarIcon: ({ color, size }) => <Layers3 color={color} size={size} /> }} />
    <Tabs.Screen name="studio" options={{ title: "Studio", tabBarIcon: ({ color, size }) => <Clapperboard color={color} size={size} /> }} />
    <Tabs.Screen name="launch" options={{ title: "Launch Bucket", tabBarIcon: ({ color, size }) => <Send color={color} size={size} /> }} />
    <Tabs.Screen name="your-app" options={{ title: "Your App", tabBarIcon: ({ color, size }) => <Smartphone color={color} size={size} /> }} />
  </Tabs>;
}
