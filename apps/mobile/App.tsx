import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CirclePlus,
  Clock3,
  Compass,
  CreditCard,
  House as HomeIcon,
  Landmark,
  MapPin,
  MessageCircle,
  Navigation,
  PlusCircle,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
  Users,
  Wallet,
  Zap,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFonts,
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from "@expo-google-fonts/baloo-2";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { api } from "./src/api";
import { colors, radius } from "./src/theme";
import type { Gig, Screen } from "./src/types";
import { Onboarding } from "./src/onboarding";

const money = (paise: number) => `$${(paise / 100).toFixed(0)}`;
const lucideIcons: Record<string, any> = {
  "add-circle": PlusCircle,
  "arrow-back": ArrowLeft,
  "arrow-forward": ArrowRight,
  "bookmark-outline": Bookmark,
  "briefcase-outline": BriefcaseBusiness,
  "calendar-outline": CalendarDays,
  "camera-outline": Camera,
  checkmark: Check,
  "checkmark-circle": CheckCircle2,
  "chevron-forward": ChevronRight,
  "compass-outline": Compass,
  "card-outline": CreditCard,
  "flash-outline": Zap,
  "landmark-outline": Landmark,
  "location-outline": MapPin,
  "navigate-outline": Navigation,
  "notifications-outline": Bell,
  notifications: Bell,
  "options-outline": SlidersHorizontal,
  "people-outline": Users,
  "person-outline": UserRound,
  "search-outline": Search,
  "send-outline": Send,
  "settings-outline": Settings,
  "share-outline": Share2,
  "shield-checkmark": ShieldCheck,
  "shield-checkmark-outline": ShieldCheck,
  "time-outline": Clock3,
  "upload-outline": Upload,
  "wallet-outline": Wallet,
};
const icon = (name: string, size = 21, color: string = colors.ink) => {
  const Icon = lucideIcons[name] ?? CirclePlus;
  return <Icon size={size} color={color} strokeWidth={2.5} />;
};
const brandAsset = require("./assets/vowch-brand-transparent.png");

// Gig-side flow components live below the shared assets so they can reuse the Vowch design system.

function VowchAppFlow6() {
  const [screen, setScreen] = useState<Screen>("home");
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [guestBrowsing, setGuestBrowsing] = useState(false);
  useEffect(() => {
    api
      .gigs()
      .then(setGigs)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (guestBrowsing) {
        setGuestBrowsing(false);
        return true;
      }
      if (!onboarded || screen === "home") return false;
      const back: Partial<Record<Screen, Screen>> = {
        chat: "inbox",
        apply: "gig",
        manage: "gig",
        tracking: "dashboard",
        wallet: "settings",
        safety: "settings",
        profile: "settings",
        houses: "passport",
        housefeed: "houses",
        directory: "housefeed",
        housecreate: "houses",
        houseadmin: "housefeed",
        verify: "passport",
        sharepassport: "passport",
        referrals: "passport",
      };
      setScreen(back[screen] ?? "home");
      return true;
    });
    return () => sub.remove();
  }, [guestBrowsing, onboarded, screen]);
  const openGig = (gig: Gig) => {
    setSelectedGig(gig);
    setScreen("gig");
  };
  const content = useMemo(() => {
    if (screen === "home")
      return gigs.length ? (
        <Home gigs={gigs} setScreen={setScreen} openGig={openGig} />
      ) : (
        <EmptyHome setScreen={setScreen} />
      );
    if (screen === "explore") return <Explore gigs={gigs} openGig={openGig} />;
    if (screen === "create")
      return (
        <Create
          onBack={() => setScreen("home")}
          onCreated={(gig) => setGigs((old) => [gig, ...old])}
          onViewPost={(gig) => {
            setSelectedGig(gig);
            setScreen("gig");
          }}
          onFindGig={() => setScreen("explore")}
        />
      );
    if (screen === "gig" && selectedGig)
      return (
        <GigDetailNew
          gig={selectedGig}
          onBack={() => setScreen("home")}
          onApply={() => setScreen("apply")}
          onManage={() => setScreen("manage")}
        />
      );
    if (screen === "manage" && selectedGig)
      return (
        <RequestManager
          gig={selectedGig}
          onBack={() => setScreen("gig")}
          onChat={() => setScreen("chat")}
          onTrack={() => setScreen("tracking")}
        />
      );
    if (screen === "apply" && selectedGig)
      return (
        <ApplyForGig
          gig={selectedGig}
          onBack={() => setScreen("gig")}
          onSent={() => setScreen("dashboard")}
        />
      );
    if (screen === "dashboard")
      return (
        <GigDashboard
          onBack={() => setScreen("home")}
          onTrack={() => setScreen("tracking")}
          onNotifications={() => setScreen("notifications")}
          onWallet={() => setScreen("wallet")}
          openGig={openGig}
          gigs={gigs}
        />
      );
    if (screen === "tracking")
      return <JobTracking onBack={() => setScreen("dashboard")} />;
    if (screen === "inbox")
      return <InboxNew openChat={() => setScreen("chat")} />;
    if (screen === "chat")
      return (
        <ChatNew
          onBack={() => setScreen("inbox")}
          onTrack={() => setScreen("tracking")}
        />
      );
    if (screen === "notifications")
      return <NotificationsNew onOpenChat={() => setScreen("chat")} />;
    if (screen === "passport") return <PassportHub setScreen={setScreen} profile={memberProfile} />;
    if (screen === "houses") return <HousesHub setScreen={setScreen} />;
    if (screen === "housefeed") return <HouseFeed setScreen={setScreen} />;
    if (screen === "directory") return <Directory setScreen={setScreen} />;
    if (screen === "housecreate") return <HouseCreate setScreen={setScreen} />;
    if (screen === "houseadmin") return <HouseAdmin setScreen={setScreen} />;
    if (screen === "verify") return <Verification setScreen={setScreen} />;
    if (screen === "sharepassport")
      return <SharePassport setScreen={setScreen} />;
    if (screen === "referrals") return <Referrals setScreen={setScreen} />;
    if (screen === "settings")
      return (
        <SettingsNew
          setScreen={setScreen}
          onLogout={() => setOnboarded(false)}
        />
      );
    if (screen === "profile")
      return <ProfileNew onEdit={() => setScreen("settings")} />;
    if (screen === "wallet")
      return <WalletNew onBack={() => setScreen("settings")} />;
    if (screen === "safety")
      return <SafetyNew onBack={() => setScreen("settings")} />;
    return <House />;
  }, [screen, gigs, selectedGig, memberProfile]);
  if (!onboarded && !guestBrowsing)
    return (
      <View style={styles.app}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <Onboarding
          onComplete={() => { setOnboarded(true); void api.profile().then(setMemberProfile).catch(() => {}); }}
          onBrowse={() => setGuestBrowsing(true)}
        />
      </View>
    );
  if (!onboarded && guestBrowsing)
    return (
      <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <GuestExplore
          gigs={gigs}
          onJoin={() => setGuestBrowsing(false)}
          onOpenGig={() =>
            Alert.alert(
              "Join Vowch to continue",
              "Create a free profile to see full details, save this gig, or send an application.",
              [
                { text: "Keep exploring", style: "cancel" },
                {
                  text: "Create profile",
                  onPress: () => setGuestBrowsing(false),
                },
              ],
            )
          }
        />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScreenMotion screen={screen}>{content}</ScreenMotion>
      {![
        "create",
        "gig",
        "manage",
        "apply",
        "dashboard",
        "tracking",
        "chat",
        "notifications",
        "profile",
        "settings",
        "wallet",
        "safety",
        "house",
        "houses",
        "housefeed",
        "directory",
        "housecreate",
        "houseadmin",
        "verify",
        "sharepassport",
        "referrals",
      ].includes(screen) && <Nav active={screen} setScreen={setScreen} />}
    </SafeAreaView>
  );
}

