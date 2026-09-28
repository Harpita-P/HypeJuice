import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "react-native";
import { BackToLibraryButton } from "@/components/BackToLibraryButton";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { VideoVariationPager } from "@/components/VideoVariationPager";
import { ContentActions } from "@/components/ContentCard";
import { useContent } from "@/context/ContentContext";
import { groupLibraryItems } from "@shared/library";

export default function VariationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { concepts } = useContent();
  const group = groupLibraryItems(concepts, "Most recent").find((entry) => entry.variations.some((item) => item.id === id));
  const variations = group?.variations.filter((item) => item.rendered) ?? [];
  return <WorkspacePage title="Caption variations" subtitle="Same footage. Different ways to tell it.">
    <BackToLibraryButton />
    {variations.length ? <VideoVariationPager key={group!.groupId} gallery videos={variations.map((item) => ({ id: item.id, jobId: item.rendered!.jobId, url: item.rendered!.url, post: item.post, hook: item.hook }))} onEditCaptions={(jobId) => router.navigate({ pathname: "/(main)/studio", params: { reuseJobId: jobId } })} renderActions={(selectedId) => {
      const item = variations.find((entry) => entry.id === selectedId)!;
      return <ContentActions item={item} />;
    }} /> : <Text style={s.copy}>These variations are no longer available in this workspace.</Text>}
  </WorkspacePage>;
}
