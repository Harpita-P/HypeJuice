import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { ContentCard } from "@/components/ContentCard";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { useContent } from "@/context/ContentContext";

export default function ContentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { concepts } = useContent();
  const item = concepts.find((entry) => entry.id === id);
  return <WorkspacePage title={item?.title ?? "Content unavailable"} subtitle={item ? `${item.source === "studio" ? "Studio" : "Agent"} created · captions are editable; footage stays unchanged` : "This prototype resets when you reload."}>
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/(main)/library")} style={s.chip}><Text style={s.copy}>Back to Library</Text></Pressable>
    {item ? <ContentCard item={item} /> : null}
  </WorkspacePage>;
}
