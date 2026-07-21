import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "./theme";

type Props = { center: { latitude: number; longitude: number }; theme: string; token: string };

export function LocationMapPreview({ center }: Props) {
  return (
    <View style={styles.preview} accessibilityLabel="Map preview">
      <View style={styles.grid} />
      <View style={styles.pin}><Ionicons name="location" size={24} color="#fff" /></View>
      <View style={styles.badge}>
        <Ionicons name="map-outline" size={15} color={colors.primary} />
        <Text style={styles.badgeText}>Map preview · {center.latitude.toFixed(3)}, {center.longitude.toFixed(3)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { height: 164, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: "#E8D7DE", marginTop: 12, backgroundColor: "#F0E8DB", justifyContent: "center", alignItems: "center" },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.34, backgroundColor: "#D7E6D2", transform: [{ rotate: "-8deg" }, { scale: 1.35 }] },
  pin: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center", backgroundColor: colors.primary, borderWidth: 5, borderColor: "rgba(255,255,255,0.75)" },
  badge: { position: "absolute", left: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.94)" },
  badgeText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
});
