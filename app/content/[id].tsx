import { useLocalSearchParams } from "expo-router";
import { BackToLibraryButton } from "@/components/BackToLibraryButton";
import { ContentCard } from "@/components/ContentCard";
import { WorkspacePage } from "@/components/WorkspacePage";
import { useContent } from "@/context/ContentContext";

export default function ContentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { concepts } = useContent();
  const item = concepts.find((entry) => entry.id === id);
  return <WorkspacePage title={item?.title ?? "Content unavailable"} subtitle={item ? `${item.source === "studio" ? "Studio" : "Agent"} created · captions are editable; footage stays unchanged` : "This prototype resets when you reload."}>
    <BackToLibraryButton />
    {item ? <ContentCard item={item} /> : null}
  </WorkspacePage>;
}
