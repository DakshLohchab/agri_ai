import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useLocalizedStrings } from "@/hooks/useLocalizedStrings";

export default function NotFoundScreen() {
  const ui = useLocalizedStrings({
    title: "Oops!",
    message: "This screen doesn't exist.",
    cta: "Go to home screen!",
  });

  return (
    <>
      <Stack.Screen options={{ title: ui.title }} />
      <View style={styles.container}>
        <Text style={styles.title}>{ui.message}</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{ui.cta}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: "#2e78b7",
  },
});
