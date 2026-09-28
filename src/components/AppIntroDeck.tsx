import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Hand } from "lucide-react-native";
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, View } from "react-native";

const STORY_COLOR = "#DCE5C7";

// The backing card IS the story card: identical bounds, not a decorative copy.
export function AppIntroDeck({ active, onTurn, reduceMotion, overview, story, storyFooter }: {
  active: 0 | 1; onTurn: (index: 0 | 1) => void; reduceMotion: boolean;
  overview: ReactNode; story: ReactNode; storyFooter: ReactNode;
}) {
  const [width, setWidth] = useState(320);
  const [interacted, setInteracted] = useState(false);
  const progress = useRef(new Animated.Value(active)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const swipeHint = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || active !== 0 || interacted) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.timing(swipeHint, { toValue: 1, duration: 1100, useNativeDriver: true, isInteraction: false }),
      Animated.delay(900),
    ]), { iterations: 4 });
    animation.start();
    return () => { animation.stop(); swipeHint.setValue(0); };
  }, [active, interacted, reduceMotion, swipeHint]);

  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: active, duration: reduceMotion ? 0 : 380, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [active, progress, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || active !== 0 || interacted) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(1200),
      Animated.timing(wobble, { toValue: -1, duration: 260, useNativeDriver: true, isInteraction: false }),
      Animated.timing(wobble, { toValue: 1, duration: 360, useNativeDriver: true, isInteraction: false }),
      Animated.timing(wobble, { toValue: 0, duration: 280, useNativeDriver: true, isInteraction: false }),
      Animated.delay(2200),
    ]), { iterations: 3 });
    animation.start();
    return () => { animation.stop(); wobble.setValue(0); };
  }, [active, interacted, reduceMotion, wobble]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderGrant: () => { setInteracted(true); progress.stopAnimation(); },
    onPanResponderMove: (_, gesture) => {
      if (!reduceMotion) progress.setValue(Math.max(0, Math.min(1, active - gesture.dx / width)));
    },
    onPanResponderRelease: (_, gesture) => {
      const next = active === 0 && (gesture.dx < -60 || gesture.vx < -0.5) ? 1
        : active === 1 && (gesture.dx > 60 || gesture.vx > 0.5) ? 0 : active;
      onTurn(next);
      Animated.timing(progress, { toValue: next, duration: reduceMotion ? 0 : 250, useNativeDriver: false }).start();
    },
    onPanResponderTerminate: () => {
      Animated.timing(progress, { toValue: active, duration: reduceMotion ? 0 : 200, useNativeDriver: false }).start();
    },
  }), [active, onTurn, progress, reduceMotion, width]);

  return (
    <View style={styles.frame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} {...pan.panHandlers}>
      <Animated.View pointerEvents={active === 1 ? "auto" : "none"} aria-hidden={active !== 1} accessibilityElementsHidden={active !== 1} importantForAccessibility={active === 1 ? "auto" : "no-hide-descendants"}
        style={[styles.card, styles.story, { transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: reduceMotion ? ["0deg", "0deg"] : ["2deg", "0deg"] }) },
        ] }]}>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{story}</ScrollView>
        <View style={styles.storyFooter}>{storyFooter}</View>
      </Animated.View>
      <Animated.View pointerEvents={active === 0 ? "auto" : "none"} aria-hidden={active !== 0} accessibilityElementsHidden={active !== 0} importantForAccessibility={active === 0 ? "auto" : "no-hide-descendants"}
        style={[styles.front, { opacity: progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }), transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width - 40] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: reduceMotion ? ["0deg", "0deg"] : ["0deg", "-9deg"] }) },
        ] }]}>
        <Animated.View style={[styles.card, styles.overview, { transform: [
          { rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ["-1.4deg", "1.4deg"] }) },
        ] }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {overview}
            <Pressable accessibilityRole="button" accessibilityLabel="Turn to app story" accessibilityHint="You can also swipe left on the card" onPress={() => onTurn(1)} style={styles.swipeHint}>
              <Animated.View style={[styles.hand, { transform: [{ translateX: swipeHint.interpolate({ inputRange: [0, 1], outputRange: [14, -14] }) }] }]}>
                <ChevronLeft size={16} color="#819359" /><Hand size={25} color="#819359" strokeWidth={1.6} />
              </Animated.View>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 250, marginHorizontal: 26, marginTop: 6, marginBottom: 16 },
  front: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  card: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: 30, borderWidth: 1, overflow: "hidden", shadowColor: "#192017", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  overview: { backgroundColor: "#FFFDF4", borderColor: "#D7D8C9" },
  story: { backgroundColor: STORY_COLOR, borderColor: "#C4CEB0" },
  content: { flexGrow: 1, padding: 22, gap: 18 },
  storyFooter: { paddingHorizontal: 18, paddingBottom: 16, paddingTop: 8 },
  swipeHint: { marginTop: "auto", alignSelf: "center", paddingTop: 16, width: 88, minHeight: 60, alignItems: "center", justifyContent: "center" },
  hand: { flexDirection: "row", alignItems: "center", gap: 2 },
});
