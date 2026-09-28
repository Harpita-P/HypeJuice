import { ArrowRight } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, fonts, radii } from "@/theme";

type Props = {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: "arrow" | "none";
  variant?: "dark" | "yellow";
};

export function PrimaryButton({
  children,
  onPress,
  disabled = false,
  loading = false,
  icon = "arrow",
  variant = "dark",
}: Props) {
  const isDisabled = disabled || loading;
  const backgroundColor = variant === "yellow" ? colors.yellow : colors.ink;
  const foregroundColor = variant === "yellow" ? colors.ink : colors.surface;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      <View style={styles.labelRow}>
        {loading ? <ActivityIndicator color={foregroundColor} /> : null}
        <Text style={[styles.label, { color: foregroundColor }]}>{children}</Text>
      </View>
      {!loading && icon === "arrow" ? (
        <View style={[styles.icon, { backgroundColor: foregroundColor }]}>
          <ArrowRight color={backgroundColor} size={19} strokeWidth={2.5} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 62,
    paddingHorizontal: 10,
    paddingLeft: 24,
    paddingVertical: 10,
  },
  disabled: { opacity: 0.5 },
  icon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  label: { fontSize: 16, fontFamily: fonts.heading, lineHeight: 22, flexShrink: 1 },
  labelRow: { alignItems: "center", flexDirection: "row", gap: 10, flex: 1, minWidth: 0, marginRight: 12 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
