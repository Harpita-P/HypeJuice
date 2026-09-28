import { useEffect, useState } from "react";
import { useIsFocused } from "expo-router";
import { Text, View } from "react-native";
import { useAppProfile } from "@/context/AppProfileContext";
import { DemoRecordingStep } from "./DemoRecordingStep";
import { PrimaryButton } from "./PrimaryButton";
import { workspace as s } from "./WorkspacePage";
import { colors } from "@/theme";

export function AppDemoLibrary() {
  const { analysis, setAnalysis } = useAppProfile();
  const focused = useIsFocused();
  const [clips, setClips] = useState(analysis?.demoClips ?? []);
  const [dirty, setDirty] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!dirty) setClips(analysis?.demoClips ?? []); }, [analysis?.demoClips, dirty]);
  async function save() {
    if (!analysis || saving) return;
    setSaving(true); setError("");
    try { await setAnalysis({ ...analysis, demoClips: clips }); setDirty(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t save demo clips. Try again."); }
    finally { setSaving(false); }
  }
  return <View style={s.panel}>
    <Text style={s.sectionTitle}>Your app in action</Text>
    <View pointerEvents={saving ? "none" : "auto"} style={{ opacity: saving ? 0.6 : 1 }}><DemoRecordingStep clips={clips} onChange={(values) => { setClips(values); setDirty(true); }} onBusyChange={setPicking} autoPlay={focused} /></View>
    <Text style={s.small}>Used automatically in new videos. Removing a clip here won’t change videos already created.</Text>
    {dirty ? <PrimaryButton loading={saving} disabled={saving || picking} onPress={() => void save()}>Save demo clips</PrimaryButton> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
  </View>;
}
