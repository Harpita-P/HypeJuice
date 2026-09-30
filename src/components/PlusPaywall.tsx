import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Clapperboard, Sparkles, WandSparkles } from "lucide-react-native";
import { useBilling } from "@/context/BillingContext";
import { purchaseEnvironment } from "@/lib/purchases";
import { plusOffer } from "@/lib/plus-offer";
import { PrimaryButton } from "./PrimaryButton";
import { colors, fonts } from "@/theme";

const terms = process.env.EXPO_PUBLIC_TERMS_URL;
const privacy = process.env.EXPO_PUBLIC_PRIVACY_URL;
const legalReady = Boolean(terms?.startsWith("https://") && privacy?.startsWith("https://"));

export function PlusPaywall({ onContinue }: { onContinue?: () => void }) {
  const billing = useBilling();
  const environment = purchaseEnvironment();
  const item = billing.packages.pro;
  const offer = plusOffer(item, { testStore: environment.testStore, preview: __DEV__, platform: Platform.OS, eligible: billing.plusTrialEligible });
  const subscribed = Boolean(billing.status?.verified && billing.status.tier !== "free");
  const canBuy = environment.available && Boolean(item && billing.status) && (environment.testStore || legalReady);
  const checking = billing.loading || billing.productsLoading;
  const purchaseDisabled = !canBuy || checking || billing.busy || subscribed;
  async function purchase() {
    if (await billing.purchase("pro")) onContinue?.();
  }
  async function restore() {
    if (await billing.restore()) onContinue?.();
  }

  return <View style={s.content}>
    <View style={s.hero}>
      <View style={s.spark}><Sparkles size={33} color={colors.ink} strokeWidth={1.8} /></View>
      <View style={s.label}><Text style={s.labelText}>HYPEJUICE PRO</Text></View>
      <Text accessibilityRole="header" style={s.title}>{subscribed ? "You’ve got the Pro treatment." : "Big ideas.\nA little more juice."}</Text>
      <Text style={s.subtitle}>Your Growth Agent, with the creative controls to make it yours.</Text>
    </View>

    <View style={s.features}>
      {[
        { Icon: Sparkles, text: "Fresh content made for your app", fill: "#E6D9FB" },
        { Icon: Clapperboard, text: "The creator library, at your fingertips", fill: "#FFD4B7" },
        { Icon: WandSparkles, text: "Your own creators and captions in Studio", fill: colors.yellowSoft },
      ].map(({ Icon, text, fill }) => <View key={text} style={s.feature}>
        <View style={[s.featureIcon, { backgroundColor: fill }]}><Icon size={21} color={colors.ink} /></View>
        <Text style={s.featureText}>{text}</Text><Check size={17} color={colors.green} />
      </View>)}
    </View>

    <Pressable accessibilityRole="button" accessibilityLabel="Choose Pro plan" disabled={purchaseDisabled} onPress={() => void purchase()} style={({ pressed }) => [s.plan, pressed && { opacity: 0.85 }]}>
      <View style={s.planTop}><Text style={s.planName}>Pro Plan</Text><Text style={s.badge}>{subscribed ? "YOUR PLAN" : offer.showTrial ? "3 DAYS FREE" : "MONTHLY"}</Text></View>
      <Text style={s.price}>{offer.price ? `${offer.showTrial && !subscribed ? "Then " : ""}${offer.price}` : "Loading price…"}<Text style={s.period}>{offer.price ? " / month" : ""}</Text></Text>
      <Text style={s.detail}>{offer.showTrial && !subscribed ? "Try your creative possibilities. Cancel anytime." : "More room to make your app stand out."}</Text>
    </Pressable>

    {offer.preview ? <View style={s.preview}><Text style={s.previewText}>{environment.testStore ? "TEST PURCHASE · NO REAL CHARGE" : "PLAN PREVIEW"}</Text>{environment.testStore ? <Text style={s.small}>Trial shown for preview only.</Text> : null}</View> : null}

    {subscribed ? <>
      {onContinue ? <PrimaryButton onPress={onContinue}>Let’s get started</PrimaryButton> : <Text style={s.active}>Your subscription is active.</Text>}
      {!environment.testStore && environment.available ? <Pressable accessibilityRole="button" disabled={billing.busy} onPress={() => void billing.manage()} style={s.link}><Text style={s.linkText}>Manage subscription</Text></Pressable> : null}
    </> : <>
      <PrimaryButton disabled={purchaseDisabled} loading={billing.busy || checking} onPress={() => void purchase()}>{checking ? "Loading your plan…" : offer.cta}</PrimaryButton>
      {!offer.preview ? <Text style={s.small}>{offer.trial ? `Free for 3 days, then ${offer.price} per month. ` : offer.price ? `${offer.price} per month. ` : ""}Renews automatically until canceled. Cancel in your store settings before renewal to avoid a charge.</Text> : null}
    </>}

    {billing.notice ? <Text accessibilityLiveRegion="polite" style={s.small}>{billing.notice}</Text> : null}
    {billing.error ? <Text accessibilityRole="alert" style={s.error}>We couldn’t update your plan. Please try again.</Text> : null}
    <View style={s.links}>
      <Pressable accessibilityRole="button" disabled={billing.busy || !environment.available || !billing.status} onPress={() => void restore()} style={s.link}><Text style={s.linkText}>Restore purchases</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={billing.busy || checking} onPress={() => void billing.refresh()} style={s.link}><Text style={s.linkText}>{checking ? "Refreshing plan…" : "Refresh plan"}</Text></Pressable>
      {legalReady ? <>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(terms!)} style={s.link}><Text style={s.linkText}>Terms</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(privacy!)} style={s.link}><Text style={s.linkText}>Privacy</Text></Pressable>
      </> : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  content: { gap: 16 },
  hero: { alignItems: "center", gap: 12 },
  spark: { width: 62, height: 62, borderRadius: 23, backgroundColor: colors.yellow, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  label: { backgroundColor: "#E6D9FB", paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20 },
  labelText: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1, color: colors.ink },
  title: { fontFamily: fonts.heading, fontSize: 31, lineHeight: 37, letterSpacing: -1, color: colors.ink, textAlign: "center" },
  subtitle: { fontSize: 16, lineHeight: 23, textAlign: "center", color: colors.muted },
  features: { gap: 12, paddingVertical: 5 },
  feature: { flexDirection: "row", gap: 12, alignItems: "center" },
  featureIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontFamily: fonts.heading, fontSize: 14, lineHeight: 20, color: colors.ink },
  active: { fontFamily: fonts.heading, fontSize: 14, color: colors.ink, textAlign: "center" },
  plan: { backgroundColor: colors.yellow, borderRadius: 25, borderBottomLeftRadius: 9, padding: 20, gap: 9 },
  planTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  planName: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  badge: { overflow: "hidden", backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6, fontFamily: fonts.heading, fontSize: 10, color: colors.ink },
  price: { fontFamily: fonts.heading, fontSize: 29, color: colors.ink },
  period: { fontSize: 16 },
  detail: { fontSize: 14, lineHeight: 20, color: colors.ink },
  preview: { gap: 6 },
  previewText: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.8, color: colors.muted, textAlign: "center" },
  small: { fontSize: 12, lineHeight: 17, color: colors.muted, textAlign: "center" },
  error: { fontSize: 13, lineHeight: 19, color: colors.danger, textAlign: "center" },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 18 },
  link: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  linkText: { fontSize: 12, color: colors.muted, textDecorationLine: "underline" },
});
