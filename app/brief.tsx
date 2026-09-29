import { useRouter } from "expo-router";
import { ArrowLeft, Pencil } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppStoreGallery, ListingIcon } from "@/components/AppStoreGallery";
import { OnboardingStep } from "@/components/OnboardingStep";
import { BrandMark } from "@/components/BrandMark";
import { BriefEditSheet } from "@/components/BriefEditSheet";
import { DemoRecordingStep } from "@/components/DemoRecordingStep";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
import { useAppProfile } from "@/context/AppProfileContext";
import { colors, fonts } from "@/theme";
import { appMediaForSources, AppBriefSchema, type AppBrief, type BriefResponse } from "@shared/app-brief";
import { MAX_DEMO_CLIPS } from "@shared/creative-profile";
import { getDemoClipUri, releaseDemoClipUri } from "@/lib/demo-storage";

const STEPS = ["Share what you built", "Show how it works"];

export default function BriefScreen() {
  const router = useRouter();
  const { analysis, hydrated } = useAppProfile();
  return (
    <ScreenShell>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {!hydrated ? <View style={styles.empty}><BrandMark /><ActivityIndicator color={colors.green} /></View> :
        analysis ? <BriefFlow key={analysis.analyzedAt} initial={analysis} /> :
          <View style={styles.empty}>
            <BrandMark />
            <Text style={styles.title}>Let’s meet your app first.</Text>
            <PrimaryButton onPress={() => router.replace("/connect")}>Add your app</PrimaryButton>
          </View>}
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

function Field({ label, value, onChangeText, multiline = false }: { label: string; value: string; onChangeText: (text: string) => void; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} multiline={multiline} value={value} onChangeText={onChangeText} textAlignVertical={multiline ? "top" : "center"} style={[styles.editInput, multiline && styles.multiline]} /></View>;
}

function BriefFlow({ initial: loadedProfile }: { initial: BriefResponse }) {
  const [initial] = useState(loadedProfile);
  const router = useRouter();
  const { setAnalysis } = useAppProfile();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const step = page === 2 ? 1 : 0;
  const [draft, setDraft] = useState(initial.brief);
  const [clips, setClips] = useState(initial.demoClips ?? []);
  const [importing, setImporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [finishing, setFinishing] = useState(false);
  const [editor, setEditor] = useState<"product" | null>(null);
  const [editDraft, setEditDraft] = useState<AppBrief>(draft);
  const [editError, setEditError] = useState("");
  const [finishError, setFinishError] = useState("");
  const media = appMediaForSources(initial.sources);

  // Authenticated accounts persist these edits; local prototype mode remains session-only.
  useEffect(() => {
    if (!dirty) return;
    let active = true;
    const timer = setTimeout(() => {
      setSaveState("saving");
      setAnalysis({ ...initial, brief: draft, demoClips: clips, confirmedAt: null })
        .then(() => { if (active) { setSaveState("saved"); setDirty(false); } })
        .catch(() => { if (active) setSaveState("error"); });
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [draft, clips, dirty, initial, setAnalysis]);

  function changed() {
    setDirty(true);
    setSaveState("idle");
    setFinishError("");
  }

  function goTo(index: number) {
    if (importing || finishing) return;
    Keyboard.dismiss();
    setFinishError("");
    setPage(index === 1 ? 0 : index);
  }

  function openEditor(target: "product") {
    setEditDraft(draft);
    setEditError("");
    setEditor(target);
  }

  function saveEdits() {
    const cleaned = {
      ...editDraft,
      appName: editDraft.appName.trim(), oneLiner: editDraft.oneLiner.trim(),
      summary: editDraft.summary.trim(), category: editDraft.category.trim(),
      audiences: editDraft.audiences.map((audience) => ({ segment: audience.segment.trim(), situation: audience.situation.trim() })),
    };
    if (!AppBriefSchema.safeParse(cleaned).success) {
      setEditError("Give each field a little context before saving.");
      return;
    }
    setDraft(cleaned);
    changed();
    setEditor(null);
  }

  async function finish() {
    if (finishing || importing) return;
    const problem = !clips.length ? "Add a clip to get started." : clips.length > MAX_DEMO_CLIPS ? `Keep up to ${MAX_DEMO_CLIPS} clips.` : clips.some((clip) => !clip.shows.trim()) ? "Tell me what each clip shows." : null;
    if (problem) {
      setFinishError(problem);
      return;
    }
    setDirty(false);
    setFinishing(true);
    setFinishError("");
    try {
      for (const clip of clips) {
        const uri = await getDemoClipUri(clip);
        releaseDemoClipUri(uri);
      }
      const profile = { ...initial, brief: draft, demoClips: clips, confirmedAt: null };
      await setAnalysis(profile);
      router.push("/prepare-taste");
    } catch (reason) {
      setSaveState("error");
      setDirty(true);
      setFinishError(reason instanceof Error ? reason.message : "Your changes couldn’t be saved. Please try again.");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={page ? "Previous step" : "Back to app links"} onPress={() => page ? goTo(page - 1) : router.replace("/connect")} style={styles.back}>
          <ArrowLeft size={20} color={colors.ink} />
        </Pressable>
        <BrandMark />
      </View>

      <View style={styles.stepHeader}>
        <OnboardingStep number={step + 1} title={STEPS[step]} />
      </View>

      {step === 0 ? (
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.title}>Great, I’m getting{"\n"}the picture.</Text>
          <Text style={styles.introCopy}>Here’s what I know about your app</Text>
          <View style={styles.appReview}>
            <View style={styles.productIdentity}>
              {media ? <ListingIcon uri={media.iconUrl} name={draft.appName} /> : null}
              <View style={styles.identityCopy}><Text style={styles.appName}>{draft.appName}</Text><Text style={styles.category}>{draft.category}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit app details" onPress={() => openEditor("product")} style={styles.editButton}><Pencil size={16} color={colors.ink} /></Pressable>
            </View>
            <Text style={styles.oneLiner}>{draft.oneLiner}</Text>
            {media ? <AppStoreGallery urls={media.screenshotUrls} name={draft.appName} /> : null}
            <View style={styles.storyHeading}>
              <Text style={styles.sectionTitle}>Your app’s story</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit your app description" onPress={() => openEditor("product")} style={styles.editButton}><Pencil size={16} color={colors.ink} /></Pressable>
            </View>
            <Text style={styles.summary}>{draft.summary}</Text>
            <View style={styles.insightSection}>
              <Text style={styles.sectionTitle}>Potential audiences</Text>
              <View style={styles.audiencePills}>
                {draft.audiences.slice(0, 3).map((audience) => <View key={audience.segment} style={styles.audiencePill}><Text style={styles.audiencePillText}>{audience.segment}</Text></View>)}
              </View>
            </View>
            <View style={styles.insightSection}>
              <Text style={styles.sectionTitle}>App vibe</Text>
              <Text style={styles.vibeTags}>{(draft.appVibe ?? initial.brief.tone).slice(0, 3).join(" · ")}</Text>
            </View>
          </View>
          {initial.warnings.map((warning) => <Text key={warning} style={styles.warning}>{warning}</Text>)}
        </ScrollView>
      ) : (
        <ScrollView key={page} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.title}>Show me{"\n"}your app in action</Text>
          <DemoRecordingStep clips={clips} onBusyChange={setImporting} onChange={(next) => { setClips(next); changed(); }} />
          <Text style={styles.introCopy}>Next, we’ll make 3 videos to learn what kind of captions you love.</Text>
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {saveState === "error" || finishError ? <Text accessibilityRole="alert" style={styles.error}>{finishError || "Couldn’t save your draft. Please try again."}</Text> : null}
        {step === 0 ? <PrimaryButton onPress={() => goTo(2)}>Step 2 · App in action</PrimaryButton> :
          <PrimaryButton loading={finishing} disabled={importing} onPress={() => void finish()}>Step 3 · Content Taste</PrimaryButton>}
      </View>

      <BriefEditSheet title="Tell your story" visible={editor !== null} onClose={() => setEditor(null)} onSave={saveEdits} error={editError}>
        {editor === "product" ? <>
          <Field label="App name" value={editDraft.appName} onChangeText={(appName) => setEditDraft({ ...editDraft, appName })} />
          <Field label="Category" value={editDraft.category} onChangeText={(category) => setEditDraft({ ...editDraft, category })} />
          <Field label="Short description" value={editDraft.oneLiner} multiline onChangeText={(oneLiner) => setEditDraft({ ...editDraft, oneLiner })} />
          <Field label="Your app story" value={editDraft.summary} multiline onChangeText={(summary) => setEditDraft({ ...editDraft, summary })} />
        </> : null}
      </BriefEditSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { flex: 1, justifyContent: "center", padding: 24, gap: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 12 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 36, fontFamily: fonts.heading, letterSpacing: -0.6 },
  introCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  stepHeader: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 12 },
  page: { flexGrow: 1, paddingHorizontal: 22, gap: 18, paddingTop: 0, paddingBottom: 24 },
  appReview: { backgroundColor: colors.surface, borderRadius: 28, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 20 },
  storyHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  sectionTitle: { color: colors.ink, fontSize: 17, fontFamily: fonts.heading },
  insightSection: { gap: 12, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border },
  audiencePills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vibeTags: { color: colors.muted, fontSize: 15, lineHeight: 24, fontWeight: "500" },
  productIdentity: { flexDirection: "row", alignItems: "center", gap: 13 },
  identityCopy: { flex: 1, minWidth: 0 },
  appName: { color: colors.ink, fontSize: 21, fontFamily: fonts.heading, letterSpacing: -0.3 },
  category: { color: colors.green, fontSize: 11, fontWeight: "600", marginTop: 5 },
  editButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  oneLiner: { color: colors.ink, fontSize: 17, fontWeight: "500", lineHeight: 25, letterSpacing: -0.2 },
  summary: { color: colors.ink, fontSize: 17, lineHeight: 27 },
  warning: { color: "#856020", fontSize: 12, lineHeight: 18 },
  audiencePill: { maxWidth: "100%", backgroundColor: "#E9EEDC", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 24 },
  audiencePillText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  footer: { paddingHorizontal: 22, backgroundColor: colors.canvas, gap: 4 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.muted },
  editInput: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 16, padding: 14, minHeight: 52 },
  multiline: { minHeight: 100, lineHeight: 23 },
});
