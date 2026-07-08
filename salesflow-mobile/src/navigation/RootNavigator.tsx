import React, { useEffect, useCallback, useState } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, Alert, AppState, Pressable, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import * as Application from 'expo-application';
import { supabase } from '../lib/supabase';
import { useCallRecorder } from '../hooks/useCallRecorder';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSidebar } from '../context/SidebarContext';
import SidebarOverlay from '../components/SidebarOverlay';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '../lib/BackgroundLocation';
import { useLiveLocation } from '../hooks/useLiveLocation';

// Custom SVG Icons
import {
  IconPeopleFilled, IconPeopleOutline,
  IconCheckCircle, IconCheckCircleOutline,
  IconCall, IconCallOutline,
  IconShield, IconShieldOutline,
  IconMap, IconTrendingUp, IconLogout, IconAttach,
  IconDocumentText, IconChecklist, IconMapOutline, IconMenu
} from '../lib/Icons';
import LogoutConfirmModal from '../components/LogoutConfirmModal';

// ── Common screens
import AuthScreen from '../screens/AuthScreen';
import LoginRoleScreen from '../screens/LoginRoleScreen';
import SuperAdminLoginScreen from '../screens/SuperAdminLoginScreen';
import PendingApprovalScreen from '../screens/PendingApprovalScreen';
import AttachmentsScreen from '../screens/AttachmentsScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';

// ── Employee-only screens
import CallSheetScreen from '../screens/CallSheetScreen';
import ClientDetailScreen from '../screens/ClientDetailScreen';
import TaskBoardScreen from '../screens/TaskBoardScreen';
import CallHistoryScreen from '../screens/CallHistoryScreen';
import FieldTrackingScreen from '../screens/FieldTrackingScreen';
import DialerScreen from '../screens/DialerScreen';
import ClientStatusScreen from '../screens/ClientStatusScreen';
import LeadSectionScreen from '../screens/LeadSectionScreen';
import LeadProfileDetailScreen from '../screens/LeadProfileDetailScreen';
import OtherRecordsScreen from '../screens/OtherRecordsScreen';
import SettingsScreen from '../screens/SettingsScreen';

// ── Admin-only screens
import AdminSalesListScreen from '../screens/AdminSalesListScreen';
import AdminFieldListScreen from '../screens/AdminFieldListScreen';
import AdminEmployeeDetailScreen from '../screens/AdminEmployeeDetailScreen';
import AdminApprovalsScreen from '../screens/AdminApprovalsScreen';
import AdminCreateUserScreen from '../screens/AdminCreateUserScreen';
import AdminUserDetailScreen from '../screens/AdminUserDetailScreen';
import AdminClientStatusScreen from '../screens/AdminClientStatusScreen';

// ── SuperAdmin screens
import SuperAdminDashboardScreen from '../screens/SuperAdminDashboardScreen';
import SuperAdminUserControlScreen from '../screens/SuperAdminUserControlScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS & SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function CallSheetStack() {
  return (
    <Stack.Navigator id="call-sheet-stack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CallSheetList" component={CallSheetScreen} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen name="Dialer" component={DialerScreen} />
      <Stack.Screen name="Attachments" component={AttachmentsScreen} />
    </Stack.Navigator>
  );
}

