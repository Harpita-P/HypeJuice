import { useEffect, useRef, useState } from "react";
import { useIsFocused, useRouter } from "expo-router";
import { ArrowDownUp, Check, ChevronDown, Bookmark, Layers, Plus, UserRound } from "lucide-react-native";
import { AppState, FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from "react-native";
import { workspace as s } from "@/components/WorkspacePage";
import { ScreenShell } from "@/components/ScreenShell";
import { BrandMark } from "@/components/BrandMark";
import { LibraryVideoPreview } from "@/components/LibraryVideoPreview";
import type { ContentConcept } from "@shared/content";
import { groupLibraryItems, libraryLaunchLabel, type LibraryGroup, type LibrarySort } from "@shared/library";
import { useContent } from "@/context/ContentContext";
import { colors, fonts } from "@/theme";

export default function LibraryScreen() {
  const router = useRouter();
  const { concepts, act, feedback } = useContent();
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<LibrarySort>("Most recent");
  const [sortOpen, setSortOpen] = useState(false);
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<ContentConcept>[] }) => {
    setVisible(new Set(viewableItems.map(({ item }) => item.id)));
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => subscription.remove();
  }, []);
  const allGroups = groupLibraryItems(concepts, sort);
  const favorites = groupLibraryItems(concepts, sort, true);
  const shown = filter === "All" ? allGroups : favorites;
  function open(item: LibraryGroup) {
    router.push({ pathname: item.variations.length > 1 ? "/variations/[id]" : "/content/[id]", params: { id: item.id } });
  }
  return <ScreenShell><FlatList
    data={shown}
    keyExtractor={(item) => item.groupId}
    numColumns={2}
    contentContainerStyle={s.content}
    columnWrapperStyle={local.grid}
    showsVerticalScrollIndicator={false}
    initialNumToRender={6}
    maxToRenderPerBatch={6}
    windowSize={5}
    onViewableItemsChanged={onViewableItemsChanged}
    viewabilityConfig={viewabilityConfig}
    extraData={{ visible, focused, appActive }}
    ListHeaderComponent={<View style={local.header}>
    <View style={s.brand}><BrandMark /></View>
    <View style={s.heading}><Text accessibilityRole="header" style={s.title}>Your library</Text></View>
    {feedback.error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{feedback.error}</Text> : null}
    <View style={local.filters}>{["All", "Saved"].map((label) => <Pressable key={label} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: filter === label }} onPress={() => setFilter(label)} style={({ pressed }) => [local.filterPill, filter === label && local.filterSelected, pressed && { opacity: 0.8 }]}>
      {label === "Saved" ? <Bookmark size={16} color={filter === label ? colors.surface : colors.ink} /> : null}
      <Text style={[local.filterText, filter === label && local.filterTextSelected]}>{label}</Text>
      <View style={[local.filterCount, filter === label && local.filterCountSelected]}><Text style={[local.countText, filter === label && local.filterTextSelected]}>{label === "All" ? allGroups.length : favorites.length}</Text></View>
    </Pressable>)}</View>
    <View style={local.sortSection}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Sort by ${sort}`} accessibilityState={{ expanded: sortOpen }} onPress={() => setSortOpen(!sortOpen)} style={local.sortButton}>
        <ArrowDownUp size={15} color={colors.muted} /><Text style={s.small}>Sort by</Text><Text style={local.sortValue}>{sort}</Text><ChevronDown size={15} color={colors.ink} style={sortOpen ? { transform: [{ rotate: "180deg" }] } : undefined} />
      </Pressable>
      {sortOpen ? <View style={local.sortMenu}>{(["Most recent", "Oldest first"] as const).map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: sort === option }} onPress={() => { setSort(option); setSortOpen(false); }} style={[local.sortOption, sort === option && local.sortOptionSelected]}>
        <Text style={local.sortValue}>{option}</Text>{sort === option ? <Check size={16} color={colors.green} /> : null}
      </Pressable>)}</View> : null}
    </View>
    </View>}
    renderItem={({ item }) => <View style={local.tile}>
      <View style={[local.poster, item.source === "studio" && local.studio]}>
        {item.rendered ? focused && appActive && visible.has(item.id)
          ? <LibraryVideoPreview key={item.rendered.url} uri={item.rendered.url} jobId={item.rendered.jobId} /> : null
          : <><UserRound size={24} color={colors.yellow} /><Text numberOfLines={5} style={local.hook}>{item.hook}</Text><Text style={local.preview}>CONCEPT PREVIEW</Text></>}
        <Pressable accessibilityRole="button" accessibilityLabel={item.variations.length > 1 ? `Open ${item.variations.length} caption variations` : "Open " + item.title} onPress={() => open(item)} style={StyleSheet.absoluteFill} />
        {item.variations.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.variations.length} caption variations`} onPress={() => open(item)} style={local.variationBadge}><Layers size={15} color="white" /><Text style={local.variationText}>{item.variations.length} variations</Text></Pressable> : null}
        {item.variations.some((entry) => entry.queued) ? <View pointerEvents="none" style={local.launchBadge}>
          <Check size={12} strokeWidth={2.5} color={colors.yellow} />
          <Text style={local.badgeText}>{item.variations.length > 1 ? "In launch bucket" : libraryLaunchLabel(item)}</Text>
        </View> : null}
        <View style={local.actionPill}>
          {item.variations.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Choose a caption variation" onPress={() => open(item)} style={local.chooseVariation}><Text style={local.variationText}>Choose variation</Text><Plus size={18} color="white" /></Pressable> : <>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.saved ? "Remove from" : "Save to"} bookmarks: ${item.title}`} accessibilityState={{ selected: item.saved }} onPress={() => act(item.id, item.saved ? "unsave" : "save")} style={({ pressed }) => [local.tileAction, item.saved && local.favorite, pressed && local.pressed]}>
            <Bookmark size={20} strokeWidth={1.8} color={item.saved ? "#F5D648" : colors.surface} fill={item.saved ? "#F5D648" : "transparent"} />
          </Pressable>
          <View style={local.actionDivider} />
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.queued ? "Remove from" : "Add to"} Launch Bucket: ${item.title}`} accessibilityHint="Changes your launch selection; does not publish the video." accessibilityState={{ selected: item.queued }} onPress={() => act(item.id, item.queued ? "unqueue" : "queue")} style={({ pressed }) => [local.tileAction, item.queued && local.inBucket, pressed && local.pressed]}>
            {item.queued ? <Check size={21} strokeWidth={2} color={colors.yellow} /> : <Plus size={22} strokeWidth={1.8} color={colors.surface} />}
          </Pressable>
          </>}
        </View>
      </View>
    </View>}
    ListEmptyComponent={<View style={s.panel}><Text style={s.sectionTitle}>Nothing here yet</Text><Text style={s.copy}>Try another filter, save something in Discover, or make your own in Studio.</Text></View>}
  /></ScreenShell>;
}

const local = StyleSheet.create({
  filters: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  filterPill: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { fontFamily: fonts.heading, fontSize: 14, color: colors.ink },
  filterTextSelected: { color: colors.surface },
  filterCount: { minWidth: 23, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, alignItems: "center", backgroundColor: colors.canvas },
  filterCountSelected: { backgroundColor: "#FFFFFF26" },
  countText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  sortSection: { gap: 8, marginTop: -10 },
  sortButton: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7 },
  sortValue: { color: colors.ink, fontSize: 12, fontFamily: fonts.heading },
  sortMenu: { padding: 5, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  sortOption: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sortOptionSelected: { backgroundColor: colors.greenSoft },
  header: { gap: 22 },
  grid: { gap: 12 },
  tile: { flex: 1, maxWidth: "50%" },
  poster: { aspectRatio: 9 / 16, padding: 14, backgroundColor: colors.ink, borderRadius: 20, justifyContent: "space-between", overflow: "hidden" },
  launchBadge: { position: "absolute", top: 10, left: 10, maxWidth: "90%", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, backgroundColor: "#171A13CC" },
  badgeText: { color: colors.yellow, fontSize: 10, fontFamily: fonts.heading, flexShrink: 1 },
  variationBadge: { position: "absolute", bottom: 68, left: 10, right: 10, minHeight: 36, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#171A13CC" },
  variationText: { color: "white", fontSize: 11, fontFamily: fonts.heading, flexShrink: 1 }, chooseVariation: { minHeight: 44, flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 10 },
  actionPill: { position: "absolute", bottom: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 3, padding: 3, borderRadius: 28, backgroundColor: "#171A1399", borderWidth: 1, borderColor: "#FFFFFF26", boxShadow: "0 3px 12px rgba(0, 0, 0, 0.12)" },
  tileAction: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  actionDivider: { width: 1, height: 18, backgroundColor: "#FFFFFF26" },
  favorite: { backgroundColor: "#F5D6481F" },
  inBucket: { backgroundColor: "#F5D64826" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  studio: { backgroundColor: "#454251" },
  hook: { color: colors.surface, fontSize: 17, lineHeight: 23, fontFamily: fonts.heading },
  preview: { color: "#BFC4B6", fontSize: 8, letterSpacing: 0.6, marginBottom: 54 },
});
