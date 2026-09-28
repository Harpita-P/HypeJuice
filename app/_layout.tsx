import { Stack } from "expo-router";
import { Manrope_600SemiBold, useFonts } from "@expo-google-fonts/manrope";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProfileProvider } from "@/context/AppProfileContext";
import { ContentProvider } from "@/context/ContentContext";
import { colors } from "@/theme";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Manrope_600SemiBold });

  if (fontError) throw fontError;
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProfileProvider>
        <ContentProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.canvas },
              headerShown: false,
            }}
          />
        </ContentProvider>
      </AppProfileProvider>
    </SafeAreaProvider>
  );
}
