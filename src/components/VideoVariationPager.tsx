import { useEffect, useState, type ReactNode } from "react";
import { useIsFocused } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { PostCopy } from "@shared/post-copy";
import { colors, fonts } from "@/theme";
import { RenderedVideo } from "./RenderedVideo";
import { LibraryVideoPreview } from "./LibraryVideoPreview";

type Video = { id: string; jobId: string; url: string; post?: PostCopy; hook?: string };
export function VideoVariationPager({ videos, gallery = false, renderActions, onEditCaptions }: { videos: Video[]; gallery?: boolean; renderActions?: (id: string) => ReactNode; onEditCaptions?: (jobId: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const focused = useIsFocused();
  const { height } = useWindowDimensions();
  const index = Math.max(0, videos.findIndex((video) => video.id === selected));
  const video = videos[index];
  useEffect(() => { if (video && video.id !== selected) setSelected(video.id); }, [video?.id, selected]);
  if (!video) return null;
  return <View style={s.body}>
    {focused ? <RenderedVideo key={video.jobId} uri={video.url} jobId={video.jobId} post={video.post} autoPlay compactActions onEditCaptions={onEditCaptions ? () => onEditCaptions(video.jobId) : undefined} height={Math.max(260, Math.min(540, height - 380))} /> : null}
    <View style={s.navigation}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous variation" disabled={index === 0} onPress={() => setSelected(videos[index - 1].id)} style={[s.arrow, index === 0 && s.disabled]}><ChevronLeft size={24} color={colors.ink} /></Pressable>
      <Text accessibilityLiveRegion="polite" style={s.count}>Variation {index + 1} of {videos.length}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next variation" disabled={index === videos.length - 1} onPress={() => setSelected(videos[index + 1].id)} style={[s.arrow, index === videos.length - 1 && s.disabled]}><ChevronRight size={24} color={colors.ink} /></Pressable>
    </View>
    {renderActions?.(video.id)}
    {gallery ? <FlatList horizontal data={videos} keyExtractor={(entry) => entry.id} initialNumToRender={3} maxToRenderPerBatch={3} windowSize={3} extraData={{ selected, focused }} showsHorizontalScrollIndicator={false} contentContainerStyle={s.gallery} renderItem={({ item: entry, index: i }) => <Pressable accessibilityRole="button" accessibilityLabel={`Choose variation ${i + 1}`} accessibilityState={{ selected: video.id === entry.id }} onPress={() => setSelected(entry.id)} style={[s.thumbnail, video.id === entry.id && s.selected]}>
      {focused ? <LibraryVideoPreview uri={entry.url} jobId={entry.jobId} /> : null}
      <View pointerEvents="none" style={s.caption}><Text style={s.number}>{i + 1}</Text><Text numberOfLines={2} style={s.hook}>{entry.hook}</Text></View>
    </Pressable>} /> : null}
  </View>;
}
const s = StyleSheet.create({
  body: { gap: 12 }, navigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, arrow: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFE044", alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.3 }, count: { color: colors.ink, fontSize: 13, fontFamily: fonts.heading }, gallery: { gap: 10, paddingVertical: 4 }, thumbnail: { width: 104, height: 154, borderRadius: 16, borderWidth: 3, borderColor: "transparent", overflow: "hidden", backgroundColor: colors.ink }, selected: { borderColor: "#D9B800" }, caption: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 6, gap: 4, backgroundColor: "#000000AA" }, number: { color: "#FFE044", fontFamily: fonts.heading, fontSize: 12 }, hook: { color: "white", fontSize: 10, lineHeight: 14 },
});
