import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Switch, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconChevronBack } from '../lib/Icons';

const DEFAULT_FEATURES = {
  dashboards: {
    client: true,
    task: true,
    leads: true,
    call_logs: true,
    other_records: true,
    my_status: true,
    admin_sales: true,
    admin_field: true,
    admin_approvals: true,
    map: true,
    settings: true
  },
  actions: {
    dialer: true,
    whatsapp: true,
    upload_files: true,
    voice_record: true,
    edit_profile: true
  },
  background: {
    auto_call_record: true,
    live_location: true
  }
};

export default function SuperAdminUserControlScreen({ route, navigation }: any) {
  const { profile } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [features, setFeatures] = useState<any>(
    profile.feature_flags && Object.keys(profile.feature_flags).length > 0 
      ? profile.feature_flags 
      : DEFAULT_FEATURES
  );

  async function toggleFeature(category: string, key: string, value: boolean) {
    const updated = {
      ...features,
      [category]: {
        ...(features[category] || {}),
        [key]: value
      }
    };
    
    // Ensure all categories exist if they were missing
    if (!updated.dashboards) updated.dashboards = DEFAULT_FEATURES.dashboards;
    if (!updated.actions) updated.actions = DEFAULT_FEATURES.actions;
    if (!updated.background) updated.background = DEFAULT_FEATURES.background;

    setFeatures(updated);

    const { error } = await supabase
      .from('profiles')
      .update({ feature_flags: updated })
      .eq('id', profile.id);

    if (error) {
      Alert.alert('Error', 'Failed to update feature flag: ' + error.message);
    }
  }

  const renderToggle = (category: string, key: string, label: string) => {
    // If a category was missing entirely, fall back to default true
    const catObj = features[category] || (DEFAULT_FEATURES as any)[category];
    const isEnabled = catObj[key] !== false; // true if missing or true

    return (
      <View style={styles.toggleRow} key={key}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Switch 
          value={isEnabled} 
          onValueChange={(val) => toggleFeature(category, key, val)}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={'#fff'}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <IconChevronBack size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>{profile.full_name}</Text>
          <Text style={styles.subtitle}>{profile.role} Features</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DASHBOARDS & MAIN SCREENS</Text>
          {profile.role.includes('Admin') ? (
            <>
              {renderToggle('dashboards', 'admin_sales', 'Sales Team Monitoring')}
              {renderToggle('dashboards', 'admin_field', 'Field Team Monitoring')}
              {renderToggle('dashboards', 'admin_approvals', 'Approvals Dashboard')}
            </>
          ) : profile.role === 'Field' ? (
            <>
              {renderToggle('dashboards', 'map', 'Map')}
              {renderToggle('dashboards', 'client', 'Clients')}
              {renderToggle('dashboards', 'task', 'Timeline')}
              {renderToggle('dashboards', 'call_logs', 'Call Log')}
              {renderToggle('dashboards', 'other_records', 'Other Records')}
              {renderToggle('dashboards', 'leads', 'Leads')}
            </>
          ) : (
            <>
              {renderToggle('dashboards', 'client', 'Clients')}
              {renderToggle('dashboards', 'task', 'Timeline')}
              {renderToggle('dashboards', 'call_logs', 'Call Log')}
              {renderToggle('dashboards', 'other_records', 'Other Records')}
              {renderToggle('dashboards', 'leads', 'Leads')}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CLIENT & LEAD ACTIONS</Text>
          {renderToggle('actions', 'dialer', 'Dialer & Calling')}
          {renderToggle('actions', 'whatsapp', 'Send WhatsApp Messages')}
          {renderToggle('actions', 'upload_files', 'Upload Files & Documents')}
          {renderToggle('actions', 'voice_record', 'Voice Record in Notes')}
          {renderToggle('actions', 'edit_profile', 'Edit Client Profile')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BACKGROUND SERVICES</Text>
          {renderToggle('background', 'auto_call_record', 'Automatic Call Recording')}
          {renderToggle('background', 'live_location', 'Live Location Tracking')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GLOBAL FEATURES</Text>
          {renderToggle('dashboards', 'settings', 'Settings Menu Access')}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitles: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textSecondary, marginLeft: 16, fontFamily: 'sans-serif' },
  subtitle: { fontSize: 13, color: colors.textMuted },
  
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  section: {
    backgroundColor: colors.bgPanel, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.accent,
    marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase',
    fontFamily: 'sans-serif'
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  toggleLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500', fontFamily: 'sans-serif' }
});
