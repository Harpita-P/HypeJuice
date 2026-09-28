import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "expo-router";
import type { VideoPlayer } from "expo-video";

/** Play visible, foreground previews only. Never touch an Expo player in cleanup. */
export function useVideoAutoplay(player: VideoPlayer, enabled = true) {
  const ref = useRef<View>(null);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [visible, setVisible] = useState(false);
  const { width, height } = useWindowDimensions();
  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      const area = Math.max(0, Math.min(x + w, width) - Math.max(x, 0)) * Math.max(0, Math.min(y + h, height) - Math.max(y, 0));
      setVisible(w > 0 && h > 0 && area / (w * h) >= 0.2);
    });
  }, [width, height]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!focused || !foreground || !enabled) return;
    if (Platform.OS === "web" && typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.2), { threshold: [0, 0.2] });
      if (ref.current) observer.observe(ref.current as unknown as Element);
      return () => observer.disconnect();
    }
    // Native scroll containers don't expose IntersectionObserver. Only inspect
    // mounted previews while their screen is active; virtual lists unmount the rest.
    measure();
    const timer = setInterval(measure, 500);
    return () => clearInterval(timer);
  }, [enabled, focused, foreground, measure]);
  const active = enabled && focused && foreground && visible;
  useEffect(() => {
    if (!active) { player.pause(); return; }
    // Failed/loading sources must not be asked to play (web play() rejects).
    if (player.status === "readyToPlay") player.play();
    const sub = player.addListener("statusChange", ({ status }) => { if (status === "readyToPlay") player.play(); });
    return () => sub.remove();
  }, [player, active]);
  return { ref, onLayout: measure, collapsable: false as const };
}
