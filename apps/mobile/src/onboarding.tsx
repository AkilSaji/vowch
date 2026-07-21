import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker, UrlTile } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "./api";
import { mobileAuth } from "./cognito";
import { colors, radius } from "./theme";

type Stage =
  | "welcome"
  | "splash"
  | "slides"
  | "signup"
  | "forgot"
  | "resetCode"
  | "otp"
  | "profile";

const illustrations = [
  require("../assets/onboarding-community.png"),
  require("../assets/onboarding-gigs.png"),
  require("../assets/onboarding-trust.png"),
];
const brandAsset = require("../assets/vowch-brand-transparent.png");

const isValidEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
const mapThemes = [
  { label: "Streets", style: "streets-v12" },
  { label: "Outdoors", style: "outdoors-v12" },
  { label: "Night", style: "dark-v11" },
];
const avatarOptions = [
  { id: "coral", color: "#FD5C63", accent: "#FFE2E5" },
  { id: "violet", color: "#776BE8", accent: "#E8E5FF" },
  { id: "gold", color: "#E7A427", accent: "#FFF0CE" },
  { id: "teal", color: "#2D9D87", accent: "#DDF6F0" },
  { id: "sky", color: "#4A96DC", accent: "#E2F0FF" },
  { id: "plum", color: "#A25EAB", accent: "#F3E4F5" },
];

const slides = [
  {
    title: "Your community is here.",
    body: "Ask for help, share a skill, and find people your neighborhood can trust.",
    image: illustrations[0],
  },
  {
    title: "Discover gigs near you.",
    body: "See opportunities, get paid securely, and build your local reputation.",
    image: illustrations[1],
  },
  {
    title: "Help that feels safe.",
    body: "Every connection is powered by real people and community trust.",
    image: illustrations[2],
  },
];

function Logo() {
  return (
    <Image
      source={brandAsset}
      style={styles.wordmark}
      resizeMode="contain"
      accessibilityLabel="Vowch"
    />
  );
}
function ArrowButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View
      style={[styles.primaryButtonWrap, { transform: [{ scale }] }]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
        <Ionicons name="arrow-forward" size={23} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

export function Onboarding({
  onComplete,
  onBrowse,
}: {
  onComplete: () => void;
  onBrowse?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("splash");
  const [page, setPage] = useState(0);
  const [authEmail, setAuthEmail] = useState("");
  const [authSession, setAuthSession] = useState("");
  const [direction, setDirection] = useState(1);
  const transition = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(transition, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [transition]);
  const go = (next: Stage, backwards = false) => {
    setDirection(backwards ? -1 : 1);
    Animated.timing(transition, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setStage(next);
      transition.setValue(0);
      requestAnimationFrame(() =>
        Animated.spring(transition, {
          toValue: 1,
          friction: 8,
          tension: 82,
          useNativeDriver: true,
        }).start(),
      );
    });
  };
  const startEmailOtp = async (email: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      setAuthSession(await mobileAuth.startOtp(normalizedEmail));
      setAuthEmail(normalizedEmail);
      go("otp");
    } catch (error) {
      Alert.alert("Could not send your Vowch code", error instanceof Error ? error.message : "Please try again.");
    }
  };
  const verifyEmailOtp = async (code: string) => {
    try {
      await mobileAuth.answerOtp(authEmail, authSession, code);
      go("profile");
    } catch (error) {
      Alert.alert("That code did not work", error instanceof Error ? error.message : "Request another Vowch code and try again.");
    }
  };
  const current =
    stage === "welcome" ? (
      <Welcome
        onStart={() => go("slides")}
        onLogin={() => go("signup")}
        onBrowse={onBrowse}
      />
    ) : stage === "splash" ? (
      <Splash onDone={() => go("welcome")} />
    ) : stage === "slides" ? (
      <Slides
        page={page}
        setPage={setPage}
        onSkip={() => go("signup")}
        onDone={() => go("signup")}
      />
    ) : stage === "signup" ? (
      <SignupWithRecovery
        onBack={() => go("slides", true)}
        onDone={startEmailOtp}
        onForgot={() => go("forgot")}
      />
    ) : stage === "forgot" ? (
      <ForgotPassword
        onBack={() => go("signup", true)}
        onDone={() => go("resetCode")}
      />
    ) : stage === "resetCode" ? (
      <ResetCode
        onBack={() => go("forgot", true)}
        onDone={() => go("signup")}
      />
    ) : stage === "otp" ? (
      <Otp email={authEmail} onBack={() => go("signup", true)} onDone={verifyEmailOtp} />
    ) : (
      <ProfileSetup onBack={() => go("otp", true)} onDone={onComplete} />
    );
  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View
        style={[
          styles.transition,
          {
            opacity: transition,
            transform: [
              {
                translateX: transition.interpolate({
                  inputRange: [0, 1],
                  outputRange: [direction * 30, 0],
                }),
              },
              {
                translateY: transition.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
              {
                scale: transition.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.965, 1],
                }),
              },
            ],
          },
        ]}
      >
        {current}
      </Animated.View>
    </SafeAreaView>
  );
}

