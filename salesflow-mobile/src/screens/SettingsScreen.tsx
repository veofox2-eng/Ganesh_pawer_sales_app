import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { spacing, radius } from '../theme';
import { IconChevronBack } from '../lib/Icons';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

export default function SettingsScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { profile } = useAuth();
  
  const pkg = Application?.applicationId || '';
  const isSuperAdminApp = pkg.includes('superadmin') || profile?.role === 'SuperAdmin';
  
  // Local state for toggles (these would typically sync to AsyncStorage or backend)
  const [notifications, setNotifications] = useState(true);
  const [callRecord, setCallRecord] = useState(true);

  const openOverlaySettings = () => {
    if (Platform.OS === 'android') {
      IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.MANAGE_OVERLAY_PERMISSION,
        { data: `package:${Application.applicationId}` }
      ).catch(e => console.log('Failed to open overlay settings', e));
    }
  };

  const openAppInfoSettings = () => {
    if (Platform.OS === 'android') {
      IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: `package:${Application.applicationId}` }
      ).catch(e => console.log('Failed to open app info settings', e));
    }
  };

  const openAutoStart = () => {
    if (Platform.OS === 'android') {
      import('react-native').then(({ NativeModules }) => {
        NativeModules.CallRecordingModule?.openAutoStartSettings?.();
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <IconChevronBack size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        {isSuperAdminApp && (
          <View style={[styles.section, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.accent }]}>APP PREFERENCES</Text>
            
            <View style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Notification Control</Text>
              <Switch 
                value={notifications} 
                onValueChange={setNotifications} 
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={'#fff'}
              />
            </View>

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Automatic Call Record</Text>
              <Switch 
                value={callRecord} 
                onValueChange={setCallRecord} 
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={'#fff'}
              />
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>SYSTEM PERMISSIONS</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Manage OS-level permissions required for advanced features.
          </Text>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentLight }]} onPress={openOverlaySettings}>
            <Text style={[styles.actionBtnText, { color: colors.accent }]}>Display Over Other Apps</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentLight }]} onPress={openAutoStart}>
            <Text style={[styles.actionBtnText, { color: colors.accent }]}>Background Auto-Startup</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }]} onPress={openAppInfoSettings}>
            <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Manual Permissions Control</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '700', fontFamily: 'sans-serif' },
  placeholder: { width: 40 },
  
  scroll: { padding: spacing.lg },
  section: {
    borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700',
    marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase',
    fontFamily: 'sans-serif'
  },
  sectionSubtitle: {
    fontSize: 13, marginBottom: 16, lineHeight: 20
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLabel: { fontSize: 15, fontWeight: '500', fontFamily: 'sans-serif' },
  
  actionBtn: {
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: radius.md, marginBottom: 12,
    alignItems: 'center', justifyContent: 'center'
  },
  actionBtnText: {
    fontSize: 14, fontWeight: '700', fontFamily: 'sans-serif'
  }
});
