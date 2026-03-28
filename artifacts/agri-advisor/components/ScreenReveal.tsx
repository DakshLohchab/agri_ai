import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from "react-native";

type Props = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

export function ScreenReveal({
  children,
  delay = 0,
  distance = 16,
  duration = 520,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, distance, duration, opacity, translateY]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
