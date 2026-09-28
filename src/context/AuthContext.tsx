import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Pressable, Text, TextInput, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { authClient, localAuthMode } from "@/lib/auth-client";
import { ScreenShell } from "@/components/ScreenShell";
import { BrandMark } from "@/components/BrandMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { workspace as s } from "@/components/WorkspacePage";
import { colors } from "@/theme";

const Context = createContext<{ userId: string; email?: string; signOut: () => Promise<void> }>({ userId: "local", signOut: async () => {} });
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(localAuthMode);
  useEffect(() => {
    if (localAuthMode || !authClient) { setReady(true); return; }
    let active = true;
    void authClient.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } }).catch(() => { if (active) setReady(true); });
    const { data } = authClient.auth.onAuthStateChange((_event, value) => { setSession(value); setReady(true); });
    const appState = AppState.addEventListener("change", (value) => value === "active" ? authClient?.auth.startAutoRefresh() : authClient?.auth.stopAutoRefresh());
    return () => { active = false; data.subscription.unsubscribe(); appState.remove(); };
  }, []);
  if (!ready) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={colors.green} /></View>;
  if (!localAuthMode && !session) return <SignIn />;
  return <Context.Provider key={session?.user.id ?? "local"} value={{ userId: session?.user.id ?? "local", email: session?.user.email, signOut: async () => {
    const result = await authClient?.auth.signOut(); if (result?.error) throw result.error;
  } }}>{children}</Context.Provider>;
}
function SignIn() {
  const [email, setEmail] = useState(""); const [code, setCode] = useState("");
  const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit() {
    if (!authClient || busy) return;
    setBusy(true); setError("");
    try {
      const result = sent ? await authClient.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" })
        : await authClient.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      if (result.error) throw result.error;
      setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t sign in. Try again."); }
    finally { setBusy(false); }
  }
  return <ScreenShell><View style={[s.content, { flex: 1, justifyContent: "center" }]}>
    <BrandMark /><Text style={s.title}>Your growth workspace</Text>
    {!authClient ? <Text style={s.copy}>Authentication setup is needed. Add the public Supabase URL and publishable key to your Expo environment, then reload.</Text> : <>
      <Text style={s.copy}>{sent ? "Enter the sign-in code from your email." : "Sign in or create your account with an email code. Your apps and videos stay in your account."}</Text>
      <TextInput accessibilityLabel="Email address" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} editable={!sent && !busy} onChangeText={setEmail} placeholder="you@example.com" style={[s.panel, { color: colors.ink }]} />
      {sent ? <TextInput accessibilityLabel="Sign-in code" keyboardType="number-pad" autoComplete="one-time-code" value={code} maxLength={8} onChangeText={setCode} style={[s.panel, { color: colors.ink }]} /> : null}
      <PrimaryButton loading={busy} disabled={busy || !email.trim() || (sent && code.trim().length < 6)} onPress={() => void submit()}>{sent ? "Sign in" : "Send sign-in code"}</PrimaryButton>
      {sent ? <Pressable onPress={() => { setSent(false); setCode(""); }}><Text style={s.copy}>Use another email / send a new code</Text></Pressable> : null}
    </>}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
  </View></ScreenShell>;
}