function LeadsStack() {
  return (
    <Stack.Navigator id="leads-stack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeadSectionList" component={LeadSectionScreen} />
      <Stack.Screen name="LeadProfileDetail" component={LeadProfileDetailScreen} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN STACKS
// ─────────────────────────────────────────────────────────────────────────────

function AdminSalesStack() {
  return (
    <Stack.Navigator id="admin-sales-stack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminSalesList" component={AdminSalesListScreen} />
      <Stack.Screen name="AdminEmployeeDetail" component={AdminEmployeeDetailScreen} />
      <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen name="Dialer" component={DialerScreen} />
      <Stack.Screen name="Attachments" component={AttachmentsScreen} />
      <Stack.Screen name="LeadProfileDetail" component={LeadProfileDetailScreen} />
    </Stack.Navigator>
  );
}

function AdminFieldStack() {
  return (
    <Stack.Navigator id="admin-field-stack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminFieldList" component={AdminFieldListScreen} />
      <Stack.Screen name="AdminEmployeeDetail" component={AdminEmployeeDetailScreen} />
      <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen name="Dialer" component={DialerScreen} />
      <Stack.Screen name="Attachments" component={AttachmentsScreen} />
      <Stack.Screen name="LeadProfileDetail" component={LeadProfileDetailScreen} />
    </Stack.Navigator>
  );
}

// Removed AdminApprovalsStack since approvals are now handled strictly via backend account creation.

function AdminMainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut, profile } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <>
      <Tab.Navigator
        id="admin-tabs"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { display: 'none' },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
          tabBarIcon: ({ focused, color, size }: any) => {
            const s = 24;
            if (route.name === 'Insights') return <IconTrendingUp size={s} color={color} />;
            if (route.name === 'Sales Team') return focused ? <IconPeopleFilled size={s} color={color} /> : <IconPeopleOutline size={s} color={color} />;
            if (route.name === 'Field Team') return <IconMap size={s} color={color} />;
            if (route.name === 'Approvals') return focused ? <IconShield size={s} color={color} /> : <IconShieldOutline size={s} color={color} />;
            return null;
          },
        })}
      >
        {profile?.feature_flags?.dashboards?.admin_sales !== false && (
          <Tab.Screen name="Sales Team" component={AdminSalesStack} />
        )}
        {profile?.feature_flags?.dashboards?.admin_field !== false && (
          <Tab.Screen name="Field Team" component={AdminFieldStack} />
        )}
        {/* Removed Approvals Tab */}
        <Tab.Screen name="Insights" component={AdminClientStatusScreen} />
        <Tab.Screen 
          name="Logout" 
          component={View} 
          options={{ 
            tabBarIcon: ({ color }) => <IconLogout size={24} color={color} />,
            tabBarButton: (props: any) => (
              <Pressable {...props} onPress={() => setShowLogoutConfirm(true)}>
                {props.children}
              </Pressable>
            )
          }}
        />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null }} />
      </Tab.Navigator>

      <LogoutConfirmModal
        visible={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => { setShowLogoutConfirm(false); signOut(); }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE STACKS
// ─────────────────────────────────────────────────────────────────────────────

function EmployeeMainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const isField = profile?.role === 'Field';

  return (
    <Tab.Navigator
      id="employee-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { display: 'none' },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
        tabBarIcon: ({ focused, color, size }: any) => {
          const s = 24;
          if (route.name === 'Clients') return <IconPeopleOutline size={s} color={color} />;
          if (route.name === 'Leads') return <IconDocumentText size={s} color={color} />;
          if (route.name === 'Tasks') return <IconChecklist size={s} color={color} />;
          if (route.name === 'Map') return <IconMapOutline size={s} color={color} />;
          return null;
        },
      })}
    >
      {profile?.feature_flags?.dashboards?.client !== false && (
        <Tab.Screen name="Clients" component={CallSheetStack} />
      )}
      {profile?.feature_flags?.dashboards?.leads !== false && (
        <Tab.Screen name="Leads" component={LeadsStack} />
      )}
      {profile?.feature_flags?.dashboards?.task !== false && (
        <Tab.Screen name="Tasks" component={TaskBoardScreen} />
      )}
      {isField && profile?.feature_flags?.dashboards?.map !== false && <Tab.Screen name="Map" component={FieldTrackingScreen} />}
      
      {/* Hidden Screens for Sidebar Navigation ONLY */}
      {profile?.feature_flags?.dashboards?.call_logs !== false && (
        <Tab.Screen name="Call Log" component={CallHistoryScreen} options={{ tabBarButton: () => null }} />
      )}
      {profile?.feature_flags?.dashboards?.my_status !== false && (
        <Tab.Screen name="Status" component={ClientStatusScreen} options={{ tabBarButton: () => null }} />
      )}
      {profile?.feature_flags?.dashboards?.other_records !== false && (
        <Tab.Screen name="Other Records" component={OtherRecordsScreen} options={{ tabBarButton: () => null }} />
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null }} />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN STACKS
// ─────────────────────────────────────────────────────────────────────────────