function Splash({ onDone }: { onDone: () => void }) {
  const intro = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(intro, {
          toValue: 1,
          friction: 7,
          tension: 46,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 1,
          duration: 1750,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(220),
    ]).start(onDone);
  }, [intro, progress, onDone]);
  return (
    <View style={styles.splash}>
      <View style={styles.splashGlow} />
      <Animated.View
        style={[
          styles.splashBrand,
          {
            opacity: intro,
            transform: [
              {
                scale: intro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.splashLogoCard}>
          <Image
            source={brandAsset}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.splashTitle}>
          Your neighborhood,{`\n`}connected.
        </Text>
        <Text style={styles.splashTagline}>
          Trusted help and local gigs, all in one place.
        </Text>
      </Animated.View>
      <View style={styles.loadingBlock}>
        <View style={styles.loadingTrack}>
          <Animated.View
            style={[
              styles.loadingFill,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.loadingText}>
          Connecting you to your community...
        </Text>
      </View>
    </View>
  );
}

function Slides({
  page,
  setPage,
  onSkip,
  onDone,
}: {
  page: number;
  setPage: (page: number) => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.spring(enter, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [page, enter]);
  const slide = slides[page];
  return (
    <View style={styles.onboard}>
      <View style={styles.onboardHeader}>
        <Logo />
        <Pressable onPress={onSkip}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>
      <Animated.View
        style={[
          styles.slideContent,
          {
            opacity: enter,
            transform: [
              {
                translateX: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [26, 0],
                }),
              },
              {
                scale: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.artCard}>
          <Image
            source={slide.image}
            style={styles.artImage}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideBody}>{slide.body}</Text>
      </Animated.View>
      <View style={styles.slideFooter}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>
        <ArrowButton
          label={page === 2 ? "Join Vowch" : "Next"}
          onPress={() => (page === 2 ? onDone() : setPage(page + 1))}
        />
        {page > 0 && (
          <Pressable onPress={onSkip}>
            <Text style={styles.skipNow}>Skip for now</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Signup({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [contact, setContact] = useState("");
  return (
    <KeyboardAvoidingView
      style={styles.signupScreen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.signupScroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.signupCard}>
          <Logo />
          <Text style={styles.joinTitle}>Join the community</Text>
          <Text style={styles.joinBody}>
            Connect with locals, find great gigs, and get things done with
            trust.
          </Text>
          <SocialButton label="Continue with Google" icon="logo-google" />
          <SocialButton label="Continue with Apple" icon="logo-apple" />
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.or}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
          <Text style={styles.inputLabel}>Email or Phone</Text>
          <View style={styles.contactInput}>
            <Ionicons name="at-outline" size={21} color={colors.muted} />
            <TextInput
              value={contact}
              onChangeText={setContact}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="hello@example.com"
              placeholderTextColor="#777482"
              style={styles.contactField}
            />
          </View>
          <ArrowButton label="Continue" onPress={onDone} />
          <Text style={styles.terms}>
            By signing up, you agree to our{" "}
            <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already a member?</Text>
            <Pressable onPress={onBack}>
              <Text style={styles.termsLink}>Log In</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.copyright}>
          © 2026 Vowch. Built for the neighborhood.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function SocialButton({
  label,
  icon,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.socialButton,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={21} color={colors.ink} />
      <Text style={styles.socialText}>{label}</Text>
    </Pressable>
  );
}

function Otp({ email, onBack, onDone }: { email: string; onBack: () => void; onDone: (code: string) => void }) {
  const [code, setCode] = useState("");
  const input = useRef<TextInput>(null);
  const verify = () => {
    if (code.length !== 6) {
      Alert.alert(
        "Enter your code",
        "Please enter the 6-digit code we sent you.",
      );
      return;
    }
    onDone(code);
  };
  return (
    <View style={styles.otpScreen}>
      <View style={styles.simpleHeader}>
        <Pressable onPress={onBack}>
          <Ionicons name="arrow-back" size={29} color={colors.ink} />
        </Pressable>
        <Logo />
      </View>
      <Pressable style={styles.otpBody} onPress={() => input.current?.focus()}>
        <View style={styles.otpMark}>
          <Ionicons
            name="shield-checkmark-outline"
            size={56}
            color={colors.primary}
          />
        </View>
        <Text style={styles.otpTitle}>Verify it&apos;s you</Text>
        <Text style={styles.otpBodyText}>
          We&apos;ve sent a 6-digit Vowch code to {email || "your email address"}.
        </Text>
        <View style={styles.codeRow}>
          {Array.from({ length: 6 }, (_, i) => (
            <View
              style={[styles.codeBox, code[i] && styles.codeBoxFilled]}
              key={i}
            >
              <Text style={styles.codeText}>{code[i] ?? ""}</Text>
            </View>
          ))}
        </View>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.hiddenInput}
        />
        <Text style={styles.resend}>
          Didn&apos;t receive code? <Text style={styles.termsLink}>Resend</Text>
        </Text>
      </Pressable>
      <View style={styles.otpBottom}>
        <ArrowButton label="Verify" onPress={verify} />
        <View style={styles.neighbors}>
          <View style={styles.faces}>
            <Text>👩🏻</Text>
            <Text>👨🏽</Text>
          </View>
          <Text style={styles.neighborText}>
            Join over{" "}
            <Text style={styles.neighborStrong}>12,000+ neighbors</Text>
            {"\n"}vowching for each other today.
          </Text>
        </View>
      </View>
    </View>
  );
}

function ProfileSetup({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [selected, setSelected] = useState("Home Services");
  const [avatar, setAvatar] = useState<
    | { kind: "default"; id: string }
    | {
        kind: "photo";
        uri: string;
        fileName?: string | null;
        mimeType?: string | null;
        fileSize?: number | null;
      }
  >({ kind: "default", id: "coral" });
  const [showAvatarChoices, setShowAvatarChoices] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState([
    "Park Slope, Brooklyn",
    "Fort Greene, Brooklyn",
    "Williamsburg, Brooklyn",
    "Downtown Brooklyn",
  ]);
  const [mapCenter, setMapCenter] = useState({
    latitude: 40.6782,
    longitude: -73.9442,
  });
  const [placeResults, setPlaceResults] = useState<
    Array<{ id: string; label: string; latitude: number; longitude: number }>
  >([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [mapTheme, setMapTheme] = useState("streets-v12");
  const initials = (name.trim().slice(0, 1) || "V").toUpperCase();
  const avatarOption =
    avatarOptions.find(
      (option) =>
        option.id === (avatar.kind === "default" ? avatar.id : "coral"),
    ) ?? avatarOptions[0];
  useEffect(() => {
    if (!mapboxToken || location.trim().length < 2) {
      setPlaceResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingPlaces(true);
      try {
        const params = new URLSearchParams({
          q: location.trim(),
          limit: "5",
          language: "en",
          types: "neighborhood,locality,place,address",
          proximity: `${mapCenter.longitude},${mapCenter.latitude}`,
          access_token: mapboxToken,
        });
        const response = await fetch(
          `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw new Error("MAPBOX_SEARCH_FAILED");
        setPlaceResults(
          (body.features ?? [])
            .map((feature: any) => {
              const [longitude, latitude] = feature.geometry?.coordinates ?? [];
              const label =
                feature.properties?.full_address ??
                feature.properties?.name_preferred ??
                feature.place_name ??
                feature.properties?.name;
              return {
                id: String(feature.id ?? label),
                label: String(label ?? ""),
                latitude: Number(latitude),
                longitude: Number(longitude),
              };
            })
            .filter(
              (place: any) =>
                place.label &&
                Number.isFinite(place.latitude) &&
                Number.isFinite(place.longitude),
            ),
        );
      } catch (error: any) {
        if (error?.name !== "AbortError") setPlaceResults([]);
      } finally {
        setSearchingPlaces(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [location, mapCenter.latitude, mapCenter.longitude]);
  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "You can still type your neighbourhood manually. Enable location to use your current area.",
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync(position.coords);
      const formatted = [place?.district, place?.city, place?.region]
        .filter(Boolean)
        .filter((part, index, items) => items.indexOf(part) === index)
        .join(", ");
      if (!formatted) throw new Error("LOCATION_NOT_FOUND");
      setLocation(formatted);
      setMapCenter({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setNearbyPlaces((current) => [
        formatted,
        ...current.filter((item) => item !== formatted),
      ]);
    } catch {
      Alert.alert(
        "Couldn't find your neighbourhood",
        "Please enter the area you want to use manually.",
      );
    } finally {
      setLocating(false);
    }
  };
  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo permission needed",
        "Allow photo access to choose a profile picture.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const image = result.assets[0];
      setAvatar({
        kind: "photo",
        uri: image.uri,
        fileName: image.fileName,
        mimeType: image.mimeType,
        fileSize: image.fileSize,
      });
    }
  };
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera permission needed",
        "Allow camera access to take a profile picture.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const image = result.assets[0];
      setAvatar({
        kind: "photo",
        uri: image.uri,
        fileName: image.fileName,
        mimeType: image.mimeType,
        fileSize: image.fileSize,
      });
    }
  };
  const choosePhoto = () =>
    Alert.alert(
      "Set profile picture",
      "Choose how you want your Vowch profile to appear.",
      [
        { text: "Take a photo", onPress: takePhoto },
        { text: "Choose from gallery", onPress: pickFromLibrary },
        {
          text: "Choose a Vowch avatar",
          onPress: () => setShowAvatarChoices(true),
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  const saveProfile = async () => {
    if (!name.trim() || !location.trim()) {
      Alert.alert(
        "Complete your profile",
        "Add your name and neighbourhood to continue.",
      );
      return;
    }
    setSaving(true);
    try {
      if (api.configured) {
        const profileAvatar =
          avatar.kind === "photo"
            ? await api.uploadProfileImage(avatar)
            : { kind: "default" as const, id: avatar.id };
        await api.updateProfile({
          displayName: name.trim(),
          primarySkill: selected,
          location: location.trim(),
          avatar: profileAvatar,
        });
      }
      onDone();
    } catch {
      Alert.alert(
        "Couldn't save your profile",
        "Your profile has not been saved yet. Please check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const skills = [
    "Home Services",
    "Delivery",
    "Design",
    "Pet Care",
    "Tutoring",
    "Gardening",
    "More",
  ];
  return (
    <KeyboardAvoidingView
      style={styles.profileScreen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.profileHeader}>
        <Pressable onPress={onBack}>
          <Ionicons name="arrow-back" size={23} color={colors.primary} />
        </Pressable>
        <Logo />
        <Text style={styles.step}>Step 1 of 3</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.profileScroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.profileTitle}>Create your profile</Text>
        <Text style={styles.profileBody}>
          Let&apos;s set up your neighborhood presence. Your profile helps the
          community trust and vowch for you.
        </Text>
        <Pressable style={styles.photoCard} onPress={choosePhoto}>
          <View
            style={[
              styles.photoCircle,
              avatar.kind === "default" && {
                backgroundColor: avatarOption.color,
              },
            ]}
          >
            {avatar.kind === "photo" ? (
              <Image source={{ uri: avatar.uri }} style={styles.profilePhoto} />
            ) : (
              <Text style={styles.avatarInitial}>{initials}</Text>
            )}
          </View>
          <View style={styles.editBadge}>
            <Ionicons name="pencil" size={15} color="#fff" />
          </View>
          <Text style={styles.photoTitle}>Profile Photo</Text>
          <Text style={styles.photoCopy}>
            Take a photo, choose from your gallery, or start with a Vowch
            avatar.
          </Text>
          <Text style={styles.uploadLink}>Change profile picture</Text>
        </Pressable>
        {showAvatarChoices && (
          <View style={styles.avatarChoices}>
            <View style={styles.avatarChoiceHead}>
              <Text style={styles.avatarChoiceTitle}>
                Choose a Vowch avatar
              </Text>
              <Pressable
                onPress={() => setShowAvatarChoices(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.avatarChoiceRow}>
              {avatarOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    setAvatar({ kind: "default", id: option.id });
                    setShowAvatarChoices(false);
                  }}
                  style={[
                    styles.avatarOption,
                    { backgroundColor: option.color },
                    avatar.kind === "default" &&
                      avatar.id === option.id &&
                      styles.avatarOptionSelected,
                  ]}
                >
                  <Text style={styles.avatarOptionText}>{initials}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <FormField
          label="Full Name"
          value={name}
          placeholder="e.g. Alex Henderson"
          onChangeText={setName}
        />
        <Text style={styles.inputLabel}>Your neighbourhood</Text>
        <View style={styles.formInput}>
          <Ionicons name="location-outline" size={20} color={colors.muted} />
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Search or type your neighbourhood"
            placeholderTextColor="#6D7285"
            style={styles.formField}
          />
          {searchingPlaces && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>
        <Pressable
          style={styles.currentLocation}
          onPress={useCurrentLocation}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="locate-outline" size={18} color={colors.primary} />
          )}
          <Text style={styles.currentLocationText}>
            {locating ? "Finding your location..." : "Use my current location"}
          </Text>
        </Pressable>
        {mapboxToken && (
          <>
            <View style={styles.mapPreview}>
              <MapView
                style={styles.map}
                region={{
                  ...mapCenter,
                  latitudeDelta: 0.045,
                  longitudeDelta: 0.045,
                }}
                mapType="none"
                rotateEnabled={false}
              >
                <UrlTile
                  urlTemplate={`https://api.mapbox.com/styles/v1/mapbox/${mapTheme}/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(mapboxToken)}`}
                  maximumZ={19}
                />
                <Marker coordinate={mapCenter} pinColor={colors.primary} />
              </MapView>
              <View style={styles.mapBadge}>
                <Ionicons name="map-outline" size={15} color={colors.primary} />
                <Text style={styles.mapBadgeText}>Mapbox location preview</Text>
              </View>
            </View>
            <View style={styles.mapThemeRow}>
              {mapThemes.map((theme) => (
                <Pressable
                  key={theme.style}
                  onPress={() => setMapTheme(theme.style)}
                  style={[
                    styles.mapTheme,
                    mapTheme === theme.style && styles.mapThemeOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.mapThemeText,
                      mapTheme === theme.style && styles.mapThemeTextOn,
                    ]}
                  >
                    {theme.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {location.trim().length > 1 && (
          <View style={styles.nearbyPlaces}>
            {(mapboxToken
              ? placeResults
              : nearbyPlaces
                  .filter((place) =>
                    place.toLowerCase().includes(location.toLowerCase()),
                  )
                  .slice(0, 3)
                  .map((label) => ({ id: label, label, ...mapCenter }))
            ).map((place) => (
              <Pressable
                key={place.id}
                style={styles.nearbyPlace}
                onPress={() => {
                  setLocation(place.label);
                  setMapCenter({
                    latitude: place.latitude,
                    longitude: place.longitude,
                  });
                  setPlaceResults([]);
                }}
              >
                <Ionicons
                  name="location-outline"
                  size={17}
                  color={colors.primary}
                />
                <Text style={styles.nearbyPlaceText}>{place.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.locationHelp}>
          You can type any place manually. Add a Mapbox public token for live
          nearby search and a themed map preview.
        </Text>
        <Text style={styles.inputLabel}>Primary Role</Text>
        <View style={styles.selectInput}>
          <Text style={styles.selectText}>Looking for work</Text>
          <Ionicons name="chevron-down" size={20} color={colors.muted} />
        </View>
        <Text style={styles.inputLabel}>Tell us about yourself</Text>
        <TextInput
          multiline
          style={styles.bioInput}
          placeholder="Share what you're passionate about or what services you offer to the neighborhood…"
          placeholderTextColor="#6D7285"
        />
        <Text style={styles.skillsTitle}>Your Skills & Interests</Text>
        <Text style={styles.skillHelp}>
          Select the categories you want to be vowched for.
        </Text>
        <View style={styles.skillRow}>
          {skills.map((skill) => (
            <Pressable
              key={skill}
              onPress={() => setSelected(skill)}
              style={[styles.skill, selected === skill && styles.skillActive]}
            >
              <Text
                style={[
                  styles.skillText,
                  selected === skill && styles.skillTextActive,
                ]}
              >
                {skill}
              </Text>
            </Pressable>
          ))}
        </View>
        <ArrowButton
          label={saving ? "Saving profile..." : "Save and Continue"}
          onPress={saveProfile}
        />
        <Text style={styles.profileTerms}>
          By creating a profile, you agree to the Vowch Community Guidelines and
          Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function FormField({
  label,
  icon,
  ...props
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.formInput}>
        {icon && <Ionicons name={icon} size={20} color={colors.muted} />}
        <TextInput
          {...props}
          style={styles.formField}
          placeholderTextColor="#6D7285"
        />
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wordmark: { width: 132, height: 48, alignSelf: "center" },
  primaryButtonWrap: { width: "100%", alignSelf: "stretch" },
  safeArea: { flex: 1, backgroundColor: colors.background },
  transition: { flex: 1 },
  splashGlow: {
    position: "absolute",
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: "#FD5C63",
    opacity: 0.18,
    top: -210,
    left: -160,
  },
  splashLogo: { width: "100%", height: 168 },
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "45%",
    paddingBottom: 68,
    paddingHorizontal: 40,
  },
  splashBrand: { alignItems: "center", gap: 18 },
  splashLogoCard: {
    width: 236,
    height: 118,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 4,
  },
  splashTitle: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 30,
    lineHeight: 35,
    textAlign: "center",
    letterSpacing: -0.6,
  },
  logoWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    alignSelf: "center",
    position: "relative",
  },
  logo: {
    fontSize: 35,
    lineHeight: 42,
    fontFamily: "Baloo2_800ExtraBold",
    color: colors.primary,
    letterSpacing: -1.5,
  },
  logoLight: { color: "#fff", fontFamily: "Baloo2_500Medium" },
  logoDot: {
    width: 10,
    height: 10,
    backgroundColor: colors.primary,
    borderRadius: 6,
    marginLeft: 3,
  },
  logoDotLight: { backgroundColor: "#FFB3B1" },
  sparks: {
    position: "absolute",
    left: -15,
    top: -10,
    flexDirection: "row",
    gap: 3,
  },
  spark: {
    width: 4,
    height: 13,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  splashTagline: {
    color: colors.ink,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 8,
    letterSpacing: 1.2,
    fontFamily: "Baloo2_800ExtraBold",
  },
  redDot: { color: colors.primary, fontFamily: "Baloo2_500Medium" },
  loadingBlock: { width: "100%", gap: 13 },
  loadingTrack: {
    height: 6,
    overflow: "hidden",
    backgroundColor: "#EDEAF3",
    borderRadius: 5,
  },
  loadingFill: { height: 6, borderRadius: 5, backgroundColor: colors.primary },
  loadingText: {
    color: colors.muted,
    fontSize: 17,
    textAlign: "center",
    fontFamily: "Baloo2_500Medium",
  },
  onboard: { flex: 1, backgroundColor: colors.background },
  onboardHeader: {
    height: 85,
    paddingHorizontal: 36,
    borderBottomWidth: 1,
    borderColor: "#F0EDF5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skip: {
    color: colors.muted,
    fontSize: 17,
    fontFamily: "Baloo2_800ExtraBold",
  },
  slideContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
    alignItems: "center",
  },
  artCard: {
    width: "100%",
    aspectRatio: 0.94,
    maxHeight: 385,
    borderRadius: 34,
    backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 3,
  },
  artImage: { width: "100%", height: "100%" },
  floatBadge: {
    position: "absolute",
    zIndex: 2,
    width: 58,
    height: 58,
    backgroundColor: "#FDE7EB",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  slideTitle: {
    color: colors.ink,
    fontSize: 38,
    lineHeight: 46,
    fontFamily: "Baloo2_800ExtraBold",
    letterSpacing: -1,
    textAlign: "center",
    marginTop: 30,
  },
  slideBody: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 335,
    fontFamily: "Baloo2_500Medium",
  },
  slideFooter: {
    paddingHorizontal: 36,
    paddingBottom: 34,
    alignItems: "center",
    gap: 23,
  },
  dots: { flexDirection: "row", gap: 9, height: 12, alignItems: "center" },
  dot: { height: 8, width: 8, borderRadius: 5, backgroundColor: "#DEDCE2" },
  dotActive: { width: 25, backgroundColor: colors.primary },
  primaryButton: {
    minHeight: 58,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    shadowColor: "#92001C",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Baloo2_800ExtraBold",
  },
  skipNow: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 13,
  },
  signupScreen: { flex: 1, backgroundColor: colors.background },
  signupScroll: { flexGrow: 1, justifyContent: "center", padding: 25, gap: 28 },
  signupCard: {
    backgroundColor: "#fff",
    borderRadius: 32,
    padding: 23,
    gap: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  joinTitle: {
    color: colors.ink,
    fontSize: 23,
    textAlign: "center",
    fontFamily: "Baloo2_800ExtraBold",
    marginTop: 4,
  },
  joinBody: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
    fontFamily: "Baloo2_500Medium",
  },
  socialButton: {
    minHeight: 53,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#ECB3BC",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 11,
  },
  socialText: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 14,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 7,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E7BDBB" },
  or: {
    color: colors.muted,
    fontFamily: "Baloo2_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  inputLabel: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 14,
    marginBottom: 8,
    marginTop: 4,
  },
  contactInput: {
    minHeight: 54,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: "#9A646A",
    borderRadius: 15,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactField: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontFamily: "Baloo2_500Medium",
  },
  terms: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 7,
    fontFamily: "Baloo2_500Medium",
  },
  termsLink: { color: colors.primary, fontFamily: "Baloo2_800ExtraBold" },
  loginRow: {
    borderTopWidth: 1,
    borderTopColor: "#E7BDBB",
    paddingTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginTop: 5,
  },
  loginText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: "Baloo2_500Medium",
  },
  copyright: {
    textAlign: "center",
    color: "#9B98A1",
    fontSize: 11,
    fontFamily: "Baloo2_500Medium",
  },
  otpScreen: { flex: 1, backgroundColor: colors.background },
  simpleHeader: {
    height: 88,
    borderBottomWidth: 1,
    borderColor: "#F0EDF5",
    paddingHorizontal: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 55,
  },
  otpBody: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  otpMark: {
    height: 112,
    width: 112,
    borderRadius: 34,
    backgroundColor: "#FFD4D3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 38,
  },
  otpTitle: {
    color: colors.ink,
    fontSize: 36,
    fontFamily: "Baloo2_800ExtraBold",
    letterSpacing: -1,
    textAlign: "center",
  },
  otpBodyText: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    marginTop: 14,
    fontFamily: "Baloo2_500Medium",
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 48,
  },
  codeBox: {
    width: 46,
    height: 68,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#E9BCBE",
    alignItems: "center",
    justifyContent: "center",
  },
  codeBoxFilled: { borderColor: colors.primary, backgroundColor: "#FFF0F1" },
  codeText: {
    color: colors.primary,
    fontSize: 25,
    fontFamily: "Baloo2_800ExtraBold",
  },
  hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },
  resend: {
    color: colors.muted,
    fontSize: 18,
    marginTop: 54,
    fontFamily: "Baloo2_500Medium",
  },
  otpBottom: { paddingHorizontal: 36, gap: 33, paddingBottom: 37 },
  neighbors: {
    backgroundColor: "#F0EFFF",
    borderWidth: 1,
    borderColor: "#ECDDE3",
    borderRadius: 28,
    minHeight: 99,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  faces: { flexDirection: "row", fontSize: 28, fontFamily: "Baloo2_500Medium" },
  neighborText: {
    flex: 1,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Baloo2_500Medium",
  },
  neighborStrong: { color: colors.ink, fontFamily: "Baloo2_800ExtraBold" },
  profileScreen: { flex: 1, backgroundColor: colors.background },
  profileHeader: {
    height: 67,
    borderBottomWidth: 1,
    borderColor: "#EDEAF2",
    paddingHorizontal: 21,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  step: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: "Baloo2_800ExtraBold",
  },
  profileScroll: { padding: 21, paddingBottom: 40 },
  profileTitle: {
    color: colors.ink,
    fontSize: 32,
    letterSpacing: -1,
    fontFamily: "Baloo2_800ExtraBold",
    marginTop: 16,
  },
  profileBody: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 7,
    marginBottom: 32,
    fontFamily: "Baloo2_500Medium",
  },
  photoCard: {
    borderWidth: 1,
    borderColor: "#D6D2FF",
    backgroundColor: "#fff",
    borderRadius: 30,
    minHeight: 270,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    marginBottom: 31,
    position: "relative",
  },
  photoCircle: {
    height: 90,
    width: 90,
    borderRadius: 45,
    backgroundColor: "#E5E5FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    elevation: 3,
    overflow: "hidden",
  },
  profilePhoto: { width: "100%", height: "100%" },
  avatarInitial: {
    color: "#fff",
    fontSize: 37,
    fontFamily: "Baloo2_800ExtraBold",
  },
  editBadge: {
    position: "absolute",
    top: 86,
    left: "58%",
    backgroundColor: colors.primary,
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  photoTitle: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: "Baloo2_800ExtraBold",
    marginTop: 19,
  },
  photoCopy: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    fontFamily: "Baloo2_500Medium",
  },
  uploadLink: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: "Baloo2_800ExtraBold",
    marginTop: 16,
  },
  avatarChoices: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E9A8AA",
    borderRadius: 19,
    padding: 14,
    marginTop: -18,
    marginBottom: 26,
  },
  avatarChoiceHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  avatarChoiceTitle: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: "Baloo2_800ExtraBold",
  },
  avatarChoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 7,
  },
  avatarOption: {
    height: 42,
    width: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarOptionSelected: {
    borderColor: colors.ink,
    transform: [{ scale: 1.08 }],
  },
  avatarOptionText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Baloo2_800ExtraBold",
  },
  formInput: {
    minHeight: 61,
    borderRadius: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E9A8AA",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 17,
  },
  formField: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontFamily: "Baloo2_500Medium",
  },
  placesContainer: { flex: 0, zIndex: 5, marginBottom: 12 },
  placesInputContainer: {
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 0,
  },
  placesInput: {
    height: 61,
    borderRadius: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E9A8AA",
    paddingHorizontal: 15,
    color: colors.ink,
    fontSize: 15,
    fontFamily: "Baloo2_500Medium",
  },
  placesList: {
    borderWidth: 1,
    borderColor: "#E9A8AA",
    borderRadius: 13,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  placesRow: { backgroundColor: "#fff", paddingVertical: 13 },
  placesDescription: {
    color: colors.ink,
    fontFamily: "Baloo2_600SemiBold",
    fontSize: 14,
  },
  placesSeparator: { height: 1, backgroundColor: "#F1ECEF" },
  currentLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 5,
    marginTop: -7,
    marginBottom: 11,
  },
  currentLocationText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: "Baloo2_800ExtraBold",
  },
  nearbyPlaces: {
    borderRadius: 13,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEE8ED",
    marginTop: -4,
    marginBottom: 9,
  },
  nearbyPlace: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#F1ECEF",
  },
  nearbyPlaceText: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: "Baloo2_600SemiBold",
  },
  mapPreview: {
    height: 158,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E9A8AA",
    position: "relative",
  },
  map: { width: "100%", height: "100%" },
  mapBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.94)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  mapBadgeText: {
    color: colors.ink,
    fontSize: 11,
    fontFamily: "Baloo2_700Bold",
  },
  mapThemeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: -5,
    marginBottom: 13,
  },
  mapTheme: {
    flex: 1,
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E9A8AA",
    alignItems: "center",
    justifyContent: "center",
  },
  mapThemeOn: { backgroundColor: "#FFE2E5", borderColor: colors.primary },
  mapThemeText: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: "Baloo2_700Bold",
  },
  mapThemeTextOn: { color: colors.primary, fontFamily: "Baloo2_800ExtraBold" },
  locationHelp: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Baloo2_500Medium",
    marginBottom: 19,
    marginTop: -1,
  },
  selectInput: {
    minHeight: 61,
    borderRadius: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E9A8AA",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
  },
  selectText: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: "Baloo2_500Medium",
  },
  bioInput: {
    height: 132,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E9A8AA",
    borderRadius: 13,
    padding: 15,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
    marginBottom: 28,
    fontFamily: "Baloo2_500Medium",
  },
  skillsTitle: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: "Baloo2_800ExtraBold",
  },
  skillHelp: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 15,
    fontFamily: "Baloo2_500Medium",
  },
  skillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 35,
  },
  skill: {
    borderWidth: 1,
    borderColor: "#E9A8AA",
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  skillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  skillText: {
    color: colors.ink,
    fontSize: 13,
    fontFamily: "Baloo2_800ExtraBold",
  },
  skillTextActive: { color: "#fff", fontFamily: "Baloo2_500Medium" },
  profileTerms: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 20,
    paddingHorizontal: 25,
    fontFamily: "Baloo2_500Medium",
  },
});

const polish = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  transition: { flex: 1 },
  splash: {
    backgroundColor: colors.background,
    paddingTop: 110,
    paddingBottom: 54,
    paddingHorizontal: 36,
    overflow: "hidden",
  },
  splashGlow: {
    position: "absolute",
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: colors.primary,
    opacity: 0.15,
    top: -210,
    left: -160,
  },
  splashBrand: { width: "100%", gap: 22 },
  splashLogo: { width: "100%", height: 168 },
  splashTagline: {
    color: "#F8F4F7",
    borderWidth: 1,
    borderColor: "#5D5B60",
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  loadingTrack: { height: 9, backgroundColor: "#F0DDE0" },
  loadingFill: { height: 9, backgroundColor: colors.primary },
  loadingText: { color: "#E5E0E5", fontSize: 15 },
  onboardHeader: { height: 76, paddingHorizontal: 28 },
  slideContent: { paddingHorizontal: 25 },
  artCard: { aspectRatio: 0.94, maxHeight: 385, borderRadius: 34 },
  floatBadge: { width: 52, height: 52, borderRadius: 18 },
  slideTitle: { fontSize: 34, lineHeight: 41, marginTop: 36 },
  slideBody: { fontSize: 17, lineHeight: 26, marginTop: 12, maxWidth: 340 },
  slideFooter: { paddingHorizontal: 28, paddingBottom: 28, gap: 18 },
  simpleHeader: { height: 68, paddingHorizontal: 25, gap: 48 },
  otpMark: { height: 96, width: 96, borderRadius: 30, marginBottom: 30 },
  otpTitle: { fontSize: 32 },
  otpBodyText: { fontSize: 17, lineHeight: 26, marginTop: 12 },
  codeRow: { marginTop: 38 },
  codeBox: { width: 44, height: 63, borderRadius: 16 },
  resend: { fontSize: 17, marginTop: 42 },
  otpBottom: { paddingHorizontal: 28, gap: 23, paddingBottom: 24 },
  neighbors: { minHeight: 89, padding: 14 },
  neighborText: { fontSize: 14, lineHeight: 20 },
});

