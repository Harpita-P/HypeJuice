import { Pressable, Text, View } from "react-native";
import { PLANS, paidPlans } from "@shared/billing";
import { useBilling } from "@/context/BillingContext";
import { purchaseEnvironment } from "@/lib/purchases";
import { PrimaryButton } from "./PrimaryButton";
import { workspace as s } from "./WorkspacePage";
import { colors } from "@/theme";

export function SubscriptionPlans() {
  const billing = useBilling();
  const environment = purchaseEnvironment();
  return <View style={{ gap: 18 }}>
    <Text style={s.copy}>{billing.status ? `Current plan: ${PLANS[billing.status.tier].name}` : "Checking your plan…"}</Text>
    {billing.status && !billing.status.enforced ? <Text style={s.small}>Local development access is unlocked. This is not a paid subscription.</Text> : null}
    <View style={s.panel}><Text style={s.sectionTitle}>Free</Text><Text style={s.copy}>Discover, your Library, starred videos, downloads and Liftoff.</Text></View>
    {paidPlans.map((tier) => {
      const item = billing.packages[tier];
      const current = billing.status?.tier === tier;
      return <View key={tier} style={[s.panel, tier === "pro" && { borderColor: colors.green }]}>
        <Text style={s.sectionTitle}>{PLANS[tier].name}</Text>
        <Text style={s.copy}>{tier === "pro" ? "Unlock Studio. Choose a creator or describe a new one, and shape your own content." : "The Power subscription. Generation allowances will be finalized before launch."}</Text>
        <Text style={s.sectionTitle}>{item ? `${item.product.priceString} / month` : "Price not configured yet"}</Text>
        <PrimaryButton disabled={billing.busy || !environment.available || !billing.status || !item || current} loading={billing.busy} onPress={() => void billing.purchase(tier)}>{current ? "Current plan" : `Choose ${PLANS[tier].name}`}</PrimaryButton>
      </View>;
    })}
    <Text style={s.small}>{environment.message}</Text>
    <Text style={s.small}>Paid plans renew monthly until canceled. Prices come from the store. New AI creator generation remains subject to server usage limits.</Text>
    <View style={s.row}>
      <Pressable accessibilityRole="button" disabled={billing.busy || !environment.available || !billing.status} onPress={() => void billing.restore()} style={s.chip}><Text style={s.copy}>Restore purchases</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={billing.busy} onPress={() => void billing.refresh()} style={s.chip}><Text style={s.copy}>Refresh plan</Text></Pressable>
      {environment.available && !environment.testStore && billing.status?.tier !== "free" ? <Pressable accessibilityRole="button" disabled={billing.busy} onPress={() => void billing.manage()} style={s.chip}><Text style={s.copy}>Manage subscription</Text></Pressable> : null}
    </View>
    {billing.notice ? <Text style={s.copy}>{billing.notice}</Text> : null}
    {billing.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{billing.error}</Text> : null}
  </View>;
}
