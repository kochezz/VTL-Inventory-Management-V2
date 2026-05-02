import React, { useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Animated, Alert, Platform, StatusBar
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { COLORS, RADIUS, SHADOW } from "../constants/theme";
import { useAuthStore } from "../stores/authStore";

const ROLE_COLORS: Record<string, string> = {
  admin:        COLORS.red,
  ceo:          COLORS.sky,
  cfo:          COLORS.purple,
  manager:      COLORS.amber,
  qa:           COLORS.teal,
  engineering:  COLORS.green,
  sales:        COLORS.green,
  staff:        COLORS.textSecondary,
  operator:     COLORS.textSecondary,
  super_viewer: COLORS.sky,
  viewer:       COLORS.textMuted,
};

const ROLE_LABELS: Record<string, string> = {
  admin:        "System Admin",
  ceo:          "Chief Executive",
  cfo:          "Chief Finance",
  manager:      "Manager",
  qa:           "QA Officer",
  engineering:  "Engineering",
  sales:        "Sales",
  staff:        "Staff",
  operator:     "Operator",
  super_viewer: "Super Viewer",
  viewer:       "Viewer",
};

interface VTLAppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

const VTLAppHeader: React.FC<VTLAppHeaderProps> = ({
  title, subtitle, showBack, onBack, rightElement
}) => {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const roleColor = ROLE_COLORS[(user.role as string)] ?? COLORS.sky;
  const roleLabel = ROLE_LABELS[(user.role as string)] ?? (user.role as string);

  const initials = ((user.full_name || user.email || "U") as string)
    .split(" ")
    .map((n: string) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const toggleMenu = () => {
    const toValue = menuOpen ? 0 : 1;
    setMenuOpen(!menuOpen);
    Animated.spring(menuAnim, {
      toValue, tension: 80, friction: 8, useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    setMenuOpen(false);
    Animated.timing(menuAnim, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start();
  };

  const handleLogout = () => {
    closeMenu();
    Alert.alert(
      "Sign Out",
      `Sign out as ${(user.full_name || user.email) as string}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            queryClient.clear();
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  const menuOpacity = menuAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, 1],
  });
  const menuScale = menuAnim.interpolate({
    inputRange: [0, 1], outputRange: [0.92, 1],
  });
  const menuTransY = menuAnim.interpolate({
    inputRange: [0, 1], outputRange: [-10, 0],
  });

  const withOpacity = (hex: string, pct: number) => {
    const alpha = Math.round(pct * 255).toString(16).padStart(2, "0");
    return hex + alpha;
  };

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" />

      {/* ── HEADER BAR ── */}
      <View style={styles.container}>
        <View style={styles.row}>

          {/* LEFT: back arrow or VTL logo */}
          {showBack ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack ?? (() => router.back())}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.logoCircle, { borderColor: roleColor }]}>
              <Image
                source={require("../assets/vtl-app-logo.png")}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
          )}

          {/* CENTER: title or app name */}
          <View style={styles.center}>
            {title ? (
              <>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle && (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.appName}>VTL Executive</Text>
                <Text style={styles.appSub} numberOfLines={1}>
                  {(user.full_name || user.email) as string}
                </Text>
              </>
            )}
          </View>

          {/* RIGHT: optional element + avatar */}
          <View style={styles.right}>
            {rightElement}
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={toggleMenu}
              activeOpacity={0.8}
            >
              <View style={[styles.avatar, {
                backgroundColor: withOpacity(roleColor, 0.15),
                borderColor: roleColor,
              }]}>
                <Text style={[styles.avatarText, { color: roleColor }]}>
                  {initials}
                </Text>
              </View>
              {/* Role colour dot */}
              <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── DROPDOWN MENU ── */}
      {menuOpen && (
        <>
          {/* Invisible overlay to catch outside taps */}
          <TouchableOpacity
            style={styles.overlay}
            onPress={closeMenu}
            activeOpacity={1}
          />
          <Animated.View style={[styles.menu, {
            opacity: menuOpacity,
            transform: [
              { scale: menuScale },
              { translateY: menuTransY },
            ],
          }]}>

            {/* Menu header with large avatar */}
            <View style={styles.menuHeader}>
              <View style={[styles.menuAvatar, {
                backgroundColor: withOpacity(roleColor, 0.15),
                borderColor: roleColor,
              }]}>
                <Text style={[styles.menuAvatarText, { color: roleColor }]}>
                  {initials}
                </Text>
              </View>
              <View style={styles.menuUserInfo}>
                <Text style={styles.menuName}>
                  {(user.full_name || user.email) as string}
                </Text>
                <View style={[styles.roleBadge, {
                  backgroundColor: withOpacity(roleColor, 0.15),
                }]}>
                  <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                    {roleLabel}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Info rows */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>EMAIL</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {user.email as string}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ACCESS LEVEL</Text>
              <Text style={styles.infoValue}>{roleLabel}</Text>
            </View>

            <View style={styles.divider} />

            {/* Sign Out button */}
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  );
};

export default VTLAppHeader;

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    zIndex: 100,
  },
  container: {
    backgroundColor: COLORS.surface,
    paddingTop: Platform.OS === "ios" ? 52 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  backIcon: {
    fontSize: 20, color: COLORS.textPrimary, fontWeight: "300",
  },
  logoCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  logoImg: { width: 26, height: 26 },
  center: { flex: 1 },
  title: {
    fontSize: 17, fontWeight: "700", color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 11, color: COLORS.textSecondary, marginTop: 1,
  },
  appName: {
    fontSize: 16, fontWeight: "800",
    color: COLORS.textPrimary, letterSpacing: 0.5,
  },
  appSub: {
    fontSize: 11, color: COLORS.textMuted, marginTop: 1,
  },
  right: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  avatarBtn: { position: "relative" },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700" },
  roleDot: {
    position: "absolute", bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: COLORS.surface,
  },
  overlay: {
    position: "absolute",
    top: 0, left: -16, right: -16,
    height: 1200,
    zIndex: 98,
  },
  menu: {
    position: "absolute",
    top: 68, right: 0,
    width: 256,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderBright,
    zIndex: 99,
    ...SHADOW.card,
  },
  menuHeader: {
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 10,
  },
  menuAvatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  menuAvatarText: { fontSize: 17, fontWeight: "700" },
  menuUserInfo: { flex: 1, gap: 5 },
  menuName: {
    fontSize: 14, fontWeight: "700", color: COLORS.textPrimary,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 10, fontWeight: "700", letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 14,
  },
  infoRow: {
    paddingHorizontal: 14, paddingVertical: 9,
  },
  infoLabel: {
    fontSize: 10, color: COLORS.textMuted,
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13, color: COLORS.textSecondary, fontWeight: "500",
  },
  signOutBtn: {
    margin: 14, paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    alignItems: "center",
  },
  signOutText: {
    fontSize: 14, fontWeight: "700", color: COLORS.red,
  },
});
