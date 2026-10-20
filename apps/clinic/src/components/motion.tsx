import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<ComponentProps<typeof Pressable>, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** How far the button shrinks while held. */
  scaleTo?: number;
};

/** A Pressable that gently shrinks and dims while pressed, then springs back. */
export function PressableScale({ style, scaleTo = 0.96, onPressIn, onPressOut, ...props }: Props) {
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  // Keep the button's own opacity (e.g. 0.5 when disabled) and dim relative to it.
  const baseOpacity = StyleSheet.flatten(resolved)?.opacity ?? 1;
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: baseOpacity * dim.value }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        setPressed(true);
        scale.value = withSpring(scaleTo, { damping: 20, stiffness: 400 });
        dim.value = withTiming(0.85, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.value = withSpring(1, { damping: 12, stiffness: 260 });
        dim.value = withTiming(1, { duration: 220 });
        onPressOut?.(e);
      }}
      style={[resolved, animated]}
    />
  );
}

/** Fades content in as a screen opens. `index` staggers items in a list so they arrive one after another. */
export function FadeInView({
  children,
  index = 0,
  rise = true,
  style,
}: {
  children: ReactNode;
  index?: number;
  rise?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <Animated.View style={style}>{children}</Animated.View>;
  const delay = Math.min(index, 8) * 70;
  const entering = rise ? FadeInDown.duration(420).delay(delay).springify().damping(18) : FadeIn.duration(300).delay(delay);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
