import { useCallback, useEffect, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { API_URL, authHeaders, requireSecureApi } from "@/lib/auth-client";
import type { YouTubeConfig } from "@shared/youtube";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";

WebBrowser.maybeCompleteAuthSession();
async function request<T>(path = "", method = "GET"): Promise<T> {
  requireSecureApi();
  const response = await fetch(`${API_URL}/api/connections/youtube${path}`, { method, headers: await authHeaders() });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Connection failed."); return data;
}
export default function ConnectionsScreen() {
  const router = useRouter(); const [config, setConfig] = useState<YouTubeConfig | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const refresh = useCallback(async () => { try { setConfig(await request()); setError(""); } catch (error) { setError(error instanceof Error ? error.message : "Couldn’t load connections."); } }, []);
  useEffect(() => { void refresh(); const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void refresh(); }); return () => subscription.remove(); }, [refresh]);
  return <WorkspacePage title="Your connections" subtitle="Only you can use the channels connected to your account.">
    <View style={s.panel}><Text style={s.sectionTitle}>YouTube</Text><Text style={s.copy}>{config?.connection ? config.connection.channelTitle : "No channel connected"}</Text>
      {config && !config.ready ? <Text style={s.small}>Server setup needed: {config.missing.join(", ")}</Text> : null}
      <Text style={s.small}>Channel connection only. Video upload and scheduling are not enabled in this architecture release.</Text>
      <PrimaryButton disabled={busy || !config?.ready} loading={busy} onPress={async () => {
        setBusy(true); setError("");
        try {
          if (config?.connection) await request("/disconnect", "POST");
          else {
            if (Platform.OS === "web") throw new Error("Use the iPhone development build for this mobile connection flow.");
            const { url } = await request<{ url: string }>("/start", "POST");
            const result = await WebBrowser.openAuthSessionAsync(url, "hypejuice://connections");
            if (result.type === "success" && new URL(result.url).searchParams.get("status") === "failed") throw new Error("Google connection failed or expired. Check server OAuth setup and try again.");
          }
          await refresh();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Connection failed."); }
        finally { setBusy(false); }
      }}>{config?.connection ? "Disconnect YouTube" : "Connect YouTube"}</PrimaryButton>
      <Text style={s.small}>Use an iPhone development build or App Store build, not Expo Go, for the return-to-app link.</Text>
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
    <PrimaryButton onPress={() => void refresh()}>Refresh connection</PrimaryButton>
    <PrimaryButton onPress={() => router.replace("/")}>Back to HypeJuice</PrimaryButton>
  </WorkspacePage>;
}