const styles = {
  ...baseStyles,
  splash: [baseStyles.splash, polish.splash],
  splashBrand: [baseStyles.splashBrand, polish.splashBrand],
  splashLogo: polish.splashLogo,
  splashTagline: [baseStyles.splashTagline, polish.splashTagline],
  loadingTrack: [baseStyles.loadingTrack, polish.loadingTrack],
  loadingFill: [baseStyles.loadingFill, polish.loadingFill],
  loadingText: [baseStyles.loadingText, polish.loadingText],
  onboardHeader: [baseStyles.onboardHeader, polish.onboardHeader],
  slideContent: [baseStyles.slideContent, polish.slideContent],
  artCard: [baseStyles.artCard, polish.artCard],
  floatBadge: [baseStyles.floatBadge, polish.floatBadge],
  slideTitle: [baseStyles.slideTitle, polish.slideTitle],
  slideBody: [baseStyles.slideBody, polish.slideBody],
  slideFooter: [baseStyles.slideFooter, polish.slideFooter],
  simpleHeader: [baseStyles.simpleHeader, polish.simpleHeader],
  otpMark: [baseStyles.otpMark, polish.otpMark],
  otpTitle: [baseStyles.otpTitle, polish.otpTitle],
  otpBodyText: [baseStyles.otpBodyText, polish.otpBodyText],
  codeRow: [baseStyles.codeRow, polish.codeRow],
  codeBox: [baseStyles.codeBox, polish.codeBox],
  resend: [baseStyles.resend, polish.resend],
  otpBottom: [baseStyles.otpBottom, polish.otpBottom],
  neighbors: [baseStyles.neighbors, polish.neighbors],
  neighborText: [baseStyles.neighborText, polish.neighborText],
};

