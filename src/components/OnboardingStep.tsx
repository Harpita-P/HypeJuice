import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

export function OnboardingStep({ number, title }: { number: number; title: string }) {
  return <View accessible accessibilityLabel={`Step ${number} of 3: ${title}`} style={styles.row}>
    <View style={styles.circle}><Text style={styles.number}>{number}</Text></View>
    <Text style={styles.title}>{title}</Text>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.yellow, alignItems: "center", justifyContent: "center" },
  number: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  title: { flex: 1, color: colors.ink, fontSize: 18, lineHeight: 25, fontFamily: fonts.heading, letterSpacing: -0.2 },
});
