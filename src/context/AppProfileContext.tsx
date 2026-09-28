import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  const [analysis, setAnalysisState] = useState<BriefResponse | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

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
  }, []);

  const setAnalysis = useCallback(async (next: BriefResponse) => {
    // Retain edits during navigation, but not across launches or reloads.
    setAnalysisState(next);
  }, []);
  const clearAnalysis = useCallback(async () => {
    setAnalysisState(null);
  }, []);

  const value = useMemo<ContextValue>(
    () => ({ analysis, hydrated, setAnalysis, clearAnalysis }),
    [analysis, hydrated, setAnalysis, clearAnalysis],
  );

  return <AppProfileContext.Provider value={value}>{children}</AppProfileContext.Provider>;
}

export function useAppProfile() {
  const context = useContext(AppProfileContext);
  if (!context) throw new Error("useAppProfile must be used inside AppProfileProvider");
  return context;
}
