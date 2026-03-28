import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MOBILE_TAB_BAR_HEIGHT = 82;
const MOBILE_TAB_BAR_OFFSET = 14;
const MOBILE_TAB_BAR_EXTRA_GAP = 52;

export function useTabBarSpacing() {
  const insets = useSafeAreaInsets();

  if (Platform.OS === "web") {
    return 40;
  }

  return MOBILE_TAB_BAR_HEIGHT + MOBILE_TAB_BAR_OFFSET + insets.bottom + MOBILE_TAB_BAR_EXTRA_GAP;
}
