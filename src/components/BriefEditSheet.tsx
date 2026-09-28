import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { colors, fonts } from "@/theme";

export function BriefEditSheet({ title, visible, onClose, onSave, error, children, saveLabel = "Save changes", saveDisabled = false, saveLoading = false }: {
  title: string;
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  error: string;
  children: ReactNode;
  saveLabel?: string;
  saveDisabled?: boolean;
  saveLoading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss editor" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel editing" onPress={onClose} style={styles.close}><X size={21} color={colors.ink} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <PrimaryButton onPress={onSave} icon="none" disabled={saveDisabled} loading={saveLoading}>{saveLabel}</PrimaryButton>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#171A1370", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: "88%", width: "100%", maxWidth: 560, alignSelf: "center", padding: 22, gap: 16 },
  grabber: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: colors.ink, fontSize: 23, fontFamily: fonts.heading, letterSpacing: -0.3, flex: 1 },
  close: { padding: 10, backgroundColor: "#EAE9DF", borderRadius: 24 },
  content: { gap: 16, paddingBottom: 12 },
  error: { color: colors.danger, fontSize: 13 },
});
