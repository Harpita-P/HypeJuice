import { FileText, Sparkles, Users } from "lucide-react-native";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";
import { AgentWorkVisual } from "./AgentWorkVisual";
import { AgentTypingText } from "./AgentTypingText";

export function AppLearningModal({ visible }: { visible: boolean }) {
  return <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={styles.panel}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {visible ? <AgentWorkVisual active /> : null}
        <AgentTypingText accessibilityRole="header" style={styles.title}>I’m finding your app’s edge.</AgentTypingText>
        <Text style={styles.copy}>Going beyond the description to find what could make people care.</Text>
        <View style={styles.topics}>
          <View style={styles.topic}><View style={[styles.icon, { backgroundColor: "#FFF0A3" }]}><FileText size={20} color={colors.ink} /></View><View style={styles.words}><Text style={styles.topicTitle}>What makes it different</Text><Text style={styles.topicText}>Your features, benefits, and unique story</Text></View></View>
          <View style={styles.topic}><View style={[styles.icon, { backgroundColor: "#E6DBFF", borderRadius: 22 }]}><Users size={20} color={colors.ink} /></View><View style={styles.words}><Text style={styles.topicTitle}>Who could fall for it</Text><Text style={styles.topicText}>Potential audiences and what matters to them</Text></View></View>
          <View style={styles.topic}><View style={[styles.icon, { backgroundColor: "#DAEDB5", borderTopRightRadius: 24 }]}><Sparkles size={20} color={colors.ink} /></View><View style={styles.words}><Text style={styles.topicTitle}>Where the hooks are hiding</Text><Text style={styles.topicText}>Relatable angles worth turning into content</Text></View></View>
        </View>
        <View style={styles.status}><ActivityIndicator accessibilityLabel="Learning about your app" size="small" color={colors.green} /><Text style={styles.statusText}>Connecting the dots</Text></View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#171A1370" },
  panel: { width: "100%", maxWidth: 390, maxHeight: "92%", backgroundColor: colors.canvas, borderRadius: 32, overflow: "hidden" },
  content: { padding: 24, gap: 18 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 35, fontFamily: fonts.heading, letterSpacing: -0.5, textAlign: "center" },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  topics: { gap: 16 },
  topic: { flexDirection: "row", gap: 12, alignItems: "center" },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  words: { flex: 1, gap: 3 }, topicTitle: { fontFamily: fonts.heading, color: colors.ink, fontSize: 14, lineHeight: 20 },
  topicText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, statusText: { color: colors.green, fontSize: 12 },
});
