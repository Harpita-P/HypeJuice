import { StyleSheet, Text, View } from "react-native";
import { AppStoreGallery, ListingIcon } from "@/components/AppStoreGallery";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { useAppProfile } from "@/context/AppProfileContext";
import { colors } from "@/theme";

export default function YourAppScreen() {
  const { analysis } = useAppProfile();
  if (!analysis) return null;
  const { brief } = analysis;
  const media = analysis.sources.find((source) => source.kind === "app_store")?.appStoreMedia;

  return <WorkspacePage title="Your App" subtitle="Here’s what I know about your app">
    <View style={s.panel}>
      <View style={local.identity}>
        {media ? <ListingIcon uri={media.iconUrl} name={brief.appName} /> : null}
        <View style={local.identityCopy}>
          <Text accessibilityRole="header" style={s.sectionTitle}>{brief.appName}</Text>
          <Text style={local.category}>{brief.category}</Text>
        </View>
      </View>
      <Text style={local.description}>{brief.oneLiner}</Text>
      {media ? <AppStoreGallery urls={media.screenshotUrls} name={brief.appName} /> : null}
    </View>
    <View style={s.panel}>
      <Text accessibilityRole="header" style={s.sectionTitle}>Your app’s story</Text>
      <Text style={local.description}>{brief.summary}</Text>
    </View>
    <View style={s.panel}>
      <Text accessibilityRole="header" style={s.sectionTitle}>Potential audiences</Text>
      <View style={local.pills}>{brief.audiences.slice(0, 3).map((audience) => <View key={audience.segment} style={local.pill}><Text style={local.audience}>{audience.segment}</Text></View>)}</View>
      <View style={local.vibe}>
        <Text accessibilityRole="header" style={s.sectionTitle}>App vibe</Text>
        <Text style={s.copy}>{(brief.appVibe ?? brief.tone).slice(0, 3).join(" · ")}</Text>
      </View>
    </View>
    {analysis.warnings.map((warning) => <Text key={warning} style={s.small}>{warning}</Text>)}
  </WorkspacePage>;
}

const local = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  identityCopy: { flex: 1, minWidth: 0, gap: 5 },
  category: { color: colors.green, fontSize: 12, lineHeight: 18 },
  description: { color: colors.ink, fontSize: 16, lineHeight: 25 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { maxWidth: "100%", backgroundColor: colors.greenSoft, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10 },
  audience: { color: colors.ink, fontSize: 13, lineHeight: 18 },
  vibe: { gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 18, marginTop: 4 },
});
