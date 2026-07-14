import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import * as Application from 'expo-application';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { 
  IconShield, IconTrendingUp, IconMap, IconChevronRight,
  IconPeopleFilled
} from '../lib/Icons';

export default function LoginRoleScreen({ navigation }: any) {
  const { colors } = useTheme();

  // Detect flavor from native application ID (package name)
  const pkg = (Application.applicationId || '').toLowerCase();
  const isSuperAdminApp = pkg.includes('superadmin');
  const isAdminApp = pkg.includes('admin') && !isSuperAdminApp;

  const config = useMemo(() => {
    if (isSuperAdminApp) return {
      title: 'Super Admin HQ',
      sub: 'Total control over employee features and permissions.',
    };
    if (isAdminApp) return {
      title: 'Admin Command Center',
      sub: 'Manage employees, approvals, and global insights.',
    };
    return {
      title: 'SalesFlow Employee Portal',
      sub: 'Manage clients, track tasks, and log your daily operations.',
    };
  }, [isAdminApp, isSuperAdminApp]);

  const handleSelectRole = (role: 'SuperAdmin' | 'Admin' | 'User' | 'Field', mode: 'signin' | 'signup' = 'signin') => {
    navigation.navigate('Auth', { role, mode });
  };

  const RoleCard = ({ 
    role, 
    title, 
    desc, 
    icon: Icon, 
    color 
  }: { 
    role: 'SuperAdmin' | 'Admin' | 'User' | 'Field', 
    title: string, 
    desc: string, 
    icon: any, 
    color: string 
  }) => {
    return (
      <TouchableOpacity
        style={[
          styles.card, 
          { backgroundColor: colors.bgCard, borderColor: colors.border }
        ]}
        onPress={() => handleSelectRole(role)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
          <Icon size={28} color={color} />
        </View>
        
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{desc}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.loginBtn, { backgroundColor: color }]}
          onPress={() => handleSelectRole(role)}
        >
          <Text style={styles.loginBtnText}>Login as {role === 'User' ? 'Sales Person' : role}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: 'center' }]}>
      <View style={styles.header}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logoImage} 
          resizeMode="contain" 
        />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{config.title}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>{config.sub}</Text>
      </View>

      <View style={styles.roleGrid}>
        {isSuperAdminApp ? (
          <RoleCard 
            role="SuperAdmin"
            title="Super Administrator"
            desc="Complete granular access to toggle user features across all applications."
            icon={IconShield}
            color="#ef4444"
          />
        ) : isAdminApp ? (
          <RoleCard 
            role="Admin"
            title="System Administrator"
            desc="Complete access to employee management, lead insights, and approvals."
            icon={IconShield}
            color={colors.accent}
          />
        ) : (
          <>
            <RoleCard 
              role="User"
              title="Indoor Sales Person"
              desc="Manage your clients, track tasks, and log all communication."
              icon={IconPeopleFilled}
              color="#10b981"
            />
            
            <View style={{ height: 20 }} />

            <RoleCard 
              role="Field"
              title="Field Employee"
              desc="Track live locations, organize leads, and update clients from the field."
              icon={IconMap}
              color="#b45309"
            />
          </>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  logoImage: {
    width: 90, height: 90, borderRadius: 24,
    marginBottom: 20, elevation: 8, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8
  },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  roleGrid: { width: '100%' },
  card: {
    padding: 24, borderRadius: radius.xxl, borderWidth: 1,
    alignItems: 'center', elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
  },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cardContent: { alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  cardDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  loginBtn: { width: '100%', paddingVertical: 14, borderRadius: radius.full, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  footer: { alignItems: 'center', marginTop: 40 },
  footerText: { fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.5 },
  signupLink: { flexDirection: 'row', marginTop: 16, padding: 8 },
});
