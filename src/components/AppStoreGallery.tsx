import { X } from "lucide-react-native";
import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme";

export function ListingIcon({ uri, name, size = 66 }: { uri: string | null | undefined; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return null;
  return <Image accessibilityLabel={`${name} app icon`} source={{ uri }} onError={() => setFailed(true)} style={[styles.icon, { width: size, height: size, borderRadius: size * 0.24 }]} />;
}

export function AppStoreGallery({ urls, name }: { urls: string[]; name: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const visible = urls.filter((url) => !failed.includes(url));
  if (!visible.length) return null;

  return (
    <View style={styles.gallery}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>A LOOK INSIDE</Text>
      </View>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles} accessibilityLabel="App Store screenshots">
        {visible.map((uri, index) => (
          <Pressable key={uri} accessibilityRole="button" accessibilityLabel={`View ${name} screenshot ${index + 1}`} onPress={() => setSelected(uri)} style={styles.tile}>
            <Image source={{ uri }} style={styles.screenshot} resizeMode="contain" onError={() => setFailed((current) => [...current, uri])} />
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.preview}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewLabel}>App Store screenshot</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close screenshot" onPress={() => setSelected(null)} style={styles.close}><X size={23} color="white" /></Pressable>
          </View>
          {selected ? <Image accessibilityLabel={`${name} screenshot`} source={{ uri: selected }} resizeMode="contain" style={styles.fullImage} /> : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 66, height: 66, borderRadius: 16, borderWidth: 1, borderColor: "#0000000D" },
  gallery: { gap: 12, marginTop: 8 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 5 },
  label: { color: colors.muted, fontSize: 9, letterSpacing: 1.1, fontWeight: "800" },
  hint: { fontSize: 9, color: colors.muted },
  tiles: { gap: 10, paddingBottom: 4 },
  tile: { width: 76, height: 152, borderRadius: 13, overflow: "hidden", backgroundColor: "#F1F2ED", borderWidth: 1, borderColor: "#E5E6DE" },
  screenshot: { width: "100%", height: "100%" },
  preview: { flex: 1, backgroundColor: "#10120FF5", padding: 20 },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 15 },
  previewLabel: { fontSize: 14, fontWeight: "600", color: "white" },
  close: { padding: 12 },
  fullImage: { flex: 1, width: "100%", marginVertical: 20 },
});