function SuperAdminStack() {
  return (
    <Stack.Navigator id="superadmin-stack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SuperAdminDashboard" component={SuperAdminDashboardScreen} />
      <Stack.Screen name="SuperAdminUserControl" component={SuperAdminUserControlScreen} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT NAVIGATOR
// ─────────────────────────────────────────────────────────────────────────────

export default function RootNavigator() {
  const { session, loading, profile, isApproved } = useAuth();
  const { colors } = useTheme();
  const { openSidebar } = useSidebar();
  
  // Register call recorder listener
  useCallRecorder();
  
  // Register global live location tracker for Field employees
  useLiveLocation();

  useEffect(() => {
    // Check if background services are enabled for this user
    const locationEnabled = profile?.feature_flags?.background?.live_location !== false;
    
    if (session?.user && profile?.role === 'Field' && locationEnabled) {
      startBackgroundLocationTracking().catch(console.error);
    } else {
      stopBackgroundLocationTracking().catch(console.error);
    }
  }, [session?.user, profile?.role, profile?.feature_flags?.background?.live_location]);

  useEffect(() => {
    if (!session?.user || !isApproved || !profile?.username) return;
    const pkg = Application.applicationId || '';
    if (pkg.includes('superadmin')) return;

    const checkPerms = () => {
      import('react-native').then(({ NativeModules, Platform }) => {
        if (Platform.OS === 'android') {
          NativeModules.CallRecordingModule?.requestSpecialPermissions?.();
        }
      });
    };

    // Only run this ONCE per login, do NOT attach to AppState.change to prevent infinite loops 
    // when returning from the Settings app.
    const timeout = setTimeout(checkPerms, 1500);

    return () => {
      clearTimeout(timeout);
    };
  }, [session?.user, isApproved, profile?.username]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const pkg = Application?.applicationId || '';
  const isSuperAdminApp = pkg.includes('superadmin') || profile?.role === 'SuperAdmin';
  const isAdminApp = pkg.includes('admin') || profile?.role === 'Admin';
  const needsProfileCompletion = session && isApproved && !profile?.username && !isSuperAdminApp;

  return (
    <NavigationContainer>
      <Stack.Navigator id="root-stack" screenOptions={{ headerShown: false }}>
        {!session ? (
          pkg.includes('superadmin') ? (
            <Stack.Screen name="SuperAdminLogin" component={SuperAdminLoginScreen} />
          ) : (
            <>
              <Stack.Screen name="LoginRole" component={LoginRoleScreen} />
              <Stack.Screen name="Auth" component={AuthScreen} />
            </>
          )
        ) : !isApproved ? (
          <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
        ) : needsProfileCompletion ? (
          <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
        ) : isSuperAdminApp ? (
          <Stack.Screen name="SuperAdminMain" component={SuperAdminStack} />
        ) : isAdminApp ? (
          <Stack.Screen name="AdminMain" component={AdminMainTabs} />
        ) : (
          <Stack.Screen name="EmployeeMain" component={EmployeeMainTabs} />
        )}
      </Stack.Navigator>
      
      {/* Global Sidebar Overlay & FAB - Hidden for SuperAdmin */}
      {session && isApproved && !isSuperAdminApp && (
        <>
          <SidebarOverlay />
          <TouchableOpacity
            onPress={openSidebar}
            activeOpacity={0.8}
            style={{
              position: 'absolute',
              bottom: 40,
              right: 20,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              zIndex: 9999
            }}
          >
            <IconMenu size={28} color="#fff" />
          </TouchableOpacity>
        </>
      )}
    </NavigationContainer>
  );
}
