import { Banana } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";

type Props = {
  compact?: boolean;
  inverted?: boolean;
};

export function BrandMark({ compact = false, inverted = false }: Props) {
  const ink = inverted ? colors.surface : colors.ink;

  return (
    <View style={styles.row}>
      <View style={[styles.mark, inverted && styles.markInverted]}>
        <Banana color={colors.ink} size={compact ? 20 : 23} strokeWidth={2.8} />
      </View>
      {!compact ? <Text style={[styles.wordmark, { color: ink }]}>GrowthBanana</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
  mark: {
    alignItems: "center",
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 13,
    borderWidth: 1.5,
    height: 42,
    justifyContent: "center",
    transform: [{ rotate: "-5deg" }],
    width: 42,
  },
  markInverted: { borderColor: colors.yellowSoft },
  wordmark: { fontSize: 21, fontWeight: "800", letterSpacing: -0.7 },
});
