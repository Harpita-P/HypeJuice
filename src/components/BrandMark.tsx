import { Image, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";

type Props = {
  compact?: boolean;
  inverted?: boolean;
  size?: number;
};

export function BrandMark({ compact = false, inverted = false, size = 42 }: Props) {
  const ink = inverted ? colors.surface : colors.ink;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="HypeJuice" style={styles.row}>
      <Image source={require("../../hypejuice-logo.png")} resizeMode="contain" style={{ width: size, height: size, borderRadius: size * 0.24 }} />
      {!compact ? <Text style={[styles.wordmark, { color: ink }]}>HypeJuice</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
  wordmark: { fontFamily: fonts.heading, fontSize: 21, letterSpacing: -0.7 },
});
