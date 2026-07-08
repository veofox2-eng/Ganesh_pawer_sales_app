import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { IconShieldOutline, IconCheck, IconTime, IconRefresh } from '../lib/Icons';
import LogoutConfirmModal from '../components/LogoutConfirmModal';

interface StepConfig {
  key: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  activeColor: string;
}

type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export default function PendingApprovalScreen() {
  const { signOut, refreshProfile, profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(
    (profile?.approval_status as ApprovalStatus) || 'Pending'
  );
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchApprovalData();

    // Real-time subscription to watch approval changes
    if (profile?.id) {
      const sub = supabase
        .channel(`approval_status_${profile.id}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'profiles',
          filter: `id=eq.${profile.id}`
        }, (payload) => {
          const updated = payload.new as any;
          setApprovalStatus(updated.approval_status);
          setUpdatedAt(updated.updated_at);
          if (updated.approval_status === 'Approved') {
            refreshProfile();
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(sub); };
    }
  }, [profile?.id]);

  useEffect(() => {
    // Pulsing animation for the pending dot
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  async function fetchApprovalData() {
    // If context profile is missing, fallback to the session's user ID
    let userId = profile?.id;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    if (!userId) return;

    const { data } = await supabase
      .from('profiles')
      .select('approval_status, updated_at')
      .eq('id', userId)
      .single();
      
    if (data) {
      setApprovalStatus(data.approval_status as ApprovalStatus);
      // No created_at column in profiles — use updated_at as the registration time
      setCreatedAt(data.updated_at || null);
      setUpdatedAt(data.updated_at || null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchApprovalData();
    await refreshProfile();
    setRefreshing(false);
  }

  // ─── Compute steps based on status ──────────────────────────────
  // Since no created_at column exists, we use updated_at as registration time.
  // Steps are time-approximated after that.
  const sentTime = createdAt ? new Date(createdAt) : new Date();
  const updateTime = updatedAt ? new Date(updatedAt) : null;
  const now = new Date();
  const minutesSinceSent = (now.getTime() - sentTime.getTime()) / 60000;
  // Admin has updated the record when approval_status changed (from Pending)
  const adminActed = approvalStatus !== 'Pending';

  const step0Done = true; // Always done
  const step1Done = minutesSinceSent > 1; // "Received" after 1 min
  const step2Done = adminActed || minutesSinceSent > 10;
  const step3Done = approvalStatus === 'Approved' || approvalStatus === 'Rejected';
  const isRejected = approvalStatus === 'Rejected';

  type StepDef = { label: string; sublabel: string; done: boolean; active: boolean; color: string };
  const steps: StepDef[] = [
    {
      label: 'Request Sent',
      sublabel: createdAt
        ? `Submitted at ${new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Your account request was submitted.',
      done: step0Done, active: true, color: colors.accent,
    },
    {
      label: 'Received by Admin',
      sublabel: step1Done ? 'Your request is in the admin queue.' : 'Waiting for admin to receive...',
      done: step1Done, active: step0Done, color: colors.cyan,
    },
    {
      label: 'Reviewed by Admin',
      sublabel: step2Done ? 'Admin has reviewed your request.' : 'Admin will review shortly.',
      done: step2Done, active: step1Done, color: colors.purple,
    },
    {
      label: approvalStatus === 'Approved' ? 'Approved ✓' : approvalStatus === 'Rejected' ? 'Request Rejected' : 'Decision Pending',
      sublabel: approvalStatus === 'Approved'
        ? 'Welcome! Tap "Check Status" to enter the app.'
        : approvalStatus === 'Rejected'
        ? 'Your request was rejected. Contact your administrator.'
        : 'Waiting for admin to approve or reject.',
      done: step3Done, active: step2Done,
      color: isRejected ? colors.danger : colors.success,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: isRejected ? colors.dangerLight : 'rgba(99,102,241,0.12)' }]}>
          <IconShieldOutline size={40} color={isRejected ? colors.danger : colors.accent} />
        </View>

        <Text style={styles.title}>
          {isRejected ? 'Request Rejected' : 'Awaiting Approval'}
        </Text>
        <Text style={styles.subtitle}>
          {isRejected
            ? 'Your account request was rejected. Please contact your administrator.'
            : 'Your account has been created. Track the approval progress below.'}
        </Text>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const isCurrent = step.active && !step.done && !isLast;

            return (
              <View key={index} style={styles.stepRow}>
                {/* Left: dot + line */}
                <View style={styles.stepTrack}>
                  {step.done ? (
                    <View style={[styles.stepDot, { backgroundColor: step.color }]}>
                      <IconCheck size={12} color="#fff" />
                    </View>
                  ) : isCurrent ? (
                    <Animated.View style={[styles.stepDot, styles.stepDotPulse, { backgroundColor: step.color, transform: [{ scale: pulseAnim }] }]} />
                  ) : (
                    <View style={[styles.stepDot, styles.stepDotEmpty, { borderColor: step.active ? step.color : colors.border }]}>
                      <IconTime size={12} color={step.active ? step.color : colors.textMuted} />
                    </View>
                  )}
                  {!isLast && (
                    <View style={[styles.stepLine, { backgroundColor: step.done ? step.color + '60' : colors.border }]} />
                  )}
                </View>

                {/* Right: text */}
                <View style={styles.stepContent}>
                  <Text style={[styles.stepLabel, { color: step.active ? colors.textPrimary : colors.textMuted, fontWeight: step.done ? '700' : '500' }]}>
                    {step.label}
                  </Text>
                  <Text style={[styles.stepSublabel, { color: colors.textMuted }]}>{step.sublabel}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: refreshing ? colors.bgPanel : colors.accent }]}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <IconRefresh size={18} color="#fff" />
          <Text style={styles.refreshBtnText}>{refreshing ? 'Checking...' : 'Check Status'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={() => setShowLogoutConfirm(true)}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <LogoutConfirmModal
        visible={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => { setShowLogoutConfirm(false); signOut(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: 40, paddingBottom: 20 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 36 },
  stepsContainer: { marginBottom: 32 },
  stepRow: { flexDirection: 'row', gap: 14, marginBottom: 0 },
  stepTrack: { alignItems: 'center', width: 28 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotPulse: { opacity: 0.9 },
  stepDotEmpty: {
    backgroundColor: 'transparent', borderWidth: 2,
  },
  stepLine: { flex: 1, width: 2, minHeight: 28, marginVertical: 4 },
  stepContent: { flex: 1, paddingBottom: 24 },
  stepLabel: { fontSize: 14 },
  stepSublabel: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: radius.full, marginBottom: 12,
  },
  refreshBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  signOutBtn: { paddingVertical: 12, alignItems: 'center' },
  signOutBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
