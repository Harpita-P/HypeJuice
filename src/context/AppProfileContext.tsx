import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { localAuthMode, authHeaders } from "@/lib/auth-client";
import { accountRequest, getSavedProfile } from "@/lib/account-api";
import { studioRequestId, uploadStudioDemo } from "@/lib/studio-api";
import { useAuth } from "./AuthContext";
import { AccountSettings } from "@/components/AccountSettings";

import type { BriefResponse } from "@shared/app-brief";

const STORAGE_KEY = "growthbanana.app-profile.v1";

type ContextValue = {
  analysis: BriefResponse | null;
  hydrated: boolean;
  setAnalysis: (value: BriefResponse) => Promise<void>;
  clearAnalysis: () => Promise<void>;
};

const AppProfileContext = createContext<ContextValue | null>(null);

export function AppProfileProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [analysis, setAnalysisState] = useState<BriefResponse | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const mounted = useRef(true);
  const uploads = useRef(new Map<string, Promise<string>>());
  const savedSignature = useRef("");
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;

    if (!localAuthMode) {
      setHydrated(false); setError("");
      void getSavedProfile().then((profile) => { if (mounted) { savedSignature.current = JSON.stringify(profile); setAnalysisState(profile); setHydrated(true); } })
        .catch(() => { if (mounted) setError("Couldn’t restore your workspace. Check the API setup and connection, then retry."); });
      return () => { mounted = false; };
    }

    // Fresh prototype session on launch/Expo reload; keep video files untouched.
    setAnalysisState(null);
    setHydrated(false);
    AsyncStorage.removeItem(STORAGE_KEY)
      .catch(() => {
        // Even if cleanup fails, old profiles are never restored.
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, [reload]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const setAnalysis = useCallback(async (next: BriefResponse) => {
    const task = writes.current.catch(() => {}).then(async () => {
      if (!mounted.current) throw new Error("Account changed. Sign in again.");
      if (!localAuthMode) {
        await authHeaders(userId);
        const clips = await Promise.all((next.demoClips ?? []).map(async (clip) => {
          if (!clip.uploadId) {
            if (!uploads.current.has(clip.id)) uploads.current.set(clip.id, uploadStudioDemo(clip, studioRequestId()).then((result) => result.id).catch((error) => { uploads.current.delete(clip.id); throw error; }));
            clip = { ...clip, uploadId: await uploads.current.get(clip.id)! };
          }
          return { ...clip, storage: "cloud" as const, localPath: "" };
        }));
        if (!mounted.current) throw new Error("Account changed. Sign in again.");
        next = { ...next, demoClips: clips };
        if (savedSignature.current !== JSON.stringify(next)) {
          await accountRequest("/profile", next, userId);
          savedSignature.current = JSON.stringify(next);
        }
      }
      if (mounted.current) setAnalysisState(next);
    });
    writes.current = task; await task;
  }, [userId]);
  const clearAnalysis = useCallback(async () => {
    if (!localAuthMode) await accountRequest("/profile/clear", {}, userId);
    setAnalysisState(null);
  }, [userId]);

  const value = useMemo<ContextValue>(
    () => ({ analysis, hydrated, setAnalysis, clearAnalysis }),
    [analysis, hydrated, setAnalysis, clearAnalysis],
  );

  if (!localAuthMode && !hydrated) return <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 20 }}>
    {error ? <><Text>{error}</Text><PrimaryButton onPress={() => setReload((value) => value + 1)}>Retry connection</PrimaryButton><AccountSettings allowNavigation={false} /></> : <ActivityIndicator />}
  </View>;
  return <AppProfileContext.Provider value={value}>{children}</AppProfileContext.Provider>;
}

export function useAppProfile() {
  const context = useContext(AppProfileContext);
  if (!context) throw new Error("useAppProfile must be used inside AppProfileProvider");
  return context;
}
