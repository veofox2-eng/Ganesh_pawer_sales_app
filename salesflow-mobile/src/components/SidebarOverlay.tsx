import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity, Modal, TouchableWithoutFeedback, Easing, SafeAreaView, ScrollView } from 'react-native';
import { useSidebar } from '../context/SidebarContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import * as Application from 'expo-application';
import { 
  IconCloseCircle, 
  IconPeopleOutline, 
  IconDocumentText, 
  IconChecklist, 
  IconMapOutline, 
  IconCallOutline, 
  IconActivity, 
  IconFolder, 
  IconLogout,
  IconSun,
  IconMoon,
  IconTrendingUp,
  IconMap,
  IconShieldOutline
} from '../lib/Icons';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.8;

export default function SidebarOverlay() {
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const navigation = useNavigation<NavigationProp<any>>();
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const pkg = Application?.applicationId || '';
  const isSuperAdminApp = pkg.includes('superadmin');
  const isAdminApp = (pkg.includes('admin') && !isSuperAdminApp) || profile?.role === 'Admin';

  useEffect(() => {
    if (isSidebarOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 90,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [isSidebarOpen]);

  // Handle navigation
  const navigateTo = (screen: string) => {
    closeSidebar();
    setTimeout(() => {
      navigation.navigate(screen);
    }, 250); // wait for animation to complete
  };

  const handleSignOut = () => {
    closeSidebar();
    setTimeout(() => {
      signOut();
    }, 250);
  };

  if (!isSidebarOpen && (slideAnim as any)._value === -SIDEBAR_WIDTH) {
    // Return null completely when fully closed to avoid trapping gestures
    return null;
  }

  return (
    <Modal visible={isSidebarOpen} transparent={true} animationType="none" onRequestClose={closeSidebar}>
      <View style={styles.overlayContainer}>
        {/* Dark Backdrop */}
        <TouchableWithoutFeedback onPress={closeSidebar}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Sidebar Content */}
        <Animated.View style={[
          styles.sidebar, 
          { 
            backgroundColor: colors.bgCard,
            transform: [{ translateX: slideAnim }] 
          }
        ]}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.profileBox}>
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <Text style={styles.avatarText}>{(profile?.username || user?.email || 'U').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.profileText}>
                  <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                    {profile?.username || 'User'}
                  </Text>
                  <Text style={[styles.role, { color: colors.textMuted }]}>
                    {profile?.feature_flags?.industry_position || profile?.role || 'Employee'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
                {isDark ? <IconSun size={24} color={colors.warning} /> : <IconMoon size={24} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Navigation Links */}
            <ScrollView style={styles.navLinks} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              
              {!isSuperAdminApp && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>MAIN</Text>
                  
                  {isAdminApp ? (
                    <>
                      <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Insights')}>
                    <IconTrendingUp size={22} color={colors.accent} />
                    <Text style={[styles.navText, { color: colors.textPrimary }]}>Insights</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Sales Team')}>
                    <IconPeopleOutline size={22} color={colors.accent} />
                    <Text style={[styles.navText, { color: colors.textPrimary }]}>Sales Team</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Field Team')}>
                    <IconMap size={22} color={colors.accent} />
                    <Text style={[styles.navText, { color: colors.textPrimary }]}>Field Team</Text>
                  </TouchableOpacity>
                  
                  {/* Approvals tab removed */}
                </>
              ) : (
                <>
                  {profile?.feature_flags?.dashboards?.client !== false && (
                    <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Clients')}>
                      <IconPeopleOutline size={22} color={colors.accent} />
                      <Text style={[styles.navText, { color: colors.textPrimary }]}>Clients</Text>
                    </TouchableOpacity>
                  )}
                  
                  {profile?.feature_flags?.dashboards?.leads !== false && (
                    <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Leads')}>
                      <IconDocumentText size={22} color={colors.accent} />
                      <Text style={[styles.navText, { color: colors.textPrimary }]}>Leads</Text>
                    </TouchableOpacity>
                  )}
                  
                  {profile?.feature_flags?.dashboards?.task !== false && (
                    <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Tasks')}>
                      <IconChecklist size={22} color={colors.accent} />
                      <Text style={[styles.navText, { color: colors.textPrimary }]}>Tasks</Text>
                    </TouchableOpacity>
                  )}
                  
                  {profile?.role === 'Field' && profile?.feature_flags?.dashboards?.map !== false && (
                    <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Map')}>
                      <IconMapOutline size={22} color={colors.accent} />
                      <Text style={[styles.navText, { color: colors.textPrimary }]}>Map</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Shared By Me')}>
                    <Ionicons name="share-social-outline" size={22} color={colors.accent} />
                    <Text style={[styles.navText, { color: colors.textPrimary }]}>Shared By Me</Text>
                  </TouchableOpacity>
                </>
              )}
              </>
            )}

            {!isAdminApp && !isSuperAdminApp && (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 16 }]} />
                  
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>RECORDS & STATUS</Text>

                  {profile?.feature_flags?.dashboards?.call_logs !== false && (
                    <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Call Log')}>
                      <IconCallOutline size={22} color={colors.purple || colors.accent} />
                      <Text style={[styles.navText, { color: colors.textPrimary }]}>Call Logs</Text>
                    </TouchableOpacity>
                  )}
                  
                  {profile?.feature_flags?.dashboards?.other_records !== false && (
                    <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Other Records')}>
                      <IconFolder size={22} color={colors.purple || colors.accent} />
                      <Text style={[styles.navText, { color: colors.textPrimary }]}>Other Records</Text>
                    </TouchableOpacity>
                  )}

                  {profile?.feature_flags?.dashboards?.my_status !== false && (
                    <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Status')}>
                      <IconActivity size={22} color={colors.purple || colors.accent} />
                      <Text style={[styles.navText, { color: colors.textPrimary }]}>My Status</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              
              {isSuperAdminApp && (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
                  <Ionicons name="shield-checkmark-outline" size={48} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, marginTop: 16, fontWeight: '600' }}>Super Admin System</Text>
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: colors.border, marginTop: 16, marginBottom: 16 }]} />

              {/* Footer Items Moved Inside ScrollView */}
              {profile?.feature_flags?.dashboards?.settings !== false && (
                <TouchableOpacity style={styles.navItem} onPress={() => navigateTo('Settings')}>
                  <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
                  <Text style={[styles.navText, { color: colors.textPrimary }]}>Settings</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.navItem, { marginBottom: 40 }]} onPress={handleSignOut}>
                <IconLogout size={22} color="#EF4444" />
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 40,
  },
  profileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileText: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  role: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  themeBtn: {
    padding: 8,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  navLinks: {
    flex: 1,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 8,
  },
  navText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
  },
});