function SkillPassportCard({ profile }: { profile: any }) {
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const flip = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);
  const name = profile?.displayName || "Vowch member";
  const skill = profile?.primarySkill || "Community skill";
  const cred = Number(profile?.cred || 0);
  const passportNo = profile?.passportNo || "PENDING";
  const status = String(profile?.trustStatus || "EXPLORER").replace(/_/g, " ");
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float]);
  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    Animated.spring(flip, { toValue: next ? 1 : 0, friction: 8, tension: 65, useNativeDriver: true }).start();
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
    onPanResponderMove: (_, gesture) => {
      tiltX.setValue(Math.max(-1, Math.min(1, gesture.dy / 135)));
      tiltY.setValue(Math.max(-1, Math.min(1, gesture.dx / 135)));
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 7 && Math.abs(gesture.dy) < 7) toggle();
      Animated.parallel([Animated.spring(tiltX, { toValue: 0, friction: 7, useNativeDriver: true }), Animated.spring(tiltY, { toValue: 0, friction: 7, useNativeDriver: true })]).start();
    },
  }), [tiltX, tiltY, flipped]);
  const frontTurn = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backTurn = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const rotateX = tiltX.interpolate({ inputRange: [-1, 1], outputRange: ["8deg", "-8deg"] });
  const rotateY = tiltY.interpolate({ inputRange: [-1, 1], outputRange: ["-10deg", "10deg"] });
  const lift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  return <View style={houseStyles.passportWrap}>
    <Animated.View {...pan.panHandlers} accessibilityRole="button" accessibilityLabel="Vowch Skill Passport. Tap to flip, drag to tilt." style={[houseStyles.passportTilt, { transform: [{ perspective: 1050 }, { rotateX }, { rotateY }, { translateY: lift }] }]}>
      <Animated.View style={[houseStyles.skillPassportFace, houseStyles.skillPassportFront, { transform: [{ rotateY: frontTurn }] }]}>
        <LinearGradient colors={["#08090D", "#292B36", "#101116"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={houseStyles.passportMetal} /><View style={houseStyles.passportRingOne} /><View style={houseStyles.passportRingTwo} />
        <View style={houseStyles.skillPassportTop}><View style={houseStyles.skillPassportBrand}><Text style={houseStyles.skillPassportV}>v</Text><Text style={houseStyles.skillPassportWord}>VOWCH</Text></View><Text style={houseStyles.skillPassportEdition}>SKILL PASSPORT{"\n"}01 / BENGALURU</Text></View>
        <View style={houseStyles.skillPassportChipRow}><View style={houseStyles.passportChip}><View /><View /><View /><View /></View><View style={houseStyles.passportStatus}><View style={[houseStyles.passportStatusDot, status === "VOUCHED" ? houseStyles.passportStatusDotLive : houseStyles.passportStatusDotPending]} /><Text style={houseStyles.passportStatusText}>{status}</Text></View></View>
        <View style={houseStyles.skillPassportMember}><Text style={houseStyles.skillPassportLabel}>MEMBER</Text><Text style={houseStyles.skillPassportName}>{name}</Text><Text style={houseStyles.skillPassportSkill}>{skill}</Text></View>
        <View style={houseStyles.skillPassportCred}><Text style={houseStyles.skillPassportLabel}>TRUST CRED</Text><Text style={houseStyles.skillPassportCredNumber}>{String(cred).padStart(3, "0")}</Text><Text style={houseStyles.skillPassportTiny}>OUT OF 1000</Text></View>
        <View style={houseStyles.skillPassportBottom}><View><Text style={houseStyles.skillPassportLabel}>PASSPORT NUMBER</Text><Text style={houseStyles.skillPassportId}>{passportNo}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={houseStyles.skillPassportLabel}>NETWORK</Text><Text style={houseStyles.skillPassportId}>VOWCH / IN</Text></View>{icon("shield-checkmark", 25, colors.gold)}</View>
      </Animated.View>
      <Animated.View style={[houseStyles.skillPassportFace, houseStyles.skillPassportBack, { transform: [{ rotateY: backTurn }] }]}>
        <View style={houseStyles.passportMetal} /><View style={houseStyles.passportStripe} /><View style={houseStyles.passportBackCopy}><Text style={houseStyles.passportBackKicker}>VOWCH TRUST LAYER</Text><Text style={houseStyles.passportBackTitle}>Built for accountable local work.</Text><Text style={houseStyles.passportBackBody}>Your identity, local reputation, and skill history live together here.</Text></View><View style={houseStyles.passportBackGrid}>{[["PRIMARY SKILL", skill], ["STATUS", status], ["CRED SCORE", String(cred)], ["NETWORK", "BENGALURU"]].map(([label, value]) => <View key={label} style={houseStyles.passportBackItem}><Text style={houseStyles.passportBackItemLabel}>{label}</Text><Text style={houseStyles.passportBackItemValue}>{value}</Text></View>)}</View><View style={houseStyles.passportBackFooter}><Text style={houseStyles.passportBackFooterText}>VOWCH / {passportNo}</Text><Text style={houseStyles.passportBackFooterText}>Tap to return</Text></View>
      </Animated.View>
    </Animated.View>
    <Text style={houseStyles.passportMotionHint}>Drag to tilt · Tap to inspect</Text>
  </View>;
}

function PassportHub({ setScreen, profile }: { setScreen: (screen: Screen) => void; profile: any }) {
  const cards = [
    [
      "Verification Center",
      "Complete trust checks and unlock community features",
      "verify",
    ],
    [
      "Share your passport",
      "Let neighbours verify your credentials",
      "sharepassport",
    ],
    ["My referral tree", "See how your trust network is growing", "referrals"],
    ["My Houses", "Discover your trusted local communities", "houses"],
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={houseStyles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <Header title="Vowch" subtitle="YOUR SKILL PASSPORT" />
      <SkillPassportCard profile={profile} />
      {false && (
      <LinearGradient
        colors={["#711126", "#BE1738"]}
        style={houseStyles.passportCard}
      >
        <View style={houseStyles.passportHead}>
          <Text style={houseStyles.passportCode}>VP-2847-AX91</Text>
          {icon("shield-checkmark", 28, "#fff")}
        </View>
        <Text style={houseStyles.passportName}>Aarav Mehta</Text>
        <Text style={houseStyles.passportSub}>Community helper · Brooklyn</Text>
        <View style={houseStyles.passportStats}>
          <View>
            <Text style={houseStyles.passportNumber}>98%</Text>
            <Text style={houseStyles.passportLabel}>RELIABILITY</Text>
          </View>
          <View>
            <Text style={houseStyles.passportNumber}>14</Text>
            <Text style={houseStyles.passportLabel}>VOUCHES</Text>
          </View>
          <View>
            <Text style={houseStyles.passportNumber}>Gold</Text>
            <Text style={houseStyles.passportLabel}>TRUST TIER</Text>
          </View>
        </View>
      </LinearGradient>
      )}
      <Text style={styles.sectionTitle}>Your trust, in one place</Text>
      {cards.map(([title, desc, target]) => (
        <Pressable
          key={title}
          style={houseStyles.routeCard}
          onPress={() => setScreen(target as Screen)}
        >
          <View style={houseStyles.routeIcon}>
            {icon(
              target === "houses"
                ? "people-outline"
                : target === "verify"
                  ? "shield-checkmark"
                  : target === "sharepassport"
                    ? "share-outline"
                    : "compass-outline",
              21,
              colors.primary,
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.posterName}>{title}</Text>
            <Text style={styles.posterMeta}>{desc}</Text>
          </View>
          {icon("chevron-forward", 18, colors.muted)}
        </Pressable>
      ))}
      <Text style={styles.sectionTitle}>Verified skills</Text>
      {[
        "Visual brand design · 14 active vouches",
        "Frontend architecture · 8 active vouches",
      ].map((x) => (
        <View style={houseStyles.skillRow} key={x}>
          {icon("checkmark-circle", 18, colors.success)}
          <Text style={styles.posterName}>{x}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function HousesHub({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const houses = [
    [
      "Sunset District Community",
      "246 members · 1.2 km",
      "A vibrant community of artists, families, and local entrepreneurs.",
    ],
    [
      "Park Terrace Apts",
      "84 members · 2.6 km",
      "Shared amenities, building-wide vouching, and security alerts.",
    ],
    [
      "TechHub Central",
      "1.4k members · 3.2 km",
      "Professional networking house for trusted local connections.",
    ],
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={houseStyles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.detailTop}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("passport")}
        >
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Houses</Text>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("housecreate")}
        >
          {icon("add-circle", 23, colors.primary)}
        </Pressable>
      </View>
      <Text style={styles.detailTitle}>Discover Houses</Text>
      <Text style={styles.formHint}>
        Find trusted communities near you and grow your local network.
      </Text>
      <View style={houseStyles.houseSearch}>
        {icon("search-outline", 20, colors.muted)}
        <Text style={flowStyles.searchCopy}>Search houses near you</Text>
      </View>
      {houses.map(([name, meta, body], i) => (
        <Pressable
          key={name}
          style={houseStyles.houseCard}
          onPress={() => setScreen("housefeed")}
        >
          <View
            style={[
              houseStyles.houseArt,
              {
                backgroundColor:
                  i === 0 ? "#FFE7CA" : i === 1 ? "#E7E9FF" : "#DFF1E9",
              },
            ]}
          >
            <Text style={{ fontSize: 34 }}>
              {i === 0 ? "🌇" : i === 1 ? "🏢" : "💡"}
            </Text>
          </View>
          <Text style={styles.gigTitle}>{name}</Text>
          <Text style={houseStyles.houseMeta}>{meta}</Text>
          <Text style={styles.formHint} numberOfLines={2}>
            {body}
          </Text>
          <View style={houseStyles.joinRow}>
            <Pill tone="red">VERIFIED HOUSE</Pill>
            <Text style={houseStyles.joinText}>View house →</Text>
          </View>
        </Pressable>
      ))}
      <Pressable
        style={houseStyles.nearby}
        onPress={() => setScreen("housecreate")}
      >
        <Text style={styles.posterName}>
          ＋ Create a House for your community
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function HouseFeed({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const posts = [
    [
      "Sarah Jenkins · Apt 4B",
      "Going away for the weekend and my Monstera needs some love! Just 5 mins on Saturday would be huge.",
      "Pet care",
    ],
    [
      "David Chen · Apt 12C",
      "Just got a new tool kit and I’m bored. If anyone has IKEA boxes they’re dreading, let me know!",
      "Offering help",
    ],
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={houseStyles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.detailTop}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("houses")}
        >
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>The Green Loft</Text>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("directory")}
        >
          {icon("people-outline")}
        </Pressable>
      </View>
      <LinearGradient
        colors={["#E84863", "#FF906F"]}
        style={houseStyles.announcement}
      >
        <Text style={houseStyles.announcementTitle}>Building announcement</Text>
        <Text style={houseStyles.announcementText}>
          Elevator maintenance this Saturday, 10 AM–2 PM. Thanks for keeping the
          house moving smoothly.
        </Text>
      </LinearGradient>
      <View style={houseStyles.feedActions}>
        <Pressable
          style={houseStyles.feedButton}
          onPress={() => setScreen("directory")}
        >
          {icon("people-outline", 19, colors.primary)}
          <Text style={houseStyles.feedButtonText}>Directory</Text>
        </Pressable>
        <Pressable
          style={houseStyles.feedButton}
          onPress={() => setScreen("houseadmin")}
        >
          {icon("settings-outline", 19, colors.primary)}
          <Text style={houseStyles.feedButtonText}>House admin</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionTitle}>House requests</Text>
      {posts.map(([person, copy, tag]) => (
        <View key={person} style={houseStyles.postCard}>
          <View style={flowStyles.chatHead}>
            <Text style={styles.posterName}>{person}</Text>
            <Text style={flowStyles.time}>2h ago</Text>
          </View>
          <Text style={styles.detailDescription}>{copy}</Text>
          <View style={houseStyles.postBottom}>
            <Pill>{tag}</Pill>
            <Text style={houseStyles.joinText}>Offer help →</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Directory({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const members = [
    "Marcus Chen · Home repairs",
    "Sarah Jenkins · Pet care",
    "Arthur Bloom · Tutoring",
    "Elena Rossi · Visual design",
    "David Kim · Local errands",
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={houseStyles.scroll}
    >
      <View style={styles.detailTop}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("housefeed")}
        >
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Directory</Text>
        <View style={styles.iconButton} />
      </View>
      <Text style={styles.detailTitle}>Sunset District</Text>
      <Text style={styles.formHint}>
        Discover neighbours who make the community thrive.
      </Text>
      <LinearGradient
        colors={["#BD1736", "#E94F63"]}
        style={houseStyles.statBanner}
      >
        <Text style={houseStyles.bannerNumber}>246</Text>
        <Text style={houseStyles.bannerLabel}>MEMBERS</Text>
        <Text style={houseStyles.bannerNumber}>18</Text>
        <Text style={houseStyles.bannerLabel}>VERIFIED SKILLS</Text>
      </LinearGradient>
      {members.map((member, i) => (
        <View key={member} style={houseStyles.member}>
          <View style={houseStyles.memberAvatar}>
            <Text style={styles.avatarText}>{member[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.posterName}>{member.split(" · ")[0]}</Text>
            <Text style={styles.posterMeta}>{member.split(" · ")[1]}</Text>
            <Text style={houseStyles.vouched}>✓ Vouched local</Text>
          </View>
          {icon("chevron-forward", 18, colors.muted)}
        </View>
      ))}
      <Pressable
        style={houseStyles.inviteBanner}
        onPress={() => setScreen("houseadmin")}
      >
        <Text style={styles.posterName}>Know someone?</Text>
        <Text style={styles.posterMeta}>Invite a neighbour to this House.</Text>
      </Pressable>
    </ScrollView>
  );
}

function Verification({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const [reviewing, setReviewing] = useState(false);
  const checklist = [
    ["Phone number", "Verified for secure login", "Complete"],
    ["Email address", "Verified for account recovery", "Complete"],
    [
      "Government ID",
      "Encrypted review by Trust & Safety",
      reviewing ? "Reviewing" : "Start",
    ],
    ["Skill verification", "Get peer endorsements for your skills", "Start"],
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={houseStyles.scroll}
    >
      <View style={styles.detailTop}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("passport")}
        >
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Verification</Text>
        <View style={styles.iconButton} />
      </View>
      <Text style={styles.detailTitle}>Verification center</Text>
      <Text style={styles.formHint}>
        Build maximum trust and unlock exclusive community features.
      </Text>
      <View style={houseStyles.trustScore}>
        <Text style={houseStyles.scoreNumber}>82</Text>
        <View>
          <Text style={styles.posterName}>Trust score</Text>
          <Text style={styles.posterMeta}>12 vouches · Next: Gold badge</Text>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Your checklist</Text>
      {checklist.map(([title, desc, status]) => (
        <Pressable
          key={title}
          style={houseStyles.checkRow}
          onPress={() => title === "Government ID" && setReviewing(true)}
        >
          <View style={houseStyles.routeIcon}>
            {icon(
              status === "Complete" ? "checkmark-circle" : "shield-checkmark",
              21,
              status === "Complete" ? colors.success : colors.primary,
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.posterName}>{title}</Text>
            <Text style={styles.posterMeta}>{desc}</Text>
          </View>
          <Text
            style={[
              houseStyles.statusLabel,
              status === "Complete" && { color: colors.success },
            ]}
          >
            {status}
          </Text>
        </Pressable>
      ))}
      <View style={styles.trustNote}>
        {icon("shield-checkmark", 20, colors.primary)}
        <Text style={styles.trustNoteText}>
          Sensitive documents are encrypted and never shown to other neighbours.
        </Text>
      </View>
    </ScrollView>
  );
}

function SharePassport({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.detailTop}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("passport")}
        >
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Share passport</Text>
        <View style={styles.iconButton} />
      </View>
      <View style={houseStyles.shareCenter}>
        <Text style={styles.detailTitle}>Your Vowch Passport</Text>
        <Text style={[styles.formHint, { textAlign: "center" }]}>
          Scan to verify credentials and view your community trust score.
        </Text>
        <View style={houseStyles.qr}>
          <View style={houseStyles.qrGrid}>
            {Array.from({ length: 36 }).map((_, i) => (
              <View
                key={i}
                style={[
                  houseStyles.qrDot,
                  (i % 3 === 0 || i % 7 === 0) && houseStyles.qrDark,
                ]}
              />
            ))}
          </View>
        </View>
        <Text style={houseStyles.passportId}>VOWCH · VP-2847-AX91</Text>
        <Pressable
          style={[styles.publishButton, { width: "100%" }]}
          onPress={() => setScreen("referrals")}
        >
          <Text style={styles.publishText}>Invite & grow your network</Text>
          {icon("share-outline", 20, "#fff")}
        </Pressable>
        <Text style={houseStyles.resetCopy}>
          Passport resets automatically every 24 hours.
        </Text>
      </View>
    </View>
  );
}

function Referrals({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <View style={styles.screen}>
        <View style={houseStyles.shareCenter}>
          <View style={houseStyles.successMark}>
            {icon("checkmark-circle", 66, colors.primary)}
          </View>
          <Text style={[styles.detailTitle, { textAlign: "center" }]}>
            Invitation sent!
          </Text>
          <Text style={[styles.formHint, { textAlign: "center" }]}>
            Your invite is on its way. When they join, your trusted community
            grows too.
          </Text>
          <Text style={houseStyles.inviteCode}>VOUCH-7829</Text>
          <Pressable
            style={[styles.publishButton, { width: "100%" }]}
            onPress={() => setScreen("passport")}
          >
            <Text style={styles.publishText}>Back to passport</Text>
          </Pressable>
        </View>
      </View>
    );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={houseStyles.scroll}
    >
      <View style={styles.detailTop}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("passport")}
        >
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>My referral tree</Text>
        <View style={styles.iconButton} />
      </View>
      <Text style={styles.detailTitle}>My referral tree</Text>
      <Text style={styles.formHint}>
        See how your trust network is growing.
      </Text>
      <View style={houseStyles.treeRoot}>
        <Text style={houseStyles.rootName}>Aarav Mehta</Text>
        <Text style={styles.posterMeta}>ROOT CONNECTOR</Text>
      </View>
      {["Marcus Chen", "Sarah Williams", "David Kalu"].map((name, i) => (
        <View key={name} style={houseStyles.treeNode}>
          <View style={houseStyles.memberAvatar}>
            <Text style={styles.avatarText}>{name[0]}</Text>
          </View>
          <View>
            <Text style={styles.posterName}>{name}</Text>
            <Text style={styles.posterMeta}>ID: VCH-{99281 - i * 1111}-X</Text>
          </View>
        </View>
      ))}
      <View style={houseStyles.refStats}>
        <View>
          <Text style={houseStyles.statPrimary}>12</Text>
          <Text style={houseStyles.statCaption}>DIRECT REFERRALS</Text>
        </View>
        <View>
          <Text style={houseStyles.statPrimary}>48</Text>
          <Text style={houseStyles.statCaption}>NETWORK REACH</Text>
        </View>
        <View>
          <Text style={houseStyles.statPrimary}>Gold</Text>
          <Text style={houseStyles.statCaption}>TRUST TIER</Text>
        </View>
      </View>
      <Pressable style={styles.publishButton} onPress={() => setSent(true)}>
        <Text style={styles.publishText}>Send an invitation</Text>
        {icon("send-outline", 20, "#fff")}
      </Pressable>
    </ScrollView>
  );
}

function HouseCreate({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState(false);
  if (created)
    return (
      <View style={styles.screen}>
        <View style={houseStyles.shareCenter}>
          <View style={houseStyles.successMark}>
            {icon("checkmark-circle", 66, colors.primary)}
          </View>
          <Text style={[styles.detailTitle, { textAlign: "center" }]}>
            Your House is ready!
          </Text>
          <Text style={[styles.formHint, { textAlign: "center" }]}>
            Invite trusted neighbours and begin building your community.
          </Text>
          <Pressable
            style={[styles.publishButton, { width: "100%" }]}
            onPress={() => setScreen("houseadmin")}
          >
            <Text style={styles.publishText}>Set privacy & invites</Text>
          </Pressable>
        </View>
      </View>
    );
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.detailTop}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("houses")}
        >
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Create a House</Text>
        <View style={styles.iconButton} />
      </View>
      <Text style={styles.detailTitle}>Bring your people together</Text>
      <Text style={styles.formHint}>
        Create a trusted space for neighbours, a building, or a shared interest.
      </Text>
      <Field
        label="House name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. The Green Loft"
      />
      <Field
        label="About your House"
        value=""
        onChangeText={() => {}}
        placeholder="What brings this community together?"
        multiline
      />
      <View style={styles.trustNote}>
        {icon("shield-checkmark", 20, colors.primary)}
        <Text style={styles.trustNoteText}>
          Every House follows Vowch trust and safety rules.
        </Text>
      </View>
      <Pressable style={styles.publishButton} onPress={() => setCreated(true)}>
        <Text style={styles.publishText}>Create House</Text>
        {icon("arrow-forward", 20, "#fff")}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function HouseAdmin({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const [privacy, setPrivacy] = useState("Nearby");
  const [approved, setApproved] = useState(0);
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={houseStyles.scroll}
    >
      <View style={styles.detailTop}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setScreen("housefeed")}
        >
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>House admin</Text>
        <View style={styles.iconButton} />
      </View>
      <Text style={styles.detailTitle}>Privacy & invites</Text>
      <Text style={styles.formHint}>
        Control how people find and join your House.
      </Text>
      {[
        ["Private", "Join by direct invite only"],
        ["Nearby", "Verified users within 5 miles"],
        ["Open", "Anyone on Vowch can request access"],
      ].map(([title, desc]) => (
        <Pressable
          key={title}
          style={[
            houseStyles.privacy,
            privacy === title && houseStyles.privacyOn,
          ]}
          onPress={() => setPrivacy(title)}
        >
          <View
            style={[
              houseStyles.radio,
              privacy === title && houseStyles.radioOn,
            ]}
          />
          <View>
            <Text style={styles.posterName}>{title}</Text>
            <Text style={styles.posterMeta}>{desc}</Text>
          </View>
        </Pressable>
      ))}
      <Text style={styles.sectionTitle}>Invite link</Text>
      <View style={houseStyles.inviteLink}>
        <Text style={styles.posterMeta}>vowch.app/h/the-green-loft</Text>
        <Text style={houseStyles.joinText}>Copy</Text>
      </View>
      <Text style={styles.sectionTitle}>Join requests</Text>
      {["Nina Patel", "Jordan Blake", "Omar Reyes"]
        .slice(0, 3 - approved)
        .map((name) => (
          <View key={name} style={houseStyles.member}>
            <View style={houseStyles.memberAvatar}>
              <Text style={styles.avatarText}>{name[0]}</Text>
            </View>
            <Text style={[styles.posterName, { flex: 1 }]}>{name}</Text>
            <Pressable onPress={() => setApproved((x) => x + 1)}>
              <Text style={houseStyles.joinText}>Approve</Text>
            </Pressable>
          </View>
        ))}
    </ScrollView>
  );
}

function VowchAppFlow5() {
  const [screen, setScreen] = useState<Screen>("home");
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  useEffect(() => {
    api
      .gigs()
      .then(setGigs)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!onboarded || screen === "home") return false;
      if (screen === "chat") {
        setScreen("inbox");
        return true;
      }
      if (screen === "apply") {
        setScreen("gig");
        return true;
      }
      if (screen === "tracking") {
        setScreen("dashboard");
        return true;
      }
      if (["wallet", "safety", "profile"].includes(screen)) {
        setScreen("settings");
        return true;
      }
      setScreen("home");
      return true;
    });
    return () => sub.remove();
  }, [onboarded, screen]);
  const openGig = (gig: Gig) => {
    setSelectedGig(gig);
    setScreen("gig");
  };
  const content = useMemo(() => {
    if (screen === "home")
      return gigs.length ? (
        <Home gigs={gigs} setScreen={setScreen} openGig={openGig} />
      ) : (
        <EmptyHome setScreen={setScreen} />
      );
    if (screen === "explore") return <Explore gigs={gigs} openGig={openGig} />;
    if (screen === "create")
      return (
        <Create
          onBack={() => setScreen("home")}
          onCreated={(gig) => setGigs((old) => [gig, ...old])}
          onViewPost={(gig) => {
            setSelectedGig(gig);
            setScreen("gig");
          }}
        />
      );
    if (screen === "gig" && selectedGig)
      return (
        <GigDetailNew
          gig={selectedGig}
          onBack={() => setScreen("home")}
          onApply={() => setScreen("apply")}
        />
      );
    if (screen === "apply" && selectedGig)
      return (
        <ApplyForGig
          gig={selectedGig}
          onBack={() => setScreen("gig")}
          onSent={() => setScreen("dashboard")}
        />
      );
    if (screen === "dashboard")
      return (
        <GigDashboard
          onBack={() => setScreen("home")}
          onTrack={() => setScreen("tracking")}
          openGig={openGig}
          gigs={gigs}
        />
      );
    if (screen === "tracking")
      return <JobTracking onBack={() => setScreen("dashboard")} />;
    if (screen === "inbox")
      return <InboxNew openChat={() => setScreen("chat")} />;
    if (screen === "chat")
      return (
        <ChatNew
          onBack={() => setScreen("inbox")}
          onTrack={() => setScreen("tracking")}
        />
      );
    if (screen === "notifications") return <NotificationsNew />;
    if (screen === "passport" || screen === "settings")
      return <SettingsNew setScreen={setScreen} />;
    if (screen === "profile") return <ProfileNew />;
    if (screen === "wallet")
      return <WalletNew onBack={() => setScreen("settings")} />;
    if (screen === "safety")
      return <SafetyNew onBack={() => setScreen("settings")} />;
    return <House />;
  }, [screen, gigs, selectedGig]);
  if (!onboarded)
    return (
      <View style={styles.app}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <Onboarding onComplete={() => setOnboarded(true)} />
      </View>
    );
  return (
    <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScreenMotion screen={screen}>{content}</ScreenMotion>
      {![
        "create",
        "gig",
        "apply",
        "dashboard",
        "tracking",
        "chat",
        "notifications",
        "profile",
        "settings",
        "wallet",
        "safety",
        "house",
      ].includes(screen) && <Nav active={screen} setScreen={setScreen} />}
    </SafeAreaView>
  );
}

function EmptyHome({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <View style={styles.screen}>
      <Header title="Vowch" subtitle="YOUR LOCAL COMMUNITY" />
      <View style={packStyles.emptyHome}>
        <View style={packStyles.neighbourhood}>
          <Text style={{ fontSize: 58 }}>🏡</Text>
          <Text style={packStyles.communityBadge}>✦ Community</Text>
        </View>
        <Text
          style={[styles.detailTitle, { textAlign: "center", marginTop: 36 }]}
        >
          Nothing here yet
        </Text>
        <Text
          style={[
            styles.formHint,
            {
              textAlign: "center",
              fontSize: 18,
              lineHeight: 27,
              maxWidth: 300,
            },
          ]}
        >
          It looks like your feed is a bit quiet. Why not start a conversation
          or share something local?
        </Text>
        <Pressable
          style={[styles.publishButton, { width: "100%", marginTop: 34 }]}
          onPress={() => setScreen("create")}
        >
          {icon("add-circle", 22, "#fff")}
          <Text style={styles.publishText}>Create your first post</Text>
        </Pressable>
        <Pressable onPress={() => setScreen("explore")}>
          <Text style={packStyles.exploreLink}>Explore the neighborhood</Text>
        </Pressable>
        <View style={styles.trustNote}>
          {icon("people-outline", 20, colors.primary)}
          <Text style={styles.trustNoteText}>
            Join 1,200 neighbours sharing local help today.
          </Text>
        </View>
      </View>
    </View>
  );
}

function WalletNew({ onBack }: { onBack: () => void }) {
  const [withdraw, setWithdraw] = useState(false);
  const rows = [
    ["Project completion: UI design", "+$1,200.00", "Paid"],
    ["Bank withdrawal", "-$500.00", "Withdrawn"],
    ["Security deposit: Local gig", "+$350.00", "Pending"],
    ["Referral bonus: Vowch Pro", "+$50.00", "Paid"],
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={packStyles.wallet}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.detailTop}>
        <Pressable style={styles.iconButton} onPress={onBack}>
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Wallet</Text>
        <View style={styles.iconButton} />
      </View>
      <LinearGradient
        colors={["#C6002A", "#F22D4C"]}
        style={packStyles.balance}
      >
        <Text style={packStyles.balanceLabel}>AVAILABLE BALANCE</Text>
        <Text style={packStyles.balanceValue}>
          $2,450.80 <Text style={packStyles.usd}>USD</Text>
        </Text>
        <Pressable
          style={packStyles.withdraw}
          onPress={() => setWithdraw(true)}
        >
          <Text style={packStyles.withdrawText}>
            {withdraw ? "Withdrawal started" : "Withdraw funds"} →
          </Text>
        </Pressable>
        <Pressable
          style={packStyles.topUp}
          onPress={() =>
            Alert.alert(
              "Top up",
              "Card top-ups will be available when your Vowch payment account is connected.",
            )
          }
        >
          <Text style={packStyles.topUpText}>＋ Top up</Text>
        </Pressable>
      </LinearGradient>
      {withdraw && (
        <View style={packStyles.withdrawNotice}>
          {icon("checkmark-circle", 20, colors.success)}
          <Text style={packStyles.withdrawTextDark}>
            Your $500 withdrawal is on its way.
          </Text>
        </View>
      )}
      <View style={packStyles.sectionHead}>
        <Text style={styles.sectionTitle}>Wallets & cards</Text>
        <Text style={packStyles.plus}>＋</Text>
      </View>
      <View style={packStyles.paymentCard}>
        {icon("card-outline", 25, colors.primary)}
        <View style={{ flex: 1 }}>
          <Text style={styles.posterName}>•••• •••• •••• 4242</Text>
          <Text style={styles.posterMeta}>Primary · expires 12/26</Text>
        </View>
      </View>
      <View style={packStyles.paymentCard}>
        {icon("landmark-outline", 25, colors.primary)}
        <View>
          <Text style={styles.posterName}>Chase Checking</Text>
          <Text style={styles.posterMeta}>Bank account •••• 8810</Text>
        </View>
      </View>
      <Pressable
        style={packStyles.addPayment}
        onPress={() =>
          Alert.alert(
            "Add payment method",
            "Payment methods are verified securely before they can be used for escrow.",
          )
        }
      >
        <Text style={styles.posterName}>＋ Add payment method</Text>
      </Pressable>
      <View style={packStyles.sectionHead}>
        <Text style={styles.sectionTitle}>Transaction history</Text>
        <Text style={flowStyles.time}>Filters</Text>
      </View>
      <View style={packStyles.transactions}>
        {rows.map(([title, amount, status]) => (
          <View key={title} style={packStyles.transaction}>
            <View style={{ flex: 1 }}>
              <Text style={styles.posterName}>{title}</Text>
              <Text style={styles.posterMeta}>May 24, 2026 · Vowch escrow</Text>
            </View>
            <View>
              <Text style={packStyles.amount}>{amount}</Text>
              <Text
                style={[
                  packStyles.transactionStatus,
                  status === "Paid" && { color: colors.success },
                ]}
              >
                {status}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.trustNote}>
        {icon("shield-checkmark", 20, colors.primary)}
        <Text style={styles.trustNoteText}>
          Secure Vowch escrow: funds are released only after the work is
          verified.
        </Text>
      </View>
    </ScrollView>
  );
}

function SafetyNew({ onBack }: { onBack: () => void }) {
  const tips = [
    [
      "Meet in public places",
      "Choose well-lit, busy public areas for meetings.",
    ],
    [
      "Verify profiles",
      "Check verification badges and local vouch counts before meeting.",
    ],
    [
      "Secure payments",
      "Keep transactions within Vowch so your payment is protected.",
    ],
    [
      "Trust your intuition",
      "If something feels off, never feel pressured to continue.",
    ],
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={packStyles.safety}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.detailTop}>
        <Pressable style={styles.iconButton} onPress={onBack}>
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Safety</Text>
        <View style={styles.iconButton} />
      </View>
      <Pill tone="red">SAFETY FIRST</Pill>
      <Text style={packStyles.safetyTitle}>
        Your safety is our{" "}
        <Text style={{ color: colors.primary }}>priority</Text>
      </Text>
      <Text style={styles.formHint}>
        Vowch is built on trust. Here’s how we keep our neighbourhood safe,
        vibrant, and helpful for everyone.
      </Text>
      {tips.map(([title, body], i) => (
        <View key={title} style={packStyles.safetyCard}>
          <View style={packStyles.safetyIcon}>
            {icon(
              i === 1
                ? "shield-checkmark"
                : i === 2
                  ? "wallet-outline"
                  : "people-outline",
              21,
              colors.primary,
            )}
          </View>
          <Text style={styles.gigTitle}>{title}</Text>
          <Text style={styles.formHint}>{body}</Text>
        </View>
      ))}
      <View style={packStyles.report}>
        <Text style={packStyles.reportTitle}>Notice something suspicious?</Text>
        <Text style={{ color: "#E8E6F6", fontFamily: "Baloo2_500Medium" }}>
          Our team is available 24/7 to resolve community issues.
        </Text>
        <Pressable
          style={packStyles.reportButton}
          onPress={() =>
            Alert.alert(
              "Report received",
              "Thank you. A Vowch safety specialist will review this report. If anyone is in immediate danger, contact local emergency services.",
            )
          }
        >
          <Text style={styles.publishText}>Report a concern</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionTitle}>Quick safety checklist</Text>
      {[
        "Share your plans",
        "Ask questions first",
        "Verify identity",
        "Stay on platform",
      ].map((x) => (
        <View key={x} style={packStyles.checklist}>
          {icon("checkmark", 16, colors.primary)}
          <Text style={styles.posterName}>{x}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function SettingsNew({
  setScreen,
  onLogout = () => {},
}: {
  setScreen: (screen: Screen) => void;
  onLogout?: () => void;
}) {
  const sections = [
    ["Profile information", "Elena Rodriguez · @elena_vowch", "profile"],
    ["Phone number", "+1 (555) 012-3456", "none"],
    ["Email address", "elena@vowch.community", "none"],
    ["Notifications", "Alerts, Vowch requests, messages", "notifications"],
    ["Privacy & safety", "Control visibility and trust score", "safety"],
    ["Payments & payouts", "Wallets, cards, and earnings", "wallet"],
    ["Language", "English (US)", "none"],
    ["Help & support", "Answers and contact options", "none"],
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={packStyles.settings}
      showsVerticalScrollIndicator={false}
    >
      <Header title="Settings" subtitle="ACCOUNT & PREFERENCES" />
      <Text style={styles.detailTitle}>Settings</Text>
      <Text style={styles.formHint}>
        Manage your community trust and account preferences.
      </Text>
      {["ACCOUNT", "PREFERENCES", "SUPPORT"].map((heading, group) => (
        <View key={heading}>
          <Text style={packStyles.settingsHeading}>{heading}</Text>
          <View style={packStyles.settingsCard}>
            {sections
              .slice(
                group === 0 ? 0 : group === 1 ? 3 : 6,
                group === 0 ? 3 : group === 1 ? 6 : 8,
              )
              .map(([title, subtitle, target]) => (
                <Pressable
                  key={title}
                  onPress={() => {
                    if (target === "profile") return setScreen("profile");
                    if (target === "safety") return setScreen("safety");
                    if (target === "wallet") return setScreen("wallet");
                    if (target === "notifications")
                      return setScreen("notifications");
                    Alert.alert(
                      title,
                      `${title} preferences will be available when your Vowch account is connected.`,
                    );
                  }}
                  style={packStyles.settingItem}
                >
                  <View style={packStyles.settingIcon}>
                    {icon(
                      target === "wallet"
                        ? "wallet-outline"
                        : target === "safety"
                          ? "shield-checkmark"
                          : target === "notifications"
                            ? "notifications-outline"
                            : "person-outline",
                      20,
                      colors.primary,
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.posterName}>{title}</Text>
                    <Text style={styles.posterMeta}>{subtitle}</Text>
                  </View>
                  {target !== "none" &&
                    icon("chevron-forward", 18, colors.muted)}
                </Pressable>
              ))}
          </View>
        </View>
      ))}
      <Pressable
        style={[
          styles.publishButton,
          { marginTop: 26, backgroundColor: "#C90029" },
        ]}
        onPress={() =>
          Alert.alert(
            "Log out of Vowch?",
            "You can sign back in at any time.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Log out", style: "destructive", onPress: onLogout },
            ],
          )
        }
      >
        <Text style={styles.publishText}>⇥ Logout</Text>
      </Pressable>
      <Text style={packStyles.version}>
        Vowch Version 0.1.0 · Made for Community
      </Text>
    </ScrollView>
  );
}

function VowchAppFlow4() {
  const [screen, setScreen] = useState<Screen>("home");
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  useEffect(() => {
    api
      .gigs()
      .then(setGigs)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!onboarded || screen === "home") return false;
      if (screen === "chat") {
        setScreen("inbox");
        return true;
      }
      if (screen === "apply") {
        setScreen("gig");
        return true;
      }
      if (screen === "tracking") {
        setScreen("dashboard");
        return true;
      }
      setScreen("home");
      return true;
    });
    return () => sub.remove();
  }, [onboarded, screen]);
  const openGig = (gig: Gig) => {
    setSelectedGig(gig);
    setScreen("gig");
  };
  const content = useMemo(() => {
    if (screen === "home")
      return <Home gigs={gigs} setScreen={setScreen} openGig={openGig} />;
    if (screen === "explore") return <Explore gigs={gigs} openGig={openGig} />;
    if (screen === "create")
      return (
        <Create
          onBack={() => setScreen("home")}
          onCreated={(gig) => setGigs((old) => [gig, ...old])}
          onViewPost={(gig) => {
            setSelectedGig(gig);
            setScreen("gig");
          }}
        />
      );
    if (screen === "gig" && selectedGig)
      return (
        <GigDetailNew
          gig={selectedGig}
          onBack={() => setScreen("home")}
          onApply={() => setScreen("apply")}
        />
      );
    if (screen === "apply" && selectedGig)
      return (
        <ApplyForGig
          gig={selectedGig}
          onBack={() => setScreen("gig")}
          onSent={() => setScreen("dashboard")}
        />
      );
    if (screen === "dashboard")
      return (
        <GigDashboard
          onBack={() => setScreen("home")}
          onTrack={() => setScreen("tracking")}
          openGig={openGig}
          gigs={gigs}
        />
      );
    if (screen === "tracking")
      return <JobTracking onBack={() => setScreen("dashboard")} />;
    if (screen === "inbox")
      return <InboxNew openChat={() => setScreen("chat")} />;
    if (screen === "chat")
      return (
        <ChatNew
          onBack={() => setScreen("inbox")}
          onTrack={() => setScreen("tracking")}
        />
      );
    if (screen === "notifications") return <NotificationsNew />;
    if (screen === "passport" || screen === "profile") return <ProfileNew />;
    return <House />;
  }, [screen, gigs, selectedGig]);
  if (!onboarded)
    return (
      <View style={styles.app}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <Onboarding onComplete={() => setOnboarded(true)} />
      </View>
    );
  return (
    <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScreenMotion screen={screen}>{content}</ScreenMotion>
      {![
        "create",
        "gig",
        "apply",
        "dashboard",
        "tracking",
        "chat",
        "notifications",
        "profile",
        "house",
      ].includes(screen) && <Nav active={screen} setScreen={setScreen} />}
    </SafeAreaView>
  );
}

function InboxNew({ openChat }: { openChat: () => void }) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const chats = [
    [
      "Sarah Jenkins",
      "Dog walker needed",
      "Hey! I saw your post and I’m available this Tuesday to help out with Cooper.",
      "2m ago",
      "New request",
    ],
    [
      "Marcus Chen",
      "Fence repair",
      "That sounds great. I’ll bring the extra brackets just in case.",
      "1h ago",
      "In progress",
    ],
    [
      "Aisha Bello",
      "Math tutor",
      "You’ve been vouched! Looking forward to our session.",
      "Yesterday",
      "Accepted",
    ],
    [
      "Leo Rodriguez",
      "Grocery delivery",
      "Thanks for the quick help today, Leo!",
      "Tuesday",
      "Completed",
    ],
  ];
  return (
    <View style={styles.screen}>
      <Header title="Messages" subtitle="VOWCH MESSAGES" />
      <View style={flowStyles.searchBox}>
        {icon("search-outline", 21, colors.muted)}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations..."
          placeholderTextColor={colors.muted}
          style={[
            flowStyles.composerInput,
            {
              backgroundColor: "transparent",
              height: 48,
              paddingHorizontal: 0,
            },
          ]}
        />
      </View>
      <View style={flowStyles.tabs}>
        {["All", "Requests", "Gigs"].map((x) => (
          <Pressable
            key={x}
            onPress={() => setFilter(x)}
            style={[flowStyles.tab, filter === x && flowStyles.tabOn]}
          >
            <Text
              style={[flowStyles.tabText, filter === x && flowStyles.tabTextOn]}
            >
              {x}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={flowStyles.list}
      >
        {chats
          .filter(
            ([name, job, preview, , status]) =>
              (filter === "All" ||
                (filter === "Requests"
                  ? status === "New request"
                  : status !== "New request")) &&
              `${name} ${job} ${preview}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          )
          .map(([name, job, preview, time, status], i) => (
            <Pressable
              key={name}
              onPress={openChat}
              style={flowStyles.chatCard}
            >
              <View style={flowStyles.chatAvatar}>
                <Text style={styles.avatarText}>{name[0]}</Text>
                {i === 0 && <View style={flowStyles.unreadDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={flowStyles.chatHead}>
                  <Text style={styles.posterName}>{name}</Text>
                  <Text style={flowStyles.time}>{time}</Text>
                </View>
                <Text style={flowStyles.jobLabel}>{job.toUpperCase()}</Text>
                <Text style={flowStyles.preview} numberOfLines={1}>
                  {preview}
                </Text>
                <View
                  style={[
                    flowStyles.statusChip,
                    status === "New request" && flowStyles.statusNew,
                  ]}
                >
                  <Text
                    style={[
                      flowStyles.statusText,
                      status === "New request" && flowStyles.statusTextNew,
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
      </ScrollView>
    </View>
  );
}

function ChatNew({
  onBack,
  onTrack,
}: {
  onBack: () => void;
  onTrack: () => void;
}) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const send = () => {
    if (message.trim()) {
      setMessages((old) => [...old, message.trim()]);
      setMessage("");
    }
  };
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={flowStyles.chatTop}>
        <Pressable style={styles.iconButton} onPress={onBack}>
          {icon("arrow-back")}
        </Pressable>
        <View style={flowStyles.smallAvatar}>
          <Text style={styles.avatarText}>M</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.posterName}>Marcus Rivera</Text>
          <Text style={styles.posterMeta}>Vouched by 14 locals</Text>
        </View>
        <Pressable
          style={styles.iconButton}
          onPress={() =>
            Alert.alert(
              "Conversation options",
              "You can report this conversation from Vowch Safety if something feels wrong.",
            )
          }
        >
          {icon("options-outline")}
        </Pressable>
      </View>
      <View style={flowStyles.jobBar}>
        <View>
          <Text style={flowStyles.jobLabel}>JOB TITLE</Text>
          <Text style={styles.posterName}>Lawn maintenance</Text>
        </View>
        <View style={flowStyles.pricePill}>
          <Text style={flowStyles.pricePillText}>Agreed price: $45.00</Text>
        </View>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={flowStyles.conversation}
      >
        <View style={flowStyles.safety}>
          {icon("shield-checkmark", 22, colors.primary)}
          <Text style={flowStyles.safetyText}>
            <Text style={{ fontFamily: "Baloo2_800ExtraBold" }}>
              Safety tip:{" "}
            </Text>
            Keep payments in Vowch so you’re covered by our community guarantee.
          </Text>
        </View>
        <Text style={flowStyles.messageTime}>10:47 AM</Text>
        <View style={[flowStyles.bubble, flowStyles.bubbleMine]}>
          <Text style={flowStyles.bubbleMineText}>
            Friday works great! Does 2 PM work? The backyard is a bit overgrown,
            just so you’re aware.
          </Text>
        </View>
        <View style={[flowStyles.bubble, flowStyles.bubbleOther]}>
          <Text style={flowStyles.bubbleOtherText}>
            2 PM is perfect. No problem about the overgrowth. I’ve got a
            heavy-duty mower. $45 covers the whole property.
          </Text>
        </View>
        <View style={[flowStyles.bubble, flowStyles.bubbleMine]}>
          <Text style={flowStyles.bubbleMineText}>
            Perfect. I’ve accepted the quote and the funds are held in Vowch.
            See you then!
          </Text>
        </View>
        {messages.map((item, index) => (
          <View key={index} style={[flowStyles.bubble, flowStyles.bubbleMine]}>
            <Text style={flowStyles.bubbleMineText}>{item}</Text>
          </View>
        ))}
        <View style={flowStyles.booking}>
          <View style={flowStyles.bookingIcon}>
            {icon("shield-checkmark", 28, colors.primary)}
          </View>
          <Text style={flowStyles.bookingTitle}>Booking confirmed</Text>
          <Text style={styles.formHint}>
            Payment of $45.00 is secured in Vowch Escrow
          </Text>
          <Pressable style={flowStyles.receipt} onPress={onTrack}>
            <Text style={flowStyles.receiptText}>Track this job</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={flowStyles.composer}>
        <Pressable
          style={flowStyles.addButton}
          onPress={() =>
            Alert.alert(
              "Add attachment",
              "File attachments will be securely scanned before they are shared.",
            )
          }
        >
          {icon("add-circle", 22, colors.primary)}
        </Pressable>
        <TextInput
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={send}
          placeholder="Type a message..."
          placeholderTextColor="#9B96A1"
          style={flowStyles.composerInput}
        />
        <Pressable onPress={send} style={flowStyles.sendButton}>
          {icon("send-outline", 22, "#fff")}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function NotificationsNew({
  onOpenChat = () => {},
}: {
  onOpenChat?: () => void;
}) {
  const [filter, setFilter] = useState("All");
  const entries = [
    [
      "New response to your post",
      "“Sarah Miller replied to your request for Lawn Mowing in Westside...”",
      "message-circle",
    ],
    [
      "Your application was viewed",
      "The homeowner for Backyard Landscaping has reviewed your profile.",
      "search-outline",
    ],
    [
      "Job completed",
      "Payment for Pet Sitting has been processed and your status is updated.",
      "checkmark-circle",
    ],
    [
      "New review received",
      "★★★★★  “Excellent work! David was punctual and very professional. Highly recommend.”",
      "star",
    ],
    [
      "Account verified",
      "Welcome to the neighborhood! Your identity has been successfully verified.",
      "shield-checkmark",
    ],
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={flowStyles.activity}
      showsVerticalScrollIndicator={false}
    >
      <Header title="Activity" subtitle="YOUR VOWCH UPDATES" />
      <Text style={styles.detailTitle}>Activity</Text>
      <Text style={styles.formHint}>
        Keep track of your latest updates and responses.
      </Text>
      <View style={flowStyles.tabs}>
        {["All", "Jobs", "Vouches", "System"].map((x) => (
          <Pressable
            key={x}
            onPress={() => setFilter(x)}
            style={[flowStyles.tab, filter === x && flowStyles.tabOn]}
          >
            <Text
              style={[flowStyles.tabText, filter === x && flowStyles.tabTextOn]}
            >
              {x}
            </Text>
          </Pressable>
        ))}
      </View>
      {entries
        .filter(
          (entry, index) =>
            filter === "All" ||
            (filter === "Jobs"
              ? index < 3
              : filter === "Vouches"
                ? index === 3
                : index === 4),
        )
        .map((entry, index) => (
          <View key={entry[0]}>
            {(index === 0 || index === 2 || index === 4) && (
              <Text style={flowStyles.dayLabel}>
                {index === 0 ? "TODAY" : index === 2 ? "YESTERDAY" : "OLDER"}
              </Text>
            )}
            <Pressable style={flowStyles.activityCard} onPress={onOpenChat}>
              <View style={flowStyles.activityIcon}>
                {icon(entry[2], 23, index === 3 ? "#F6AC00" : colors.primary)}
              </View>
              <View style={{ flex: 1 }}>
                <View style={flowStyles.chatHead}>
                  <Text style={styles.posterName}>{entry[0]}</Text>
                  <Text style={flowStyles.time}>
                    {index < 2
                      ? `${index + 1}h ago`
                      : index < 4
                        ? "Yesterday"
                        : "4 days ago"}
                  </Text>
                </View>
                <Text style={flowStyles.activityCopy}>{entry[1]}</Text>
              </View>
              {index < 2 && <View style={flowStyles.unreadDot} />}
            </Pressable>
          </View>
        ))}
    </ScrollView>
  );
}

function ProfileNew({ onEdit = () => {} }: { onEdit?: () => void }) {
  const [tab, setTab] = useState("Reviews");
  const [profile, setProfile] = useState({
    displayName: "Elena Rodriguez",
    location: "Silver Lake, Los Angeles",
    avatarUrl: "",
  });
  useEffect(() => {
    if (!api.configured) return;
    api
      .profile()
      .then((member) =>
        setProfile((current) => ({
          displayName: member.displayName || current.displayName,
          location: member.location || current.location,
          avatarUrl: member.avatarUrl || "",
        })),
      )
      .catch(() => {});
  }, []);
  const reviews = [
    [
      "Mark Stevenson",
      "2 days ago",
      "Elena helped me with dog walking while I was away for the weekend. She’s incredibly reliable and sent updates every day. My dog clearly loved her. Highly recommend her services!",
    ],
    [
      "Sarah Chen",
      "1 week ago",
      "Great experience! Elena was very professional and punctual. She has a real talent for gardening and left my backyard looking amazing.",
    ],
  ];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={flowStyles.profile}
      showsVerticalScrollIndicator={false}
    >
      <Header title="Vowch" subtitle="YOUR COMMUNITY PROFILE" />
      <View style={flowStyles.profileCard}>
        <View style={flowStyles.profileAvatar}>
          {profile.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <Text style={[styles.avatarText, { fontSize: 30 }]}>
              {profile.displayName.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={flowStyles.profileName}>{profile.displayName}</Text>
        <Text style={styles.posterMeta}>⌖ {profile.location}</Text>
        <Pressable
          style={[styles.publishButton, { marginVertical: 18 }]}
          onPress={onEdit}
        >
          <Text style={styles.publishText}>Edit profile</Text>
        </Pressable>
        <View style={flowStyles.verifications}>
          {["Phone verified", "Email verified", "ID verified"].map((x) => (
            <View key={x} style={flowStyles.verify}>
              <Text style={flowStyles.verifyText}>✓ {x}</Text>
            </View>
          ))}
        </View>
        <View style={flowStyles.statsRow}>
          <View>
            <Text style={flowStyles.statPrimary}>4.9 ★</Text>
            <Text style={flowStyles.statCaption}>RATING</Text>
          </View>
          <View>
            <Text style={[flowStyles.statPrimary, { color: colors.primary }]}>
              12
            </Text>
            <Text style={flowStyles.statCaption}>VOUCHES</Text>
          </View>
          <View>
            <Text style={flowStyles.statPrimary}>98%</Text>
            <Text style={flowStyles.statCaption}>RELIABILITY</Text>
          </View>
        </View>
      </View>
      <View style={flowStyles.profileTabs}>
        {["Reviews", "Services", "Posts"].map((x) => (
          <Pressable
            key={x}
            onPress={() => setTab(x)}
            style={[
              flowStyles.profileTab,
              tab === x && flowStyles.profileTabOn,
            ]}
          >
            <Text
              style={[
                flowStyles.profileTabText,
                tab === x && flowStyles.profileTabTextOn,
              ]}
            >
              {x}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === "Reviews" ? (
        <>
          <Text style={styles.detailTitle}>Community feedback</Text>
          {reviews.map(([name, time, copy]) => (
            <View key={name} style={flowStyles.review}>
              <View style={flowStyles.chatHead}>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <View style={flowStyles.smallAvatar}>
                    <Text style={styles.avatarText}>{name[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.posterName}>{name}</Text>
                    <Text style={flowStyles.time}>{time}</Text>
                  </View>
                </View>
                <Text style={{ color: "#F6AC00", fontSize: 17 }}>★★★★★</Text>
              </View>
              <Text style={flowStyles.reviewCopy}>“{copy}”</Text>
              <Pill tone="red">VOUCHED</Pill>
            </View>
          ))}
        </>
      ) : (
        <View style={flowStyles.empty}>
          <Text style={styles.gigTitle}>
            {tab === "Services" ? "Available services" : "Latest posts"}
          </Text>
          <Text style={styles.formHint}>
            This is where Elena’s community work will appear.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function VowchAppFlow() {
  const [screen, setScreen] = useState<Screen>("home");
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  useEffect(() => {
    api
      .gigs()
      .then(setGigs)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!onboarded || screen === "home") return false;
        if (screen === "apply") {
          setScreen("gig");
          return true;
        }
        if (screen === "tracking") {
          setScreen("dashboard");
          return true;
        }
        setScreen("home");
        return true;
      },
    );
    return () => subscription.remove();
  }, [onboarded, screen]);
  const openGig = (gig: Gig) => {
    setSelectedGig(gig);
    setScreen("gig");
  };
  const content = useMemo(() => {
    if (screen === "home")
      return <Home gigs={gigs} setScreen={setScreen} openGig={openGig} />;
    if (screen === "explore") return <Explore gigs={gigs} openGig={openGig} />;
    if (screen === "create")
      return (
        <Create
          onBack={() => setScreen("home")}
          onCreated={(gig) => setGigs((old) => [gig, ...old])}
          onViewPost={(gig) => {
            setSelectedGig(gig);
            setScreen("gig");
          }}
        />
      );
    if (screen === "gig" && selectedGig)
      return (
        <GigDetailNew
          gig={selectedGig}
          onBack={() => setScreen("home")}
          onApply={() => setScreen("apply")}
        />
      );
    if (screen === "apply" && selectedGig)
      return (
        <ApplyForGig
          gig={selectedGig}
          onBack={() => setScreen("gig")}
          onSent={() => setScreen("dashboard")}
        />
      );
    if (screen === "dashboard")
      return (
        <GigDashboard
          onBack={() => setScreen("home")}
          onTrack={() => setScreen("tracking")}
          openGig={openGig}
          gigs={gigs}
        />
      );
    if (screen === "tracking")
      return <JobTracking onBack={() => setScreen("dashboard")} />;
    if (screen === "inbox") return <Inbox />;
    if (screen === "passport") return <Passport setScreen={setScreen} />;
    if (screen === "notifications") return <Notifications />;
    if (screen === "profile") return <Profile />;
    return <House />;
  }, [screen, gigs, selectedGig]);
  if (!onboarded)
    return (
      <View style={styles.app}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <Onboarding onComplete={() => setOnboarded(true)} />
      </View>
    );
  return (
    <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScreenMotion screen={screen}>{content}</ScreenMotion>
      {![
        "create",
        "gig",
        "apply",
        "dashboard",
        "tracking",
        "notifications",
        "profile",
        "house",
      ].includes(screen) && <Nav active={screen} setScreen={setScreen} />}
    </SafeAreaView>
  );
}

function GigDetailNew({
  gig,
  onBack,
  onApply,
  onManage,
}: {
  gig: Gig;
  onBack: () => void;
  onApply: () => void;
  onManage?: () => void;
}) {
  const own = gig.poster === "You";
  const [saved, setSaved] = useState(false);
  return (
    <View style={styles.screen}>
      <View style={styles.detailTop}>
        <Pressable style={styles.iconButton} onPress={onBack}>
          {icon("arrow-back")}
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => setSaved((value) => !value)}
          accessibilityLabel={saved ? "Remove saved gig" : "Save gig"}
        >
          {icon("bookmark-outline", 21, saved ? colors.primary : colors.ink)}
        </Pressable>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Pill tone="red">{gig.skill.toUpperCase()}</Pill>
        <Text style={styles.detailTitle}>{gig.title}</Text>
        <Text style={styles.detailPrice}>
          {money(gig.budgetPaise)}{" "}
          <Text style={styles.detailPriceSmall}>fixed budget</Text>
        </Text>
        <View style={styles.posterCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{gig.poster?.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.posterName}>{gig.poster}</Text>
            <Text style={styles.posterMeta}>
              Verified neighbour · {gig.vowches} vowches
            </Text>
          </View>
          {icon("chevron-forward", 18, colors.muted)}
        </View>
        <Text style={styles.detailDescription}>{gig.description}</Text>
        <View style={styles.infoRow}>
          {icon("location-outline", 19, colors.primary)}
          <View>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{gig.area ?? "Remote"}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          {icon("time-outline", 19, colors.primary)}
          <View>
            <Text style={styles.infoLabel}>Posted</Text>
            <Text style={styles.infoValue}>{gig.postedAt}</Text>
          </View>
        </View>
        <View style={styles.protection}>
          <Text style={styles.protectionTitle}>Vowch protection</Text>
          <Text style={styles.protectionText}>
            Confirm the scope together. Payment is released only after you
            approve delivery.
          </Text>
        </View>
      </ScrollView>
      <Pressable
        style={styles.publishButton}
        onPress={own ? (onManage ?? onBack) : onApply}
      >
        <Text style={styles.publishText}>
          {own ? "Manage request" : "Apply for this gig"}
        </Text>
        {icon(own ? "briefcase-outline" : "arrow-forward", 20, "#fff")}
      </Pressable>
    </View>
  );
}

function RequestManager({
  gig,
  onBack,
  onChat,
  onTrack,
}: {
  gig: Gig;
  onBack: () => void;
  onChat: () => void;
  onTrack: () => void;
}) {
  const [selected, setSelected] = useState("Sarah Chen");
  const [accepted, setAccepted] = useState(false);
  const applicants = [
    {
      name: "Sarah Chen",
      detail: "4.9 · 32 completed tasks",
      proposal:
        "I can help this afternoon and bring a moving blanket for protection.",
      rate: money(gig.budgetPaise),
    },
    {
      name: "Jordan Lee",
      detail: "4.8 · 18 completed tasks",
      proposal:
        "Available after 5 PM. I have experience with similar local jobs.",
      rate: money(gig.budgetPaise),
    },
  ];
  const accept = () =>
    Alert.alert(
      "Confirm Sarah for this request?",
      "Once confirmed, you can coordinate privately in chat. Payment stays protected until you approve completion.",
      [
        { text: "Not yet", style: "cancel" },
        { text: "Confirm helper", onPress: () => setAccepted(true) },
      ],
    );
  return (
    <View style={styles.screen}>
      <View style={styles.detailTop}>
        <Pressable style={styles.iconButton} onPress={onBack}>
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Manage request</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Pill tone={accepted ? "soft" : "red"}>
          {accepted ? "HELPER CONFIRMED" : "LIVE · 3 APPLICATIONS"}
        </Pill>
        <Text style={styles.detailTitle}>{gig.title}</Text>
        <Text style={styles.formHint}>
          {accepted
            ? "Sarah is confirmed. Keep all task details and updates in Vowch."
            : "Review applicants, compare their proposals, then choose one trusted helper."}
        </Text>
        {accepted ? (
          <View style={[styles.posterCard, { marginTop: 24 }]}>
            <View style={[styles.avatar, { backgroundColor: "#FFE2E6" }]}>
              <Text style={styles.avatarText}>S</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.posterName}>Sarah Chen</Text>
              <Text style={styles.posterMeta}>
                Confirmed helper · Ready to coordinate
              </Text>
            </View>
            {icon("checkmark-circle", 22, colors.success)}
          </View>
        ) : (
          <>
            <View style={styles.trustNote}>
              {icon("shield-checkmark", 20, colors.primary)}
              <Text style={styles.trustNoteText}>
                Keep payment protected: only confirm a helper once the scope and
                timing feel right.
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Applicants</Text>
            {applicants.map((applicant) => (
              <Pressable
                key={applicant.name}
                onPress={() => setSelected(applicant.name)}
                style={[
                  styles.posterCard,
                  selected === applicant.name && {
                    borderColor: colors.primary,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: "#FFE2E6" }]}>
                  <Text style={styles.avatarText}>{applicant.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.posterName}>{applicant.name}</Text>
                  <Text style={styles.posterMeta}>{applicant.detail}</Text>
                  <Text style={[styles.posterMeta, { color: colors.primary }]}>
                    {applicant.rate} · View proposal
                  </Text>
                </View>
                {icon("chevron-forward", 18, colors.muted)}
              </Pressable>
            ))}
            {selected && (
              <View style={styles.protection}>
                <Text style={styles.protectionTitle}>
                  {selected}'s proposal
                </Text>
                <Text style={styles.protectionText}>
                  {
                    applicants.find((applicant) => applicant.name === selected)
                      ?.proposal
                  }
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
      {accepted ? (
        <View style={{ gap: 10 }}>
          <Pressable style={styles.publishButton} onPress={onChat}>
            <Text style={styles.publishText}>Open task chat</Text>
            {icon("send-outline", 20, "#fff")}
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={onTrack}>
            <Text style={styles.cancelText}>Track request</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.publishButton} onPress={accept}>
          <Text style={styles.publishText}>Confirm {selected}</Text>
          {icon("checkmark-circle", 20, "#fff")}
        </Pressable>
      )}
    </View>
  );
}

function GuestExplore({
  gigs,
  onJoin,
  onOpenGig,
}: {
  gigs: Gig[];
  onJoin: () => void;
  onOpenGig: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingBottom: 8 }]}>
        <View>
          <Text style={styles.headerKicker}>EXPLORE AS A GUEST</Text>
          <Text style={styles.brand}>Find help nearby</Text>
        </View>
        <Pressable style={styles.secondaryAction} onPress={onJoin}>
          <Text style={styles.secondaryActionText}>Join</Text>
        </Pressable>
      </View>
      <View style={[styles.trustNote, { marginTop: 0, marginBottom: 8 }]}>
        {icon("shield-checkmark", 19, colors.primary)}
        <Text style={styles.trustNoteText}>
          Browse public requests. Join free to see full details, apply, or post.
        </Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable style={styles.search} onPress={onJoin}>
          {icon("search-outline", 19, colors.muted)}
          <Text style={styles.searchText}>Search public requests</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>Popular nearby</Text>
        {gigs.slice(0, 5).map((gig) => (
          <GigCard key={gig.gigId} gig={gig} onOpen={onOpenGig} />
        ))}
        <Pressable style={styles.publishButton} onPress={onJoin}>
          <Text style={styles.publishText}>Create your free profile</Text>
          {icon("arrow-forward", 20, "#fff")}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ApplyForGig({
  gig,
  onBack,
  onSent,
}: {
  gig: Gig;
  onBack: () => void;
  onSent: () => void;
}) {
  const [message, setMessage] = useState(
    "Hi! I’d be happy to help. I have experience with this kind of task and can get it done carefully.",
  );
  const [rate, setRate] = useState(String(gig.budgetPaise / 100));
  const [availability, setAvailability] = useState("This afternoon");
  const [portfolioAdded, setPortfolioAdded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (!message.trim())
      return Alert.alert(
        "Add an introduction",
        "Tell the neighbour why you are a good fit.",
      );
    const amount = Math.round(Number(rate) * 100);
    if (!Number.isFinite(amount) || amount < 100)
      return Alert.alert(
        "Add a valid rate",
        "Enter a proposed amount of at least $1.",
      );
    setSubmitting(true);
    try {
      if (api.configured)
        await api.applyGig(
          gig.gigId,
          `${message.trim()}\n\nAvailability: ${availability}`,
          amount,
        );
      setSent(true);
    } catch (error) {
      Alert.alert(
        "Vouching required",
        error instanceof Error ? error.message : "Get vouched before applying for gigs.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const card = {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#F0E9ED",
  } as const;
  if (sent)
    return (
      <View style={styles.screen}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <View
            style={{
              height: 112,
              width: 112,
              borderRadius: 56,
              backgroundColor: "#FFE5E7",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon("checkmark-circle", 64, colors.primary)}
          </View>
          <Text style={[styles.detailTitle, { textAlign: "center" }]}>
            Application sent!
          </Text>
          <Text
            style={[styles.formHint, { textAlign: "center", maxWidth: 310 }]}
          >
            Your proposal is now with {gig.poster}. We’ll update you as soon as
            they respond.
          </Text>
          <Pressable
            style={[styles.publishButton, { width: "100%" }]}
            onPress={onSent}
          >
            <Text style={styles.publishText}>Go to my gig dashboard</Text>
            {icon("arrow-forward", 20, "#fff")}
          </Pressable>
        </View>
      </View>
    );
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.detailTop}>
        <Pressable style={styles.iconButton} onPress={onBack}>
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Apply for gig</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={card}>
          <Text style={styles.fieldLabel}>APPLYING TO</Text>
          <Text style={styles.gigTitle}>{gig.title}</Text>
          <Text style={styles.formHint}>
            {money(gig.budgetPaise)} budget · {gig.area ?? "Remote"}
          </Text>
        </View>
        <Text style={styles.detailTitle}>Make your introduction</Text>
        <Text style={styles.formHint}>
          Tell the neighbour why you’re a great fit.
        </Text>
        <Field
          label="Your message"
          value={message}
          onChangeText={setMessage}
          placeholder="Introduce yourself"
          multiline
        />
        <Field
          label="Your proposed rate (USD)"
          value={rate}
          onChangeText={setRate}
          placeholder="25"
          keyboardType="numeric"
        />
        <Text style={styles.fieldLabel}>Availability</Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 20,
          }}
        >
          {["This afternoon", "Tomorrow", "This weekend"].map((x) => (
            <Pressable
              key={x}
              onPress={() => setAvailability(x)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: availability === x ? "#FFE2E5" : "#fff",
                borderWidth: 1,
                borderColor: availability === x ? colors.primary : "#EDE5E9",
              }}
            >
              <Text
                style={{
                  color: availability === x ? colors.primary : colors.ink,
                  fontFamily: "Baloo2_700Bold",
                }}
              >
                {x}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[
            card,
            { flexDirection: "row", alignItems: "center", gap: 12 },
          ]}
          onPress={() => setPortfolioAdded((value) => !value)}
        >
          <View
            style={{
              height: 42,
              width: 42,
              borderRadius: 14,
              backgroundColor: "#FFE8EB",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon("upload-outline", 20, colors.primary)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.posterName}>
              {portfolioAdded ? "Portfolio attached" : "Add portfolio or proof"}
            </Text>
            <Text style={styles.formHint}>
              Optional · photos, certificate, or previous work
            </Text>
          </View>
          {icon("chevron-forward", 18, colors.muted)}
        </Pressable>
        <View style={styles.trustNote}>
          {icon("shield-checkmark", 20, colors.primary)}
          <Text style={styles.trustNoteText}>
            A clear proposal and your Vowch profile help neighbours choose with
            confidence.
          </Text>
        </View>
      </ScrollView>
      <Pressable
        style={[styles.publishButton, submitting && { opacity: 0.7 }]}
        onPress={submit}
        disabled={submitting}
      >
        <Text style={styles.publishText}>
          {submitting ? "Sending..." : "Send application"}
        </Text>
        {icon("send-outline", 19, "#fff")}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function GigDashboard({
  onBack,
  onTrack,
  onNotifications = () => {},
  onWallet = () => {},
  openGig,
  gigs,
}: {
  onBack: () => void;
  onTrack: () => void;
  onNotifications?: () => void;
  onWallet?: () => void;
  openGig: (gig: Gig) => void;
  gigs: Gig[];
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 26 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.detailTop}>
        <Pressable style={styles.iconButton} onPress={onBack}>
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>My gigs</Text>
        <Pressable style={styles.iconButton} onPress={onNotifications}>
          {icon("notifications-outline")}
        </Pressable>
      </View>
      <Text style={styles.detailTitle}>Good morning, Aarav</Text>
      <Text style={styles.formHint}>
        Your work, applications, and earnings in one place.
      </Text>
      <Pressable onPress={onWallet}>
        <LinearGradient
          colors={["#FD5C63", "#E84758"]}
          style={{
            borderRadius: 28,
            padding: 24,
            marginVertical: 24,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{
                color: "#fff",
                fontFamily: "Baloo2_700Bold",
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              TOTAL EARNED
            </Text>
            <Text
              style={{
                color: "#fff",
                fontFamily: "Baloo2_800ExtraBold",
                fontSize: 37,
              }}
            >
              $1,240
            </Text>
            <Text style={{ color: "#fff", fontFamily: "Baloo2_500Medium" }}>
              + $180 this month
            </Text>
          </View>
          {icon("wallet-outline", 34, "#fff")}
        </LinearGradient>
      </Pressable>
      <Text style={styles.sectionTitle}>In progress</Text>
      <Pressable
        style={[styles.posterCard, { marginTop: 12 }]}
        onPress={onTrack}
      >
        <View
          style={{
            height: 44,
            width: 44,
            borderRadius: 15,
            backgroundColor: "#FFE8EB",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon("briefcase-outline", 22, colors.primary)}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.posterName}>Help Sarah move a sofa</Text>
          <Text style={styles.posterMeta}>Today · 3:30 PM · 1.2 km away</Text>
          <Text
            style={{
              color: colors.success,
              fontFamily: "Baloo2_700Bold",
              fontSize: 12,
            }}
          >
            ● Ready to start
          </Text>
        </View>
        {icon("chevron-forward", 18, colors.muted)}
      </Pressable>
      <Text style={styles.sectionTitle}>Your applications</Text>
      <View style={styles.posterCard}>
        <View
          style={{
            height: 44,
            width: 44,
            borderRadius: 15,
            backgroundColor: "#EEF0FF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon("calendar-outline", 21, "#6A6CEB")}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.posterName}>Dog walker needed</Text>
          <Text style={styles.posterMeta}>Applied 2 hours ago</Text>
        </View>
        <Pill>Pending</Pill>
      </View>
      <Text style={styles.sectionTitle}>Recommended for you</Text>
      {gigs
        .filter((g) => g.poster !== "You")
        .slice(0, 2)
        .map((g) => (
          <GigCard key={g.gigId} gig={g} onOpen={() => openGig(g)} />
        ))}
    </ScrollView>
  );
}

function JobTracking({ onBack }: { onBack: () => void }) {
  const [stage, setStage] = useState(0);
  const labels = ["On the way", "Arrived", "Job started", "Completed"];
  return (
    <View style={styles.screen}>
      <View style={styles.detailTop}>
        <Pressable style={styles.iconButton} onPress={onBack}>
          {icon("arrow-back")}
        </Pressable>
        <Text style={styles.brand}>Job tracking</Text>
        <Pressable
          style={styles.iconButton}
          onPress={() =>
            Alert.alert(
              "Share job status",
              "A secure Vowch status link is ready to share with Sarah.",
            )
          }
        >
          {icon("share-outline")}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View
          style={{
            height: 190,
            borderRadius: 28,
            backgroundColor: "#E7E1D5",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 22,
          }}
        >
          <View
            style={{
              height: 66,
              width: 66,
              borderRadius: 33,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon("navigate-outline", 28, "#fff")}
          </View>
          <Text
            style={{
              marginTop: 12,
              color: colors.ink,
              fontFamily: "Baloo2_700Bold",
            }}
          >
            {stage < 1 ? "1.2 km away · 6 min" : "You’re at the location"}
          </Text>
        </View>
        <Pill tone="red">MOVING HELP</Pill>
        <Text style={styles.gigTitle}>Help Sarah move a sofa</Text>
        <Text style={styles.formHint}>Fort Greene, Brooklyn · $40 fixed</Text>
        <View style={{ marginTop: 22 }}>
          {labels.map((label, index) => (
            <View
              key={label}
              style={{ flexDirection: "row", gap: 13, marginBottom: 20 }}
            >
              <View
                style={{
                  height: 29,
                  width: 29,
                  borderRadius: 15,
                  backgroundColor: index <= stage ? colors.primary : "#E9E2E5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {index < stage ? (
                  icon("checkmark", 15, "#fff")
                ) : (
                  <Text
                    style={{
                      color: index <= stage ? "#fff" : colors.muted,
                      fontFamily: "Baloo2_800ExtraBold",
                    }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.posterName}>{label}</Text>
                <Text style={styles.formHint}>
                  {index === 0
                    ? "Share progress with Sarah"
                    : index === 1
                      ? "Confirm you reached the address"
                      : index === 2
                        ? "Start after you agree on the scope"
                        : "Payment is ready for approval"}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.trustNote}>
          {icon("shield-checkmark", 20, colors.primary)}
          <Text style={styles.trustNoteText}>
            Vowch protection keeps payment secure until Sarah approves the work.
          </Text>
        </View>
      </ScrollView>
      <Pressable
        style={[
          styles.publishButton,
          stage === 3 && { backgroundColor: colors.success },
        ]}
        onPress={() => setStage((s) => Math.min(s + 1, 3))}
      >
        <Text style={styles.publishText}>
          {stage === 3 ? "Job completed" : labels[stage + 1]}
        </Text>
        {icon(stage === 3 ? "checkmark" : "arrow-forward", 20, "#fff")}
      </Pressable>
    </View>
  );
}

function Pill({
  children,
  tone = "soft",
}: {
  children: React.ReactNode;
  tone?: "soft" | "red" | "dark";
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === "red" && styles.pillRed,
        tone === "dark" && styles.pillDark,
      ]}
    >
      <Text style={[styles.pillText, tone !== "soft" && styles.pillTextOnDark]}>
        {children}
      </Text>
    </View>
  );
}

function GigCard({ gig, onOpen }: { gig: Gig; onOpen: () => void }) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.gigCard, pressed && styles.pressed]}
    >
      <View style={styles.gigTop}>
        <Pill>{gig.skill}</Pill>
        <Text style={styles.price}>{money(gig.budgetPaise)}</Text>
      </View>
      <Text style={styles.gigTitle}>{gig.title}</Text>
      <Text style={styles.gigDescription} numberOfLines={2}>
        {gig.description}
      </Text>
      <View style={styles.gigMeta}>
        <Text style={styles.gigMetaText}>
          {gig.poster} · {gig.postedAt}
        </Text>
        <Text style={styles.gigMetaText}>
          {gig.mode === "REMOTE" ? "Remote" : gig.area}
        </Text>
      </View>
      <View style={styles.gigFooter}>
        <View style={styles.vowchMark}>
          {icon("shield-checkmark", 15, colors.primary)}
          <Text style={styles.vowchText}>{gig.vowches ?? 0} people vowch</Text>
        </View>
        {icon("chevron-forward", 18, colors.muted)}
      </View>
    </Pressable>
  );
}

function Header({
  title,
  subtitle,
  onBell,
}: {
  title: string;
  subtitle?: string;
  onBell?: () => void;
}) {
  const isBrand = title === "Vowch";
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerKicker}>{subtitle ?? "BENGALURU, INDIA"}</Text>
        {isBrand ? (
          <Image
            source={brandAsset}
            style={styles.headerLogo}
            resizeMode="contain"
            accessibilityLabel="Vowch"
          />
        ) : (
          <Text style={styles.brand}>{title}</Text>
        )}
      </View>
      {onBell && (
        <Pressable style={styles.iconButton} onPress={onBell}>
          {icon("notifications-outline")}
          <View style={styles.dot} />
        </Pressable>
      )}
    </View>
  );
}

function Home({
  gigs,
  setScreen,
  openGig,
}: {
  gigs: Gig[];
  setScreen: (screen: Screen) => void;
  openGig: (gig: Gig) => void;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <Header title="Vowch" onBell={() => setScreen("notifications")} />
      <View style={styles.homeIntro}>
        <Text style={styles.homeKicker}>YOUR LOCAL TRUST LAYER</Text>
        <Text style={styles.homeTitle}>Neighbourhood help, made human.</Text>
        <Text style={styles.homeBody}>
          Find a trusted person nearby or share the work you can do.
        </Text>
      </View>
      <Pressable style={styles.search} onPress={() => setScreen("explore")}>
        {icon("search-outline", 19, colors.muted)}
        <Text style={styles.searchText}>What do you need help with?</Text>
        {icon("options-outline", 19, colors.primary)}
      </Pressable>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.primaryAction}
          onPress={() => setScreen("create")}
        >
          {icon("add-circle", 18, "#fff")}
          <Text style={styles.primaryActionText}>Post a request</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryAction}
          onPress={() => setScreen("explore")}
        >
          {icon("compass-outline", 18, colors.primary)}
          <Text style={styles.secondaryActionText}>Find a gig</Text>
        </Pressable>
      </View>
      <SectionHead
        label="Near You"
        action="See all"
        onAction={() => setScreen("explore")}
      />
      {gigs.slice(0, 2).map((g) => (
        <GigCard key={g.gigId} gig={g} onOpen={() => openGig(g)} />
      ))}
      <SectionHead
        label="New Gigs"
        action="View all"
        onAction={() => setScreen("explore")}
      />
      <View style={styles.featured}>
        <LinearGradient
          colors={["#43251D", "#A14A36"]}
          style={styles.featureImage}
        >
          <Text style={styles.featureEmoji}>📦</Text>
          <Pill tone="dark">MOVING</Pill>
        </LinearGradient>
        <View style={styles.featureInfo}>
          <Text style={styles.featureTitle}>
            Delivery driver needed locally
          </Text>
          <Text style={styles.featurePrice}>$22/hr</Text>
          <Text style={styles.gigDescription} numberOfLines={2}>
            Morning shift · Van preferred
          </Text>
          <View style={styles.vowchMark}>
            {icon("shield-checkmark", 15, colors.primary)}
            <Text style={styles.vowchText}>10 people vowch</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function SectionHead({
  label,
  action,
  onAction,
}: {
  label: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Pressable onPress={onAction}>
        <Text style={styles.sectionAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

function Explore({
  gigs,
  openGig,
}: {
  gigs: Gig[];
  openGig: (gig: Gig) => void;
}) {
  const [view, setView] = useState<"categories" | "results">("categories");
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (filterOpen) {
          setFilterOpen(false);
          return true;
        }
        if (view === "results") {
          setView("categories");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [filterOpen, view]);
  const categories: Array<[string, keyof typeof Ionicons.glyphMap, string]> = [
    ["Home services", "home-outline", "#FFE9ED"],
    ["Delivery", "bicycle-outline", "#EEF0FF"],
    ["Moving", "car-outline", "#ECF4F1"],
    ["Tutoring", "school-outline", "#FFF1E5"],
    ["Tech", "laptop-outline", "#E9E9FF"],
    ["Photography", "camera-outline", "#F1F1F1"],
    ["Repairs", "construct-outline", "#FFE2DE"],
    ["Beauty", "cut-outline", "#FFEAF0"],
    ["Pet care", "paw-outline", "#F0F0F0"],
    ["Childcare", "happy-outline", "#EEF2EF"],
    ["Local business", "storefront-outline", "#ECEBFF"],
    ["Giveaways", "gift-outline", "#FFF0F2"],
  ];
  const filtered = gigs.filter(
    (g) =>
      selectedCategory === "All" ||
      g.skill
        .toLowerCase()
        .includes(selectedCategory.split(" ")[0].toLowerCase()) ||
      (selectedCategory === "Home services" && g.skill === "Moving help"),
  );
  const choose = (category: string) => {
    setSelectedCategory(category);
    setQuery(category);
    setView("results");
  };
  if (view === "categories")
    return (
      <View style={exploreStyles.screen}>
        <Header title="Explore" subtitle="FIND HELP NEAR YOU" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={exploreStyles.scroll}
        >
          <Pressable
            onPress={() => setView("results")}
            style={exploreStyles.search}
          >
            <Ionicons name="search-outline" size={21} color={colors.muted} />
            <Text style={exploreStyles.searchPlaceholder}>
              Search for local services or people...
            </Text>
          </Pressable>
          <View style={exploreStyles.sectionRow}>
            <Text style={exploreStyles.sectionTitle}>Trending nearby</Text>
            <Text style={exploreStyles.link}>See all</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={exploreStyles.trends}
          >
            {["#DogWalkers", "#TechHelp", "#Handyman", "#Tutoring"].map(
              (item, index) => (
                <Pressable
                  key={item}
                  onPress={() =>
                    choose(
                      index === 0
                        ? "Pet care"
                        : index === 3
                          ? "Tutoring"
                          : "All",
                    )
                  }
                  style={[
                    exploreStyles.trend,
                    index === 0 && exploreStyles.trendActive,
                  ]}
                >
                  <Text
                    style={[
                      exploreStyles.trendText,
                      index === 0 && exploreStyles.trendTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ),
            )}
          </ScrollView>
          <Text style={[exploreStyles.sectionTitle, { marginTop: 24 }]}>
            Browse by category
          </Text>
          <View style={exploreStyles.grid}>
            {categories.map(([label, glyph, tint]) => (
              <Pressable
                key={label}
                onPress={() => choose(label)}
                style={({ pressed }) => [
                  exploreStyles.category,
                  pressed && exploreStyles.pressed,
                ]}
              >
                <View
                  style={[
                    exploreStyles.categoryIcon,
                    { backgroundColor: tint },
                  ]}
                >
                  <Ionicons name={glyph} size={26} color={colors.primary} />
                </View>
                <Text style={exploreStyles.categoryText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  return (
    <View style={exploreStyles.screen}>
      <Header title="Explore" subtitle="DISCOVER TRUSTED WORK" />
      <View style={exploreStyles.resultsTop}>
        <Pressable
          onPress={() => setView("categories")}
          style={exploreStyles.search}
        >
          <Ionicons name="search-outline" size={21} color={colors.muted} />
          <Text style={exploreStyles.searchPlaceholder}>
            {query || "Search for help..."}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFilterOpen(true)}
          style={exploreStyles.filterButton}
        >
          <Ionicons name="options-outline" size={23} color="#fff" />
        </Pressable>
      </View>
      <View style={exploreStyles.toggleRow}>
        <View style={exploreStyles.listToggle}>
          <Ionicons name="list" size={18} color={colors.primary} />
          <Text style={exploreStyles.toggleText}>List</Text>
        </View>
        <Text style={exploreStyles.resultCount}>
          {filtered.length || gigs.length} results nearby
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={exploreStyles.trends}
      >
        {["Distance", "Budget", "Category", "Verified"].map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilterOpen(true)}
            style={exploreStyles.filterChip}
          >
            <Text style={exploreStyles.filterChipText}>{item}</Text>
            <Ionicons name="chevron-down" size={15} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        style={exploreStyles.resultsScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={exploreStyles.results}
      >
        {(filtered.length ? filtered : gigs).map((g) => (
          <GigCard key={g.gigId} gig={g} onOpen={() => openGig(g)} />
        ))}
      </ScrollView>
      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => setFilterOpen(false)}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
    </View>
  );
}

function FilterSheet({
  visible,
  onClose,
  onApply,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [type, setType] = useState("Offering service");
  const [sort, setSort] = useState("Newest");
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <SafeAreaView style={exploreStyles.modal} edges={["top", "bottom"]}>
        <View style={exploreStyles.filterHeader}>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.primary} />
          </Pressable>
          <Text style={exploreStyles.filterTitle}>Filters</Text>
          <Pressable onPress={() => onSelect("All")}>
            <Text style={exploreStyles.reset}>Reset</Text>
          </Pressable>
        </View>
        <ScrollView
          style={exploreStyles.filterScroll}
          contentContainerStyle={exploreStyles.filterContent}
        >
          <Text style={exploreStyles.filterLabel}>SORT BY</Text>
          <View style={exploreStyles.optionRow}>
            {["Newest", "Closest", "Budget"].map((x) => (
              <Pressable
                key={x}
                onPress={() => setSort(x)}
                style={[
                  exploreStyles.option,
                  x === sort && exploreStyles.optionActive,
                ]}
              >
                <Text
                  style={[
                    exploreStyles.optionText,
                    x === sort && exploreStyles.optionTextActive,
                  ]}
                >
                  {x}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={exploreStyles.distanceCard}>
            <View style={exploreStyles.distanceHead}>
              <Text style={exploreStyles.distanceLabel}>Distance</Text>
              <Text style={exploreStyles.link}>12 km</Text>
            </View>
            <View style={exploreStyles.track}>
              <View style={exploreStyles.trackFill} />
              <View style={exploreStyles.thumb} />
            </View>
            <View style={exploreStyles.distanceLabels}>
              <Text style={exploreStyles.small}>1 km</Text>
              <Text style={exploreStyles.small}>50 km</Text>
            </View>
          </View>
          <Text style={exploreStyles.filterLabel}>POST TYPE</Text>
          {["Need help", "Offering service", "Hiring", "Selling / Giving"].map(
            (x) => (
              <Pressable
                key={x}
                onPress={() => setType(x)}
                style={exploreStyles.typeRow}
              >
                <Text style={exploreStyles.typeText}>{x}</Text>
                <View
                  style={[
                    exploreStyles.checkbox,
                    type === x && exploreStyles.checkboxOn,
                  ]}
                >
                  {type === x && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
              </Pressable>
            ),
          )}
          <Text style={exploreStyles.filterLabel}>CATEGORY</Text>
          <View style={exploreStyles.categoryChips}>
            {[
              "All",
              "Home services",
              "Tutoring",
              "Pet care",
              "Moving",
              "Tech",
            ].map((x) => (
              <Pressable
                key={x}
                onPress={() => onSelect(x)}
                style={[
                  exploreStyles.selectChip,
                  selected === x && exploreStyles.selectChipActive,
                ]}
              >
                <Text
                  style={[
                    exploreStyles.selectChipText,
                    selected === x && exploreStyles.selectChipTextActive,
                  ]}
                >
                  {x}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <View style={exploreStyles.applyArea}>
          <Pressable onPress={onApply} style={exploreStyles.applyButton}>
            <Text style={exploreStyles.applyText}>Show results</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Create({
  onBack,
  onCreated,
  onViewPost,
  onFindGig,
}: {
  onBack: () => void;
  onCreated: (gig: Gig) => void;
  onViewPost: (gig: Gig) => void;
  onFindGig?: () => void;
}) {
  const [step, setStep] = useState(0);
  const burst = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (step === 5) {
      burst.setValue(0);
      Animated.spring(burst, {
        toValue: 1,
        friction: 4,
        tension: 55,
        useNativeDriver: true,
      }).start();
    }
  }, [burst, step]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skill, setSkill] = useState("Moving help");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("Bengaluru, India");
  const [media, setMedia] = useState(0);
  const [published, setPublished] = useState<Gig | null>(null);
  const [publishing, setPublishing] = useState(false);
  const back = () => (step === 0 ? onBack() : setStep(step - 1));
  const next = () => {
    if (step === 1 && (!title || !description))
      return Alert.alert(
        "Add the details",
        "Please add a title and description.",
      );
    if (
      step === 2 &&
      (!location.trim() ||
        !Number.isFinite(Number(budget)) ||
        Number(budget) <= 0)
    )
      return Alert.alert(
        "Add logistics",
        "Enter a location and a budget greater than $0.",
      );
    setStep(step + 1);
  };
  const publish = async () => {
    const localGig = {
      gigId: `local-${Date.now()}`,
      title: title || "Community request",
      description: description || "Looking for trusted local help.",
      skill,
      mode: "REMOTE" as const,
      area: location.trim() || "Bengaluru, India",
      budgetPaise: Number(budget || 0) * 100,
      status: "OPEN" as const,
      poster: "You",
      vowches: 0,
      postedAt: "just now",
    };
    setPublishing(true);
    try {
      const gig = api.configured ? await api.createGig(localGig) : localGig;
      setPublished(gig);
      onCreated(gig);
      setStep(5);
    } catch (error) {
      Alert.alert("Vouching required", error instanceof Error ? error.message : "Get vouched before posting a gig.");
    } finally { setPublishing(false); }
  };
  if (step === 5)
    return (
      <View style={styles.screen}>
        <Animated.View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            transform: [
              {
                scale: burst.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.84, 1],
                }),
              },
            ],
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                top: 110 + i * 28,
                left: 36 + i * 60,
                width: 13,
                height: 13,
                borderRadius: 7,
                backgroundColor: i % 2 ? "#FFD166" : colors.primary,
                opacity: burst,
                transform: [
                  {
                    translateY: burst.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-36 + i * 8, 0],
                    }),
                  },
                ],
              }}
            />
          ))}
          <View
            style={{
              height: 112,
              width: 112,
              borderRadius: 36,
              backgroundColor: "#FFE5E7",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="checkmark-circle"
              size={68}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.detailTitle, { textAlign: "center" }]}>
            Your post is live!
          </Text>
          <Text
            style={[styles.formHint, { textAlign: "center", maxWidth: 300 }]}
          >
            Your neighbours can now see and vouch for your request.
          </Text>
          <Pressable
            style={[styles.publishButton, { width: "100%" }]}
            onPress={() => published && onViewPost(published)}
          >
            <Text style={styles.publishText}>View your post</Text>
            {icon("arrow-forward", 20, "#fff")}
          </Pressable>
          <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
            <Pressable
              style={[
                styles.cancelButton,
                {
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  borderRadius: 28,
                },
              ]}
              onPress={() =>
                Alert.alert(
                  "Share post",
                  "Your Vowch post link is ready to share with trusted neighbours.",
                )
              }
            >
              <Text style={styles.cancelText}>Share post</Text>
            </Pressable>
            <Pressable
              style={[
                styles.cancelButton,
                {
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  borderRadius: 28,
                },
              ]}
              onPress={onBack}
            >
              <Text style={styles.cancelText}>Back to home</Text>
            </Pressable>
          </View>
          <View style={styles.trustNote}>
            {icon("people-outline", 20, colors.primary)}
            <Text style={styles.trustNoteText}>
              Invite neighbours to vouch and build trust faster.
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={back}>
          {icon(step ? "arrow-back" : "close")}
        </Pressable>
        <Text style={styles.brand}>
          {step ? "Step " + step + " of 4" : "Create post"}
        </Text>
        <View style={styles.iconButton} />
      </View>
      <View style={{ height: 6, backgroundColor: "#E8E5FB", borderRadius: 4 }}>
        {step > 0 && (
          <View
            style={{
              height: 6,
              width: `${step * 25}%`,
              backgroundColor: colors.primary,
              borderRadius: 4,
            }}
          />
        )}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 28, paddingBottom: 120 }}
      >
        {step === 0 && (
          <>
            <Text style={styles.detailTitle}>
              How would you like to use Vowch?
            </Text>
            <Text style={styles.formHint}>
              You can request help today and find paid work another time—one
              Vowch profile does both.
            </Text>
            {[
              "I need help",
              "I’m offering a service",
              "I’m hiring for a gig",
              "I’m selling or giving",
              "I’m sharing a community opportunity",
            ].map((x) => (
              <Pressable
                key={x}
                onPress={() =>
                  x === "I need help" ? setStep(1) : onFindGig?.()
                }
                style={styles.settingRow}
              >
                <Text style={styles.settingText}>{x}</Text>
                {icon("chevron-forward", 18, colors.primary)}
              </Pressable>
            ))}
          </>
        )}
        {step === 1 && (
          <>
            <Text style={styles.detailTitle}>Share the details</Text>
            <Field
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Moving a heavy sofa"
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Tell neighbours what you need help with."
              multiline
            />
            <Field
              label="Category"
              value={skill}
              onChangeText={setSkill}
              placeholder="Moving help"
            />
          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.detailTitle}>Logistics & budget</Text>
            <Field
              label="Location"
              value={location}
              onChangeText={setLocation}
              placeholder="Your neighbourhood"
            />
            <Field
              label="Budget (USD)"
              value={budget}
              onChangeText={setBudget}
              placeholder="0.00"
              keyboardType="numeric"
            />
            <View style={styles.trustNote}>
              {icon("flash-outline", 20, colors.primary)}
              <Text style={styles.trustNoteText}>
                You can keep your budget negotiable.
              </Text>
            </View>
          </>
        )}
        {step === 3 && (
          <>
            <Text style={styles.detailTitle}>Show the community</Text>
            <Text style={styles.formHint}>
              Photos help neighbours trust your post.
            </Text>
            <Pressable
              onPress={() => setMedia(Math.min(media + 1, 3))}
              style={[
                styles.settingRow,
                {
                  minHeight: 150,
                  justifyContent: "center",
                  borderStyle: "dashed",
                  borderColor: colors.primary,
                },
              ]}
            >
              {icon("camera-outline", 34, colors.primary)}
              <Text style={styles.settingText}>
                {media ? "Add another photo" : "Add photos or videos"}
              </Text>
            </Pressable>
            {media > 0 && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                {Array.from({ length: media }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 16,
                      overflow: "hidden",
                      backgroundColor: "#FDE7EB",
                    }}
                  >
                    <Image
                      source={require("./assets/onboarding-community.png")}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => setMedia(Math.max(0, media - 1))}
                      style={{
                        position: "absolute",
                        right: 5,
                        top: 5,
                        backgroundColor: "#fff",
                        borderRadius: 14,
                        padding: 4,
                      }}
                    >
                      <Ionicons name="close" size={14} color={colors.primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        {step === 4 && (
          <>
            <Text style={styles.detailTitle}>Check your post</Text>
            <View style={styles.gigCard}>
              <Pill>{skill}</Pill>
              <Text style={styles.gigTitle}>
                {title || "Your request title"}
              </Text>
              <Text style={styles.detailDescription}>
                {description ||
                  "Add details so neighbours can understand your request."}
              </Text>
              <Text style={styles.price}>
                {budget ? `${budget}` : "Budget negotiable"}
              </Text>
            </View>
            <View style={styles.trustNote}>
              {icon("shield-checkmark", 20, colors.success)}
              <Text style={styles.trustNoteText}>
                Vowch Trust Guarantee: verified neighbours see your post first.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      {step > 0 && (
        <View style={{ flexDirection: "row", gap: 12, paddingBottom: 16 }}>
          <Pressable style={[styles.cancelButton, { flex: 1 }]} onPress={back}>
            <Text style={styles.cancelText}>Back</Text>
          </Pressable>
          <Pressable
            style={[styles.publishButton, { flex: 2 }, publishing && { opacity: 0.7 }]}
            disabled={publishing}
            onPress={step === 4 ? () => void publish() : next}
          >
            <Text style={styles.publishText}>
              {publishing ? "Publishing…" : step === 4 ? "Publish now" : "Continue"}
            </Text>
            {icon("arrow-forward", 20, "#fff")}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  label: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        {...props}
        style={[styles.input, props.multiline && styles.textarea]}
        placeholderTextColor="#928F9B"
        textAlignVertical={props.multiline ? "top" : "center"}
      />
    </View>
  );
}

function GigDetail({
  gig,
  onBack,
  onInbox,
}: {
  gig: Gig;
  onBack: () => void;
  onInbox: () => void;
}) {
  const [applied, setApplied] = useState(false);
  const apply = async () => {
    try {
      await api.applyGig(
        gig.gigId,
        "I would like to help with this request.",
        gig.budgetPaise,
      );
    } catch {}
    setApplied(true);
  };
  return (
    <View style={styles.screen}>
      <View style={styles.detailTop}>
        <Pressable style={styles.iconButton} onPress={onBack}>
          {icon("arrow-back")}
        </Pressable>
        <Pressable style={styles.iconButton}>
          {icon("bookmark-outline")}
        </Pressable>
      </View>
      <ScrollView>
        <Pill tone="red">{gig.skill.toUpperCase()}</Pill>
        <Text style={styles.detailTitle}>{gig.title}</Text>
        <Text style={styles.detailPrice}>
          {money(gig.budgetPaise)}{" "}
          <Text style={styles.detailPriceSmall}>fixed budget</Text>
        </Text>
        <View style={styles.posterCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{gig.poster?.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.posterName}>{gig.poster}</Text>
            <Text style={styles.posterMeta}>
              Verified neighbour · {gig.vowches} vowches
            </Text>
          </View>
          {icon("chevron-forward", 18, colors.muted)}
        </View>
        <Text style={styles.detailDescription}>{gig.description}</Text>
        <View style={styles.infoRow}>
          {icon("location-outline", 19, colors.primary)}
          <View>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{gig.area ?? "Remote"}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          {icon("time-outline", 19, colors.primary)}
          <View>
            <Text style={styles.infoLabel}>Posted</Text>
            <Text style={styles.infoValue}>{gig.postedAt}</Text>
          </View>
        </View>
        <View style={styles.protection}>
          <Text style={styles.protectionTitle}>Vowch protection</Text>
          <Text style={styles.protectionText}>
            Confirm the scope together. Payment is released only after you
            approve delivery.
          </Text>
        </View>
      </ScrollView>
      <Pressable
        style={[
          styles.publishButton,
          applied && { backgroundColor: colors.success },
        ]}
        onPress={applied ? onInbox : apply}
      >
        <Text style={styles.publishText}>
          {applied ? "Open conversation" : "Offer to help"}
        </Text>
        {icon(applied ? "chatbubble-outline" : "arrow-forward", 20, "#fff")}
      </Pressable>
    </View>
  );
}

function Inbox() {
  const messages = [
    {
      name: "Sofia J.",
      text: "Thanks! Saturday 10am still works?",
      time: "2m",
      badge: 1,
    },
    {
      name: "David Chen",
      text: "Miso is excited to meet you 🐶",
      time: "1h",
      badge: 0,
    },
  ];
  return (
    <View style={styles.screen}>
      <Header title="Messages" subtitle="YOUR CONVERSATIONS" />
      <FlatList
        data={messages}
        keyExtractor={(x) => x.name}
        renderItem={({ item }) => (
          <Pressable style={styles.messageRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.posterName}>{item.name}</Text>
              <Text style={styles.messageText}>{item.text}</Text>
            </View>
            <View style={styles.messageTime}>
              <Text style={styles.timeText}>{item.time}</Text>
              {item.badge ? (
                <View style={styles.unread}>
                  <Text style={styles.unreadText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function Passport({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
    >
      <Header title="Your Passport" subtitle="TRUST YOU CAN CARRY" />
      <LinearGradient colors={["#B50025", "#6D0018"]} style={styles.passport}>
        <View style={styles.passportTop}>
          <Text style={styles.passportV}>V</Text>
          <Pill tone="dark">ACTIVE</Pill>
        </View>
        <Text style={styles.passportNumber}>PASSPORT · 0000042</Text>
        <Text style={styles.passportName}>Aarav Mehta</Text>
        <Text style={styles.passportSkill}>Community helper · Brooklyn</Text>
        <View style={styles.stats}>
          <Stat value="742" label="Cred" />
          <Stat value="4.9" label="Rating" />
          <Stat value="18" label="Gigs" />
        </View>
        <View style={styles.lineage}>
          {icon("shield-checkmark", 17, "#fff")}
          <Text style={styles.lineageText}>Vowched by Meera · #0000019</Text>
        </View>
      </LinearGradient>
      <View style={styles.passportList}>
        <Pressable style={styles.settingRow} onPress={() => setScreen("house")}>
          {icon("people-outline", 21, colors.primary)}
          <Text style={styles.settingText}>My community house</Text>
          {icon("chevron-forward", 18, colors.muted)}
        </Pressable>
        <Pressable
          style={styles.settingRow}
          onPress={() => setScreen("profile")}
        >
          {icon("person-outline", 21, colors.primary)}
          <Text style={styles.settingText}>Profile & verification</Text>
          {icon("chevron-forward", 18, colors.muted)}
        </Pressable>
        <Pressable style={styles.settingRow}>
          {icon("share-outline", 21, colors.primary)}
          <Text style={styles.settingText}>Share my Passport</Text>
          {icon("chevron-forward", 18, colors.muted)}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function House() {
  return (
    <View style={styles.screen}>
      <Header title="House of Meera" subtitle="YOUR TRUST NETWORK" />
      <View style={styles.houseStats}>
        <Stat value="24" label="Members" />
        <Stat value="9" label="Skills" />
        <Stat value="4.8" label="Avg cred" />
      </View>
      <Text style={styles.sectionTitle}>Your connections</Text>
      {[
        "Meera · Founder",
        "Priya · Editor",
        "Kabir · Webflow",
        "Anika · Motion",
      ].map((name, index) => (
        <View style={styles.memberRow} key={name}>
          <View
            style={[styles.memberLine, index === 0 && styles.memberLineRoot]}
          />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0]}</Text>
          </View>
          <View>
            <Text style={styles.posterName}>{name}</Text>
            <Text style={styles.posterMeta}>
              {index === 0 ? "Vowched you" : "Trusted member · Proven"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
function Notifications() {
  return (
    <View style={styles.screen}>
      <Header title="Activity" subtitle="STAY IN THE LOOP" />
      {[
        "Your request is now live in Brooklyn",
        "Sofia viewed your offer to help",
        "Your Skill Passport received a new vowch",
      ].map((text, index) => (
        <View style={styles.notice} key={text}>
          <View style={styles.noticeIcon}>
            {icon(
              index === 2 ? "shield-checkmark" : "notifications",
              19,
              colors.primary,
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeText}>{text}</Text>
            <Text style={styles.timeText}>{index + 1}h ago</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
function Profile() {
  return (
    <ScrollView style={styles.screen}>
      <Header title="Profile" subtitle="YOUR VOWCH IDENTITY" />
      <View style={styles.profileHero}>
        <View style={[styles.avatar, styles.profileAvatar]}>
          <Text style={styles.profileInitials}>AM</Text>
        </View>
        <Text style={styles.detailTitle}>Aarav Mehta</Text>
        <Text style={styles.posterMeta}>Brooklyn, NY · Member since 2026</Text>
        <Pill tone="red">IDENTITY VERIFIED</Pill>
      </View>
      <Text style={styles.sectionTitle}>Skills</Text>
      <View style={styles.chipRow}>
        <Pill>Moving help</Pill>
        <Pill>Design</Pill>
        <Pill>Community support</Pill>
      </View>
      <Text style={styles.sectionTitle}>Trust summary</Text>
      <View style={styles.trustSummary}>
        <Text style={styles.rating}>4.9 ★</Text>
        <Text style={styles.posterMeta}>Based on 18 completed gigs</Text>
      </View>
    </ScrollView>
  );
}

function Nav({
  active,
  setScreen,
}: {
  active: Screen;
  setScreen: (screen: Screen) => void;
}) {
  const insets = useSafeAreaInsets();
  const item = (screen: Screen, label: string, Icon: any) => {
    const selected = active === screen;
    return (
      <Pressable style={styles.navItem} onPress={() => setScreen(screen)}>
        <Icon
          size={23}
          color={selected ? colors.primary : colors.muted}
          strokeWidth={selected ? 3 : 2.3}
        />
        <Text style={[styles.navText, selected && styles.navActive]}>
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View
      style={[
        styles.nav,
        {
          height: 78 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {item("home", "Home", HomeIcon)}
      {item("explore", "Explore", Compass)}
      <Pressable style={styles.fab} onPress={() => setScreen("create")}>
        <CirclePlus size={29} color="#fff" strokeWidth={2.8} />
      </Pressable>
      {item("inbox", "Inbox", MessageCircle)}
      {item("passport", "Passport", ShieldCheck)}
    </View>
  );
}

function ScreenMotion({
  screen,
  children,
}: {
  screen: Screen;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [progress, screen]);
  return (
    <Animated.View
      style={{
        flex: 1,
        paddingBottom: insets.bottom,
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.985, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function VowchApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  useEffect(() => {
    api
      .gigs()
      .then(setGigs)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!onboarded || screen === "home") return false;
        setScreen("home");
        return true;
      },
    );
    return () => subscription.remove();
  }, [onboarded, screen]);
  const openGig = (gig: Gig) => {
    setSelectedGig(gig);
    setScreen("gig");
  };
  const content = useMemo(() => {
    if (screen === "home")
      return <Home gigs={gigs} setScreen={setScreen} openGig={openGig} />;
    if (screen === "explore") return <Explore gigs={gigs} openGig={openGig} />;
    if (screen === "create")
      return (
        <Create
          onBack={() => setScreen("home")}
          onCreated={(gig) => setGigs((old) => [gig, ...old])}
          onViewPost={(gig) => {
            setSelectedGig(gig);
            setScreen("gig");
          }}
        />
      );
    if (screen === "gig" && selectedGig)
      return (
        <GigDetail
          gig={selectedGig}
          onBack={() => setScreen("home")}
          onInbox={() => setScreen("inbox")}
        />
      );
    if (screen === "inbox") return <Inbox />;
    if (screen === "passport") return <Passport setScreen={setScreen} />;
    if (screen === "notifications") return <Notifications />;
    if (screen === "profile") return <Profile />;
    return <House />;
  }, [screen, gigs, selectedGig]);
  if (!onboarded)
    return (
      <View style={styles.app}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <Onboarding onComplete={() => setOnboarded(true)} />
      </View>
    );
  return (
    <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScreenMotion screen={screen}>{content}</ScreenMotion>
      {!["create", "gig", "notifications", "profile", "house"].includes(
        screen,
      ) && <Nav active={screen} setScreen={setScreen} />}
    </SafeAreaView>
  );
}

const exploreStyles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 22,
    backgroundColor: colors.background,
  },
  scroll: { paddingBottom: 112 },
  search: {
    minHeight: 56,
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9DDE2",
    backgroundColor: "#F4F1F8",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  searchPlaceholder: {
    flex: 1,
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
    fontSize: 15,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 21,
  },
  link: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 13,
  },
  trends: { gap: 10, paddingVertical: 4, paddingRight: 20 },
  trend: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEE5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  trendActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  trendText: {
    color: "#5D555B",
    fontFamily: "Baloo2_600SemiBold",
    fontSize: 13,
  },
  trendTextActive: { color: "#fff", fontFamily: "Baloo2_800ExtraBold" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
    marginTop: 16,
  },
  category: {
    width: "47.5%",
    minHeight: 126,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  categoryIcon: {
    height: 56,
    width: 56,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    color: colors.ink,
    fontFamily: "Baloo2_700Bold",
    fontSize: 14,
    textAlign: "center",
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  resultsTop: { flexDirection: "row", gap: 12, marginBottom: 14 },
  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  listToggle: {
    paddingHorizontal: 15,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F0EFFF",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  toggleText: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 13,
  },
  resultCount: {
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
    fontSize: 12,
  },
  filterChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEE5E9",
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  filterChipText: {
    color: colors.ink,
    fontFamily: "Baloo2_700Bold",
    fontSize: 13,
  },
  resultsScroll: { flex: 1 },
  results: { paddingBottom: 112, paddingTop: 12 },
  modal: { flex: 1, backgroundColor: colors.background },
  filterHeader: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#F0E9ED",
  },
  filterTitle: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 23,
  },
  reset: { color: colors.muted, fontFamily: "Baloo2_700Bold", fontSize: 14 },
  filterScroll: { flex: 1 },
  filterContent: { padding: 20, paddingBottom: 40 },
  filterLabel: {
    color: "#68636A",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 12,
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 12,
  },
  optionRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  option: {
    paddingHorizontal: 18,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEE5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: { borderColor: colors.primary },
  optionText: {
    color: "#675D64",
    fontFamily: "Baloo2_600SemiBold",
    fontSize: 14,
  },
  optionTextActive: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
  },
  distanceCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  distanceHead: { flexDirection: "row", justifyContent: "space-between" },
  distanceLabel: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 14,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "#DED9DD",
    marginTop: 35,
    position: "relative",
  },
  trackFill: {
    width: "26%",
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: "absolute",
    left: "25%",
    top: -8,
    height: 21,
    width: 21,
    borderRadius: 12,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  distanceLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  small: { color: colors.muted, fontFamily: "Baloo2_500Medium", fontSize: 13 },
  typeRow: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EFE6E9",
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeText: {
    color: colors.ink,
    fontFamily: "Baloo2_600SemiBold",
    fontSize: 16,
  },
  checkbox: {
    height: 24,
    width: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#9B7478",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChips: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  selectChip: {
    minHeight: 40,
    borderRadius: 21,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEE5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  selectChipActive: { backgroundColor: "#FFE2E5", borderColor: colors.primary },
  selectChipText: {
    color: colors.ink,
    fontFamily: "Baloo2_600SemiBold",
    fontSize: 13,
  },
  selectChipTextActive: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
  },
  applyArea: {
    padding: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#F0E9ED",
  },
  applyButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  applyText: { color: "#fff", fontFamily: "Baloo2_800ExtraBold", fontSize: 16 },
});

const houseStyles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  passportWrap: { marginBottom: 22, marginTop: 4 },
  passportTilt: { height: 238, position: "relative" },
  skillPassportFace: {
    backfaceVisibility: "hidden",
    borderRadius: 26,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    padding: 22,
    position: "absolute",
    right: 0,
    top: 0,
  },
  skillPassportFront: { backgroundColor: "#15161D" },
  skillPassportBack: { backgroundColor: "#17181E" },
  passportMetal: { backgroundColor: "rgba(255,255,255,0.035)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  passportRingOne: { borderColor: "rgba(255,255,255,0.12)", borderRadius: 200, borderWidth: 1, height: 360, position: "absolute", right: -55, top: -190, transform: [{ rotate: "-28deg" }], width: 150 },
  passportRingTwo: { borderColor: "rgba(253,92,99,0.36)", borderRadius: 180, borderWidth: 1, height: 270, position: "absolute", right: 42, top: 54, transform: [{ rotate: "-28deg" }], width: 75 },
  skillPassportTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", zIndex: 2 },
  skillPassportBrand: { alignItems: "center", flexDirection: "row", gap: 8 },
  skillPassportV: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, color: "#fff", fontFamily: "Baloo2_800ExtraBold", fontSize: 19, height: 26, lineHeight: 26, textAlign: "center", width: 26 },
  skillPassportWord: { color: "#fff", fontFamily: "Baloo2_800ExtraBold", fontSize: 17, letterSpacing: -0.4 },
  skillPassportEdition: { color: "#C2C3CB", fontFamily: "Baloo2_700Bold", fontSize: 8, letterSpacing: 0.8, lineHeight: 12, textAlign: "right" },
  skillPassportChipRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 23, zIndex: 2 },
  passportChip: { backgroundColor: "#C6B577", borderColor: "#F5E7B3", borderRadius: 8, borderWidth: 1, height: 39, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8, width: 57 },
  passportStatus: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.16)", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 9, paddingVertical: 6 },
  passportStatusText: { color: "#E6E6EC", fontFamily: "Baloo2_700Bold", fontSize: 8, letterSpacing: 0.5 },
  passportStatusDot: { borderRadius: 4, height: 7, width: 7 },
  passportStatusDotLive: { backgroundColor: "#80E4B9", shadowColor: "#80E4B9", shadowOpacity: 0.9, shadowRadius: 6 },
  passportStatusDotPending: { backgroundColor: "#F6B900" },
  skillPassportMember: { marginTop: 27, zIndex: 2 },
  skillPassportLabel: { color: "#AEB0BC", fontFamily: "Baloo2_700Bold", fontSize: 8, letterSpacing: 1, lineHeight: 11 },
  skillPassportName: { color: "#fff", fontFamily: "Baloo2_800ExtraBold", fontSize: 31, letterSpacing: -1.6, lineHeight: 34, marginTop: 3 },
  skillPassportSkill: { color: "#D1D2DA", fontFamily: "Baloo2_500Medium", fontSize: 12, marginTop: 2 },
  skillPassportCred: { alignItems: "flex-end", bottom: 53, position: "absolute", right: 22, zIndex: 2 },
  skillPassportCredNumber: { color: "#fff", fontFamily: "Baloo2_800ExtraBold", fontSize: 43, letterSpacing: -2, lineHeight: 42 },
  skillPassportTiny: { color: "#AEB0BC", fontFamily: "Baloo2_700Bold", fontSize: 7, letterSpacing: 0.7 },
  skillPassportBottom: { alignItems: "flex-end", bottom: 20, flexDirection: "row", left: 22, position: "absolute", right: 22, zIndex: 2 },
  skillPassportId: { color: "#fff", fontFamily: "Baloo2_700Bold", fontSize: 10, letterSpacing: 0.7, marginTop: 1 },
  passportStripe: { backgroundColor: "#060608", height: 47, left: 0, position: "absolute", right: 0, top: 48 },
  passportBackCopy: { marginTop: 67, maxWidth: 250, zIndex: 2 },
  passportBackKicker: { color: "#FF9297", fontFamily: "Baloo2_700Bold", fontSize: 8, letterSpacing: 0.9 },
  passportBackTitle: { color: "#fff", fontFamily: "Baloo2_800ExtraBold", fontSize: 23, letterSpacing: -1, lineHeight: 25, marginTop: 3 },
  passportBackBody: { color: "#CCCDD5", fontFamily: "Baloo2_500Medium", fontSize: 10, lineHeight: 15, marginTop: 5 },
  passportBackGrid: { bottom: 46, flexDirection: "row", gap: 7, justifyContent: "space-between", left: 22, position: "absolute", right: 22, zIndex: 2 },
  passportBackItem: { borderTopColor: "rgba(255,255,255,0.18)", borderTopWidth: 1, flex: 1, paddingTop: 5 },
  passportBackItemLabel: { color: "#AEB0BC", fontFamily: "Baloo2_700Bold", fontSize: 6, letterSpacing: 0.35 },
  passportBackItemValue: { color: "#fff", fontFamily: "Baloo2_700Bold", fontSize: 9, marginTop: 1 },
  passportBackFooter: { bottom: 20, flexDirection: "row", justifyContent: "space-between", left: 22, position: "absolute", right: 22, zIndex: 2 },
  passportBackFooterText: { color: "#AEB0BC", fontFamily: "Baloo2_700Bold", fontSize: 8, letterSpacing: 0.55 },
  passportMotionHint: { color: colors.muted, fontFamily: "Baloo2_700Bold", fontSize: 10, letterSpacing: 0.4, marginTop: 11, textAlign: "center" },
  passportCard: { borderRadius: 30, padding: 25, marginBottom: 25 },
  passportHead: { flexDirection: "row", justifyContent: "space-between" },
  passportCode: {
    color: "#FFE2E6",
    fontFamily: "Baloo2_700Bold",
    fontSize: 13,
    letterSpacing: 1,
  },
  passportName: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 30,
    marginTop: 28,
  },
  passportSub: { color: "#FFE3E5", fontFamily: "Baloo2_500Medium" },
  passportStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
  },
  passportNumber: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 20,
  },
  passportLabel: {
    color: "#FFD8DD",
    fontFamily: "Baloo2_700Bold",
    fontSize: 9,
    letterSpacing: 0.7,
  },
  routeCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 17,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    marginTop: 12,
  },
  routeIcon: {
    height: 44,
    width: 44,
    borderRadius: 15,
    backgroundColor: "#FFF0F2",
    alignItems: "center",
    justifyContent: "center",
  },
  skillRow: {
    backgroundColor: "#E9F7EE",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    marginTop: 10,
  },
  houseSearch: {
    backgroundColor: "#fff",
    height: 54,
    borderRadius: 20,
    paddingHorizontal: 15,
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginVertical: 20,
  },
  houseCard: {
    backgroundColor: "#fff",
    borderRadius: 27,
    padding: 18,
    marginBottom: 16,
  },
  houseArt: {
    height: 95,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  houseMeta: {
    color: colors.primary,
    fontFamily: "Baloo2_700Bold",
    fontSize: 13,
  },
  joinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  joinText: { color: colors.primary, fontFamily: "Baloo2_800ExtraBold" },
  nearby: { alignItems: "center", padding: 19 },
  announcement: { borderRadius: 25, padding: 21, marginBottom: 16 },
  announcementTitle: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 20,
  },
  announcementText: {
    color: "#FFF3F4",
    fontFamily: "Baloo2_500Medium",
    lineHeight: 21,
    marginTop: 4,
  },
  feedActions: { flexDirection: "row", gap: 10, marginBottom: 22 },
  feedButton: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  feedButtonText: { color: colors.primary, fontFamily: "Baloo2_800ExtraBold" },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 19,
    marginTop: 12,
  },
  postBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  statBanner: {
    borderRadius: 24,
    padding: 20,
    marginVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  bannerNumber: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 24,
  },
  bannerLabel: {
    color: "#FFE0E4",
    fontFamily: "Baloo2_700Bold",
    fontSize: 9,
    letterSpacing: 0.6,
  },
  member: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  memberAvatar: {
    height: 48,
    width: 48,
    borderRadius: 17,
    backgroundColor: "#FFE3E6",
    alignItems: "center",
    justifyContent: "center",
  },
  vouched: {
    color: colors.success,
    fontFamily: "Baloo2_700Bold",
    fontSize: 12,
  },
  inviteBanner: {
    backgroundColor: "#EAEAFF",
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    marginTop: 12,
  },
  trustScore: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 17,
    marginTop: 22,
  },
  scoreNumber: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 44,
  },
  checkRow: {
    backgroundColor: "#fff",
    borderRadius: 21,
    padding: 17,
    marginTop: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusLabel: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 12,
  },
  shareCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 17,
    paddingBottom: 35,
  },
  qr: {
    height: 245,
    width: 245,
    borderRadius: 26,
    backgroundColor: "#fff",
    padding: 25,
    marginTop: 15,
  },
  qrGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  qrDot: { width: 24, height: 24, backgroundColor: "#F5F2F4", borderRadius: 3 },
  qrDark: { backgroundColor: colors.ink },
  passportId: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    letterSpacing: 1.2,
  },
  resetCopy: {
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
    fontStyle: "italic",
    textAlign: "center",
  },
  successMark: {
    height: 112,
    width: 112,
    borderRadius: 56,
    backgroundColor: "#FFE5E8",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteCode: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 22,
    letterSpacing: 2,
  },
  treeRoot: {
    backgroundColor: "#FFF0F2",
    borderRadius: 26,
    padding: 22,
    alignItems: "center",
    marginTop: 24,
  },
  rootName: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 20,
  },
  treeNode: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 15,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginLeft: 30,
  },
  refStats: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 24,
  },
  statPrimary: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 22,
    textAlign: "center",
  },
  statCaption: {
    color: colors.muted,
    fontFamily: "Baloo2_700Bold",
    fontSize: 8,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  privacy: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 17,
    marginTop: 10,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  privacyOn: { borderColor: colors.primary, backgroundColor: "#FFF7F8" },
  radio: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CFC7CC",
  },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  inviteLink: {
    backgroundColor: "#EAEAFF",
    borderRadius: 17,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const packStyles = StyleSheet.create({
  emptyHome: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 35,
  },
  neighbourhood: {
    width: "100%",
    height: 220,
    borderRadius: 38,
    backgroundColor: "#FFFDF3",
    borderWidth: 1,
    borderColor: "#E3E4FF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  communityBadge: {
    position: "absolute",
    right: 14,
    top: 14,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 17,
  },
  exploreLink: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 18,
    marginTop: 28,
  },
  wallet: { paddingBottom: 30 },
  balance: { borderRadius: 30, padding: 26, marginTop: 15 },
  balanceLabel: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 12,
  },
  balanceValue: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 37,
    marginVertical: 7,
  },
  usd: { fontFamily: "Baloo2_600SemiBold", fontSize: 15 },
  withdraw: {
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 13,
    alignSelf: "flex-start",
  },
  withdrawText: {
    color: "#B30022",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 15,
  },
  topUp: {
    borderWidth: 1,
    borderColor: "#FF9BAA",
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  topUpText: { color: "#fff", fontFamily: "Baloo2_800ExtraBold" },
  withdrawNotice: {
    backgroundColor: "#E4F7E9",
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 14,
  },
  withdrawTextDark: { color: "#287A40", fontFamily: "Baloo2_700Bold" },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  plus: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 25,
  },
  paymentCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8E6FA",
  },
  addPayment: {
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#EFB8BF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  transactions: {
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
  },
  transaction: {
    padding: 17,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#F0EDF0",
  },
  amount: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    textAlign: "right",
  },
  transactionStatus: {
    color: "#A55B66",
    fontFamily: "Baloo2_700Bold",
    fontSize: 11,
    textAlign: "right",
    textTransform: "uppercase",
  },
  safety: { paddingBottom: 30 },
  safetyTitle: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 31,
    lineHeight: 37,
    marginTop: 14,
  },
  safetyCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginTop: 14,
  },
  safetyIcon: {
    height: 42,
    width: 42,
    borderRadius: 14,
    backgroundColor: "#FFF0F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  report: {
    backgroundColor: "#29293F",
    borderRadius: 26,
    padding: 24,
    marginVertical: 24,
  },
  reportTitle: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 23,
  },
  reportButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: "center",
  },
  checklist: {
    backgroundColor: "#ECECFF",
    borderRadius: 16,
    padding: 13,
    marginTop: 9,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
  },
  settings: { paddingBottom: 112 },
  settingsHeading: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 13,
    letterSpacing: 1,
    marginTop: 27,
    marginBottom: 9,
  },
  settingsCard: {
    backgroundColor: "#fff",
    borderRadius: 26,
    overflow: "hidden",
  },
  settingItem: {
    minHeight: 82,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#F2EEF1",
  },
  settingIcon: {
    height: 43,
    width: 43,
    borderRadius: 17,
    backgroundColor: "#FFF0F1",
    alignItems: "center",
    justifyContent: "center",
  },
  version: {
    textAlign: "center",
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
    marginTop: 18,
  },
});

const flowStyles = StyleSheet.create({
  searchBox: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EFC7CC",
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginTop: 14,
  },
  searchCopy: {
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
    fontSize: 16,
  },
  tabs: { flexDirection: "row", gap: 10, marginVertical: 20 },
  tab: {
    paddingHorizontal: 20,
    height: 42,
    borderRadius: 22,
    backgroundColor: "#ECECFF",
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: colors.primary },
  tabText: { color: "#5D4549", fontFamily: "Baloo2_800ExtraBold" },
  tabTextOn: { color: "#fff" },
  list: { gap: 16, paddingBottom: 112 },
  chatCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 18,
    flexDirection: "row",
    gap: 14,
    shadowColor: "#382E39",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  chatAvatar: {
    height: 74,
    width: 74,
    borderRadius: 23,
    backgroundColor: "#FFE3E6",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  unreadDot: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: "#D10024",
    position: "absolute",
    right: 1,
    top: 1,
  },
  chatHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  time: { color: colors.muted, fontFamily: "Baloo2_500Medium", fontSize: 12 },
  jobLabel: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 12,
    letterSpacing: 0.8,
    marginTop: 3,
  },
  preview: {
    color: "#5D4549",
    fontFamily: "Baloo2_600SemiBold",
    fontSize: 16,
    marginTop: 5,
  },
  statusChip: {
    alignSelf: "flex-start",
    backgroundColor: "#E7E7E7",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 11,
  },
  statusNew: { backgroundColor: "#FFE0E0" },
  statusText: {
    color: "#57535B",
    fontFamily: "Baloo2_600SemiBold",
    fontSize: 12,
  },
  statusTextNew: { color: "#A10018" },
  chatTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  smallAvatar: {
    height: 44,
    width: 44,
    borderRadius: 16,
    backgroundColor: "#FFE3E6",
    alignItems: "center",
    justifyContent: "center",
  },
  jobBar: {
    backgroundColor: "#F0EFFF",
    padding: 16,
    marginHorizontal: -20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pricePill: {
    borderWidth: 1,
    borderColor: "#F3C4C9",
    backgroundColor: "#FFF5F6",
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  pricePillText: {
    color: "#A10018",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 14,
  },
  conversation: { paddingTop: 22, paddingBottom: 24, gap: 15 },
  safety: {
    backgroundColor: "#FFF0F1",
    borderWidth: 1,
    borderColor: "#F2B7BD",
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
  },
  safetyText: {
    color: "#74101E",
    fontFamily: "Baloo2_500Medium",
    flex: 1,
    lineHeight: 20,
  },
  messageTime: {
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
    fontSize: 11,
  },
  bubble: { maxWidth: "86%", padding: 18, borderRadius: 24 },
  bubbleMine: {
    backgroundColor: "#C90029",
    alignSelf: "flex-end",
    borderBottomRightRadius: 7,
  },
  bubbleOther: {
    backgroundColor: "#E7E4E5",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 7,
  },
  bubbleMineText: {
    color: "#fff",
    fontFamily: "Baloo2_600SemiBold",
    fontSize: 17,
    lineHeight: 25,
  },
  bubbleOtherText: {
    color: "#504B50",
    fontFamily: "Baloo2_500Medium",
    fontSize: 17,
    lineHeight: 25,
  },
  booking: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F3BFC4",
    borderRadius: 25,
    padding: 22,
    alignItems: "center",
    marginTop: 10,
  },
  bookingIcon: {
    height: 54,
    width: 54,
    borderRadius: 27,
    backgroundColor: "#FFF2F3",
    alignItems: "center",
    justifyContent: "center",
  },
  bookingTitle: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 21,
    marginTop: 12,
  },
  receipt: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
    marginTop: 14,
  },
  receiptText: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 15,
  },
  composer: {
    paddingTop: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  addButton: {
    height: 52,
    width: 52,
    borderRadius: 26,
    backgroundColor: "#E8E9FF",
    alignItems: "center",
    justifyContent: "center",
  },
  composerInput: {
    flex: 1,
    height: 52,
    backgroundColor: "#F0EFFF",
    borderRadius: 26,
    paddingHorizontal: 18,
    color: colors.ink,
    fontFamily: "Baloo2_500Medium",
    fontSize: 16,
  },
  sendButton: {
    height: 52,
    width: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  activity: { paddingBottom: 108 },
  dayLabel: {
    color: "#675F65",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 13,
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    gap: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EDE8F8",
    position: "relative",
  },
  activityIcon: {
    height: 54,
    width: 54,
    borderRadius: 17,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
  },
  activityCopy: {
    color: "#5D4549",
    fontFamily: "Baloo2_500Medium",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  profile: { paddingBottom: 108 },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 26,
    marginTop: 18,
  },
  profileAvatar: {
    height: 112,
    width: 112,
    borderRadius: 30,
    backgroundColor: "#F9D7DB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileName: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 30,
    marginTop: 20,
  },
  verifications: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  verify: {
    backgroundColor: "#E9E9FF",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifyText: {
    fontFamily: "Baloo2_600SemiBold",
    fontSize: 12,
    color: colors.ink,
  },
  statsRow: {
    borderTopWidth: 1,
    borderTopColor: "#F0E9ED",
    marginTop: 28,
    paddingTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    textAlign: "center",
  },
  statPrimary: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 25,
    textAlign: "center",
  },
  statCaption: {
    color: "#6E686F",
    fontFamily: "Baloo2_700Bold",
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
  },
  profileTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#EAE3E7",
    marginTop: 24,
  },
  profileTab: { paddingVertical: 14, paddingHorizontal: 16 },
  profileTabOn: { borderBottomWidth: 3, borderColor: colors.primary },
  profileTabText: { color: "#615B61", fontFamily: "Baloo2_700Bold" },
  profileTabTextOn: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
  },
  review: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginTop: 16,
    gap: 13,
  },
  reviewCopy: {
    color: "#513A3A",
    fontFamily: "Baloo2_500Medium",
    fontSize: 16,
    lineHeight: 24,
  },
  empty: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    marginTop: 20,
  },
});

const configuredText = Text as typeof Text & {
  defaultProps?: { style?: object };
};
configuredText.defaultProps = {
  ...(configuredText.defaultProps ?? {}),
  style: { fontFamily: "Baloo2_600SemiBold" },
};
const configuredInput = TextInput as typeof TextInput & {
  defaultProps?: { style?: object };
};
configuredInput.defaultProps = {
  ...(configuredInput.defaultProps ?? {}),
  style: { fontFamily: "Baloo2_500Medium" },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
  });
  if (!fontsLoaded)
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <SafeAreaProvider>
      <VowchAppFlow6 />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerLogo: { width: 116, height: 34, marginTop: 1 },
  app: { flex: 1, backgroundColor: colors.background },
  screen: {
    flex: 1,
    paddingHorizontal: 22,
    backgroundColor: colors.background,
  },
  scrollContent: { paddingBottom: 112 },
  header: {
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerKicker: {
    fontSize: 9,
    letterSpacing: 1.4,
    fontFamily: "Baloo2_700Bold",
    color: colors.muted,
  },
  brand: {
    color: colors.primary,
    fontSize: 27,
    fontFamily: "Baloo2_800ExtraBold",
    letterSpacing: -1,
  },
  iconButton: {
    height: 42,
    width: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    position: "relative",
  },
  dot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  search: {
    height: 54,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: "#F4F1F8",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchText: {
    flex: 1,
    fontSize: 14,
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
  },
  homeIntro: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  homeKicker: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.1,
  },
  homeTitle: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.7,
    marginTop: 7,
  },
  homeBody: {
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  primaryAction: {
    flex: 1.15,
    backgroundColor: colors.primary,
    minHeight: 46,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primaryActionText: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 13,
  },
  secondaryAction: {
    flex: 0.85,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#F7C8CB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryActionText: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 13,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 11,
  },
  sectionTitle: {
    fontSize: 21,
    fontFamily: "Baloo2_800ExtraBold",
    color: colors.ink,
  },
  sectionAction: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: "Baloo2_800ExtraBold",
  },
  gigCard: {
    backgroundColor: colors.surface,
    padding: 17,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  gigTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: colors.lavender,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pillRed: { backgroundColor: colors.primary },
  pillDark: { backgroundColor: "#251A20" },
  pillText: {
    fontSize: 10,
    fontFamily: "Baloo2_800ExtraBold",
    letterSpacing: 0.5,
    color: colors.primary,
  },
  pillTextOnDark: { color: "#fff", fontFamily: "Baloo2_500Medium" },
  price: {
    fontSize: 18,
    fontFamily: "Baloo2_800ExtraBold",
    color: colors.primary,
  },
  gigTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Baloo2_800ExtraBold",
    marginTop: 12,
  },
  gigDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 5,
    fontFamily: "Baloo2_500Medium",
  },
  gigMeta: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  gigMetaText: {
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
    fontSize: 12,
  },
  gigFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  vowchMark: { flexDirection: "row", alignItems: "center", gap: 5 },
  vowchText: {
    fontSize: 11,
    color: colors.muted,
    fontFamily: "Baloo2_700Bold",
  },
  featureImage: {
    height: 105,
    padding: 13,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  featureEmoji: { fontSize: 38, fontFamily: "Baloo2_500Medium" },
  featured: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
  },
  featureInfo: { padding: 15 },
  featureTitle: {
    fontSize: 17,
    fontFamily: "Baloo2_800ExtraBold",
    color: colors.ink,
  },
  featurePrice: {
    position: "absolute",
    right: 15,
    top: 15,
    color: colors.primary,
    fontSize: 16,
    fontFamily: "Baloo2_800ExtraBold",
  },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 12 },
  formHint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
    fontFamily: "Baloo2_500Medium",
  },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontFamily: "Baloo2_800ExtraBold",
    marginBottom: 7,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: "#FDFBFF",
    fontFamily: "Baloo2_500Medium",
  },
  textarea: { height: 116, paddingTop: 14 },
  trustNote: {
    backgroundColor: "#F0F8F5",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    flexDirection: "row",
    marginBottom: 18,
  },
  trustNoteText: {
    flex: 1,
    color: "#1D5B4A",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Baloo2_600SemiBold",
  },
  publishButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginBottom: 12,
  },
  publishText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Baloo2_800ExtraBold",
  },
  cancelButton: { alignItems: "center", padding: 10 },
  cancelText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: "Baloo2_700Bold",
  },
  detailTop: {
    marginTop: 18,
    marginBottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailTitle: {
    fontSize: 29,
    lineHeight: 35,
    fontFamily: "Baloo2_800ExtraBold",
    letterSpacing: -0.6,
    color: colors.ink,
    marginTop: 14,
  },
  detailPrice: {
    color: colors.primary,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 28,
    marginVertical: 18,
  },
  detailPriceSmall: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: "Baloo2_700Bold",
  },
  posterCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  avatar: {
    height: 42,
    width: 42,
    borderRadius: 21,
    backgroundColor: "#FFE1E5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontFamily: "Baloo2_800ExtraBold" },
  posterName: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: "Baloo2_800ExtraBold",
  },
  posterMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    fontFamily: "Baloo2_500Medium",
  },
  detailDescription: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 20,
    fontFamily: "Baloo2_500Medium",
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 17,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.muted,
    fontFamily: "Baloo2_700Bold",
  },
  infoValue: {
    marginTop: 2,
    fontSize: 14,
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
  },
  protection: {
    backgroundColor: colors.lavender,
    borderRadius: 18,
    padding: 16,
    marginTop: 4,
    marginBottom: 20,
  },
  protectionTitle: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    marginBottom: 4,
  },
  protectionText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
  },
  messageRow: {
    paddingVertical: 17,
    flexDirection: "row",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  messageText: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Baloo2_500Medium",
  },
  messageTime: { alignItems: "flex-end", gap: 7 },
  timeText: {
    fontSize: 10,
    color: colors.muted,
    fontFamily: "Baloo2_500Medium",
  },
  unread: {
    height: 18,
    minWidth: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Baloo2_800ExtraBold",
  },
  passport: { borderRadius: 28, padding: 21, overflow: "hidden" },
  passportTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  passportV: { color: "#fff", fontSize: 26, fontFamily: "Baloo2_800ExtraBold" },
  passportNumber: {
    color: "#FFDCE2",
    fontSize: 10,
    fontFamily: "Baloo2_800ExtraBold",
    letterSpacing: 1,
    marginTop: 40,
  },
  passportName: {
    color: "#fff",
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 26,
    marginTop: 7,
  },
  passportSkill: {
    color: "#FFDCE2",
    fontSize: 13,
    marginTop: 3,
    fontFamily: "Baloo2_500Medium",
  },
  stats: { flexDirection: "row", gap: 35, marginTop: 29 },
  statNumber: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Baloo2_800ExtraBold",
    textAlign: "center",
  },
  statLabel: {
    color: "#FFDCE2",
    fontSize: 10,
    fontFamily: "Baloo2_700Bold",
    marginTop: 2,
    textAlign: "center",
  },
  lineage: {
    borderTopWidth: 1,
    borderTopColor: "#E45167",
    marginTop: 22,
    paddingTop: 14,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  lineageText: { color: "#fff", fontSize: 11, fontFamily: "Baloo2_700Bold" },
  passportList: { marginTop: 18 },
  settingRow: {
    minHeight: 62,
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
    paddingHorizontal: 15,
    marginBottom: 9,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  settingText: {
    flex: 1,
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 14,
  },
  houseStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 20,
    marginBottom: 28,
  },
  memberRow: {
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    position: "relative",
  },
  memberLine: {
    height: 36,
    width: 2,
    backgroundColor: "#E5BCC5",
    marginLeft: 10,
  },
  memberLineRoot: { backgroundColor: colors.primary },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    gap: 12,
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "center",
  },
  noticeIcon: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: colors.rose,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeText: {
    color: colors.ink,
    fontFamily: "Baloo2_800ExtraBold",
    fontSize: 13,
    lineHeight: 18,
  },
  profileHero: { alignItems: "center", paddingBottom: 24 },
  profileAvatar: { height: 80, width: 80, borderRadius: 40, marginBottom: 4 },
  profileInitials: {
    color: colors.primary,
    fontSize: 25,
    fontFamily: "Baloo2_800ExtraBold",
  },
  trustSummary: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rating: {
    color: colors.primary,
    fontSize: 28,
    fontFamily: "Baloo2_800ExtraBold",
  },
  nav: {
    height: 76,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: "#FFFFFFFA",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navItem: { alignItems: "center", minWidth: 47, gap: 3 },
  navText: { color: colors.muted, fontSize: 9, fontFamily: "Baloo2_700Bold" },
  navActive: { color: colors.primary, fontFamily: "Baloo2_500Medium" },
  fab: {
    height: 49,
    width: 49,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: colors.primary,
    shadowOpacity: 0.33,
    shadowRadius: 10,
    elevation: 5,
  },
});
