import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { localAuthMode } from "@/lib/auth-client";
import { accountRequest } from "@/lib/account-api";
import { PrimaryButton } from "./PrimaryButton";
import { workspace as s } from "./WorkspacePage";
import { colors } from "@/theme";

export function AccountSettings({ allowNavigation = true }: { allowNavigation?: boolean }) {
  const { email, signOut } = useAuth(); const router = useRouter();
  const [confirm, setConfirm] = useState(""); const [deleting, setDeleting] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (localAuthMode) return null;
  return <View style={s.panel}>
    <Text style={s.sectionTitle}>Your account</Text><Text style={s.copy}>{email}</Text>
    {allowNavigation ? <PrimaryButton onPress={() => router.push("/connections")}>Connected channels</PrimaryButton> : null}
    <PrimaryButton disabled={busy} onPress={() => void signOut().catch(() => setError("Couldn’t sign out. Try again."))}>Sign out</PrimaryButton>
    <Pressable onPress={() => setDeleting(!deleting)}><Text style={{ color: colors.danger }}>Delete my account</Text></Pressable>
    {deleting ? <><Text style={s.small}>This permanently deletes your HypeJuice profile, jobs, preferences, connections, and cloud videos. Download anything you want to keep first. Videos already published elsewhere are not deleted. Type DELETE to confirm.</Text>
      <TextInput accessibilityLabel="Confirm account deletion" value={confirm} autoCapitalize="characters" onChangeText={setConfirm} style={s.panel} />
      <PrimaryButton loading={busy} disabled={busy || confirm !== "DELETE"} onPress={async () => {
        setBusy(true); setError("");
        try { await accountRequest("/delete", { confirm }); await signOut(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Account deletion failed. Try again."); }
        finally { setBusy(false); }
      }}>Permanently delete account</PrimaryButton>
    </> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
  </View>;
}
