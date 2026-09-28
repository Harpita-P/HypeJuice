import { useId, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { PostCopy } from "@shared/post-copy";
import { colors, fonts } from "@/theme";

/** Viewing UI only: this footer is never included in downloaded/shared MP4s. */
export function PostCopyPanel({ post }: { post?: PostCopy }) {
  const [open, setOpen] = useState(false);
  const gradientId = `post-footer-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!post) return null; // Old renders are left intact; never silently request a backfill.
  const content = <View style={s.panel}>
    <Text accessibilityRole="header" style={s.title}>Post caption</Text>
    <Text style={s.hint}>For your post, not on the video · select text to copy</Text>
    <Text selectable style={s.copy}>{post.caption}{"\n\n"}{post.hashtags.join(" ")}</Text>
  </View>;
  return <>
    <View pointerEvents="box-none" style={s.footer}>
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0} />
          <Stop offset="0.35" stopColor="#000000" stopOpacity={0.32} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.85} />
        </LinearGradient></Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <Pressable accessibilityRole="button" accessibilityLabel="View post caption and hashtags" accessibilityHint="Opens the full post text to read and copy." onPress={() => setOpen(true)} style={s.preview}>
        <Text numberOfLines={2} ellipsizeMode="tail" style={s.caption}>{post.caption}</Text>
        <Text numberOfLines={1} ellipsizeMode="tail" style={s.hashtags}>{post.hashtags.join(" ")}</Text>
        <Text style={s.more}>more</Text>
      </Pressable>
    </View>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={s.backdrop}><View style={s.sheet}>
        <ScrollView>{content}</ScrollView>
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={s.button}><Text style={s.link}>Done</Text></Pressable>
      </View></View>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  // Leave the bottom strip available for native playback/scrubbing controls.
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 30, paddingHorizontal: 16, paddingBottom: 40 },
  preview: { gap: 4, alignItems: "flex-start", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.5)" },
  caption: { color: "#FFFFFF", fontSize: 13, lineHeight: 18, fontWeight: "500", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hashtags: { color: "#FFFFFF", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  more: { color: "#DDDDDD", fontSize: 11, lineHeight: 15 },
  panel: { padding: 16, borderRadius: 20, backgroundColor: colors.canvas, gap: 10 },
  title: { fontFamily: fonts.heading, color: colors.ink, fontSize: 16 },
  hint: { fontSize: 11, color: colors.muted, lineHeight: 17 },
  copy: { fontSize: 15, color: colors.ink, lineHeight: 23 },
  button: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  link: { fontFamily: fonts.heading, fontSize: 12, color: colors.green },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 22 },
  sheet: { maxHeight: "80%", backgroundColor: colors.surface, borderRadius: 24, padding: 16 },
});