function Welcome({
  onStart,
  onLogin,
  onBrowse,
}: {
  onStart: () => void;
  onLogin: () => void;
  onBrowse?: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade]);
  return (
    <View style={welcomeStyles.screen}>
      <Animated.View
        style={[
          welcomeStyles.inner,
          {
            opacity: fade,
            transform: [
              {
                translateY: fade.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={welcomeStyles.brandFrame}>
          <Image
            source={brandAsset}
            style={welcomeStyles.brandImage}
            resizeMode="contain"
          />
        </View>
        <Image
          source={illustrations[2]}
          style={welcomeStyles.hero}
          resizeMode="cover"
        />
        <View style={welcomeStyles.copy}>
          <Text style={welcomeStyles.title}>
            Community help,{`\n`}made simple.
          </Text>
          <Text style={welcomeStyles.subtitle}>
            Post a request, find trusted people, and get things done together.
          </Text>
        </View>
        <View style={welcomeStyles.buttons}>
          <ArrowButton label="Let's get started" onPress={onStart} />
          <Pressable onPress={onLogin} style={welcomeStyles.secondary}>
            <Text style={welcomeStyles.secondaryText}>
              I already have an account
            </Text>
          </Pressable>
          {onBrowse && (
            <Pressable onPress={onBrowse} hitSlop={10}>
              <Text style={welcomeStyles.browse}>Explore Vowch first</Text>
            </Pressable>
          )}
        </View>
        <Text style={welcomeStyles.legal}>
          By continuing, you agree to our{`\n`}
          <Text style={welcomeStyles.legalLink}>
            Terms & Conditions
          </Text> and{" "}
          <Text style={welcomeStyles.legalLink}>Privacy Policy</Text>.
        </Text>
      </Animated.View>
    </View>
  );
}

function AuthBack({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={authStyles.back}>
      <Ionicons name="arrow-back" size={22} color={colors.primary} />
    </Pressable>
  );
}

function SignupWithRecovery({
  onBack,
  onDone,
  onForgot,
}: {
  onBack: () => void;
  onDone: (email: string) => void;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState("");
  const continueSignIn = () => {
    if (!isValidEmail(email)) {
      Alert.alert(
        "Enter a valid email",
        "Use the email address connected to your Vowch account.",
      );
      return;
    }
    onDone(email.trim().toLowerCase());
  };
  return (
    <KeyboardAvoidingView
      style={authStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={authStyles.header}>
        <AuthBack onPress={onBack} />
        <Image
          source={brandAsset}
          style={authStyles.logo}
          resizeMode="contain"
        />
      </View>
      <ScrollView
        contentContainerStyle={authStyles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={authStyles.title}>Welcome back</Text>
        <Text style={authStyles.subtitle}>
          Sign in to find local help and trusted gigs.
        </Text>
        <Text style={authStyles.label}>Email address</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="e.g. john@example.com"
          placeholderTextColor="#7A808A"
          style={authStyles.input}
        />
        <ArrowButton label="Continue" onPress={continueSignIn} />
        <Pressable onPress={onForgot} hitSlop={12}>
          <Text style={authStyles.forgot}>Forgot password?</Text>
        </Pressable>
        <Text style={authStyles.footer}>
          New to Vowch? <Text style={authStyles.link}>Create an account</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ForgotPassword({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const sendResetCode = () => {
    if (!isValidEmail(email)) {
      Alert.alert(
        "Enter a valid email",
        "Enter the email address where we should send your reset code.",
      );
      return;
    }
    onDone();
  };
  return (
    <KeyboardAvoidingView
      style={authStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={authStyles.header}>
        <AuthBack onPress={onBack} />
        <Image
          source={brandAsset}
          style={authStyles.logo}
          resizeMode="contain"
        />
      </View>
      <ScrollView
        contentContainerStyle={authStyles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={authStyles.title}>Forgot password?</Text>
        <Text style={authStyles.subtitle}>
          Enter your registered email address. We’ll send a secure reset code.
        </Text>
        <Text style={authStyles.label}>Email address</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="e.g. john@example.com"
          placeholderTextColor="#7A808A"
          style={authStyles.input}
        />
        <ArrowButton label="Send reset code" onPress={sendResetCode} />
        <Text style={authStyles.footer}>
          Remember your password? <Text style={authStyles.link}>Sign in</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ResetCode({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const input = useRef<TextInput>(null);
  const submitCode = () => {
    if (code.length !== 6) {
      Alert.alert(
        "Enter your code",
        "Please enter the 6-digit reset code we sent you.",
      );
      return;
    }
    onDone();
  };
  return (
    <View style={authStyles.screen}>
      <View style={authStyles.header}>
        <AuthBack onPress={onBack} />
        <Image
          source={brandAsset}
          style={authStyles.logo}
          resizeMode="contain"
        />
      </View>
      <Pressable
        onPress={() => input.current?.focus()}
        style={authStyles.codeBody}
      >
        <Text style={authStyles.title}>Enter code</Text>
        <Text style={authStyles.subtitle}>
          We emailed a 6-digit code to your registered address.
        </Text>
        <View style={authStyles.codeRow}>
          {Array.from({ length: 6 }, (_, index) => (
            <View
              key={index}
              style={[
                authStyles.codeCell,
                code[index] && authStyles.codeCellFilled,
              ]}
            >
              <Text style={authStyles.codeCharacter}>{code[index] || "—"}</Text>
            </View>
          ))}
        </View>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(value) =>
            setCode(value.replace(/\D/g, "").slice(0, 6))
          }
          keyboardType="number-pad"
          autoFocus
          maxLength={6}
          style={authStyles.hiddenInput}
        />
      </Pressable>
      <View style={authStyles.action}>
        <ArrowButton label="Submit" onPress={submitCode} />
        <Text style={authStyles.footer}>
          Didn’t get the email? <Text style={authStyles.link}>Resend code</Text>
        </Text>
      </View>
    </View>
  );
}

const welcomeStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4EFF3" },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 22,
    alignItems: "center",
  },
  brandFrame: { width: 190, height: 70, marginBottom: 18 },
  brandImage: { width: "100%", height: "100%" },
  hero: { width: 286, height: 286, borderRadius: 34, marginVertical: 10 },
  copy: { alignItems: "center", marginTop: 18 },
  title: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: "Baloo2_800ExtraBold",
    textAlign: "center",
    letterSpacing: -1.1,
  },
  subtitle: {
    color: "#69717A",
    fontSize: 16,
    lineHeight: 23,
    fontFamily: "Baloo2_600SemiBold",
    textAlign: "center",
    marginTop: 12,
    maxWidth: 300,
  },
  buttons: { width: "100%", marginTop: "auto", gap: 14 },
  secondary: {
    minHeight: 56,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: "Baloo2_800ExtraBold",
  },
  browse: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: "Baloo2_700Bold",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  legal: {
    color: "#8F969F",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 23,
    fontFamily: "Baloo2_500Medium",
  },
  legalLink: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    textDecorationLine: "underline",
  },
});

const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4EFF3" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  back: {
    height: 42,
    width: 42,
    borderRadius: 21,
    backgroundColor: "#FFE3E4",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 112, height: 42 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 45,
    paddingBottom: 32,
  },
  title: {
    color: colors.ink,
    fontSize: 35,
    lineHeight: 41,
    fontFamily: "Baloo2_800ExtraBold",
    marginBottom: 12,
  },
  subtitle: {
    color: "#68707A",
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "Baloo2_500Medium",
    marginBottom: 35,
  },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: "Baloo2_700Bold",
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0CDD0",
    paddingHorizontal: 16,
    color: colors.ink,
    fontSize: 16,
    fontFamily: "Baloo2_500Medium",
    marginBottom: 26,
  },
  forgot: {
    color: colors.primary,
    fontSize: 15,
    fontFamily: "Baloo2_700Bold",
    textAlign: "center",
    marginTop: 25,
  },
  footer: {
    color: "#858B95",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Baloo2_500Medium",
    textAlign: "center",
    marginTop: "auto",
  },
  link: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    textDecorationLine: "underline",
  },
  codeBody: { flex: 1, paddingHorizontal: 24, paddingTop: 45 },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
  },
  codeCell: {
    width: 45,
    height: 62,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EBCACC",
    alignItems: "center",
    justifyContent: "center",
  },
  codeCellFilled: { borderColor: colors.primary, backgroundColor: "#FFF0F1" },
  codeCharacter: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 25,
  },
  hiddenInput: { position: "absolute", height: 1, width: 1, opacity: 0 },
  action: { paddingHorizontal: 24, paddingBottom: 32, gap: 24 },
});
