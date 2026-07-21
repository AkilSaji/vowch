import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, UrlTile } from "react-native-maps";
import { colors, radius } from "./theme";

type Props = {
  center: { latitude: number; longitude: number };
  theme: string;
  token: string;
};

export function LocationMapPreview({ center, theme, token }: Props) {
  return (
    <View style={styles.preview}>
      <MapView
        style={styles.map}
        region={{ ...center, latitudeDelta: 0.045, longitudeDelta: 0.045 }}
        mapType="none"
        rotateEnabled={false}
      >
        <UrlTile
          urlTemplate={`https://api.mapbox.com/styles/v1/mapbox/${theme}/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(token)}`}
          maximumZ={19}
        />
        <Marker coordinate={center} pinColor={colors.primary} />
      </MapView>
      <View style={styles.badge}>
        <Ionicons name="map-outline" size={15} color={colors.primary} />
        <Text style={styles.badgeText}>Mapbox location preview</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { height: 164, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: "#E8D7DE", marginTop: 12 },
  map: { ...StyleSheet.absoluteFillObject },
  badge: { position: "absolute", left: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.94)" },
  badgeText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
});
