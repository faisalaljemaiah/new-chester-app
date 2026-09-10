import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export function Logo({ size = 26 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#E7CFF9" />
          <Stop offset="100%" stopColor={theme.primary} />
        </LinearGradient>
      </Defs>
      <Path d="M16 2.5 29 9.7v12.6L16 29.5 3 22.3V9.7Z" fill="url(#gem)" />
      <Path
        d="M16 2.5 16 29.5M3 9.7 16 16 29 9.7M3 22.3 16 16"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1}
      />
    </Svg>
  );
}
