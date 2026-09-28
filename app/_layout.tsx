import { Stack } from "expo-router";
import { Manrope_600SemiBold, useFonts } from "@expo-google-fonts/manrope";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProfileProvider } from "@/context/AppProfileContext";
import { ContentProvider } from "@/context/ContentContext";
import { AuthProvider } from "@/context/AuthContext";
import { BillingProvider } from "@/context/BillingContext";
import { colors } from "@/theme";
import { BrandMark } from "@/components/BrandMark";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Manrope_600SemiBold });

  if (fontError) throw fontError;
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", gap: 20 }}>
        <BrandMark compact size={80} />
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
      <BillingProvider>
      <AppProfileProvider>
        <ContentProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.canvas },
              headerShown: false,
            }}
          >
            {/* Horizontal review gestures belong to cards, not native back navigation. */}
            <Stack.Screen name="taste" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(main)" options={{ gestureEnabled: false }} />
          </Stack>
        </ContentProvider>
      </AppProfileProvider>
      </BillingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
