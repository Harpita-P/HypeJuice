import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

// Code-native App Store-style source badge; no external image request needed.
export function AppStoreMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="App Store">
      <Defs>
        <LinearGradient id="appStoreBlue" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#38BAFF" />
          <Stop offset="1" stopColor="#1261EF" />
        </LinearGradient>
      </Defs>
      <Rect x="1" y="1" width="46" height="46" rx="12" fill="url(#appStoreBlue)" />
      <Path d="M27 12L16 31M21 12L30 28M10 29H28M32 29H38M13 34L12 36M31 30L35 36" stroke="white" strokeWidth="3.6" strokeLinecap="round" />
    </Svg>
  );
}
