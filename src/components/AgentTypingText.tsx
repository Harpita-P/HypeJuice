import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Text, type TextProps } from "react-native";
import { useIsFocused } from "expo-router";

/** Shared fast typing for agent bubbles, with the full message's space reserved. */
export function AgentTypingText({ children, ...props }: Omit<TextProps, "children"> & { children: string }) {
  return <TypingMessage key={children} {...props} message={children} />;
}

function TypingMessage({ message, ...props }: TextProps & { message: string }) {
  const focused = useIsFocused();
  const letters = Array.from(message);
  const [visible, setVisible] = useState(0);
  const finished = useRef(false);

  useEffect(() => {
    if (!focused || finished.current) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    let reducedMotion = false;
    const finish = () => {
      if (timer) clearInterval(timer);
      finished.current = true;
      if (active) setVisible(letters.length);
    };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduced) => {
      reducedMotion = reduced;
      if (reduced) finish();
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active) return;
      if (reduced || reducedMotion || finished.current || !letters.length) { finish(); return; }
      const started = Date.now();
      const duration = Math.min(1200, letters.length * 14);
      timer = setInterval(() => {
        const progress = Math.min(1, (Date.now() - started) / duration);
        setVisible(Math.ceil(letters.length * progress));
        if (progress === 1) finish();
      }, 16);
    }).catch(() => { if (active) finish(); });
    return () => { active = false; if (timer) clearInterval(timer); subscription.remove(); };
  }, [focused, letters.length]);

  return <Text {...props} accessibilityLabel={message}>
    {letters.slice(0, visible).join("")}
    <Text style={{ color: "transparent" }}>{letters.slice(visible).join("")}</Text>
  </Text>;
}
