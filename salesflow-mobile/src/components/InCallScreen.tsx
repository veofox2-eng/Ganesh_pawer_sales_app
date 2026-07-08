import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Platform, Animated
} from 'react-native';
import { BlurView } from 'expo-blur';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  IconCall, IconMic, IconMicOutline, IconVolumeUp,
  IconPause, IconAdd, IconClose, IconHistory, IconCheckCircle
} from '../lib/Icons';

const { width } = Dimensions.get('window');

interface InCallScreenProps {
  visible: boolean;
  clientName: string;
  phoneNumber: string;
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'ringing';
  onHangUp: () => void;
}

export default function InCallScreen({
  visible, clientName, phoneNumber, status, onHangUp
}: InCallScreenProps) {
  const { colors } = useTheme();
  const [seconds, setSeconds]     = useState(0);
  const [isMuted, setIsMuted]     = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  // Animated pulse for recording dot
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'connected') {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);

      // Pulse the recording dot
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      setSeconds(0);
      pulseAnim.setValue(1);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const statusText = () => {
    switch (status) {
      case 'connecting':   return 'Connecting...';
      case 'ringing':      return 'Ringing...';
      case 'connected':    return formatTime(seconds);
      case 'reconnecting': return 'Reconnecting...';
      case 'disconnected': return 'Call Ended';
      default:             return '';
    }
  };

  const styles = useMemo(() => getStyles(colors), [colors]);
  const isConnected = status === 'connected';

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.container}>
        <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.content}>

          {/* ── TOP: Call Info ────────────────────────────── */}
          <View style={styles.infoArea}>
            {/* Avatar */}
            <View style={[styles.avatarRing, isConnected && styles.avatarRingActive]}>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={styles.avatarText}>{(clientName[0] || '?').toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.name}>{clientName}</Text>
            <Text style={styles.phoneNum}>{phoneNumber}</Text>

            {/* Status / Timer */}
            <Text style={styles.statusText}>{statusText()}</Text>

            {/* Recording badge */}
            {isConnected && (
              <View style={styles.recordBadge}>
                <Animated.View style={[styles.recordDot, { opacity: pulseAnim }]} />
                <Text style={styles.recordLabel}>● REC</Text>
              </View>
            )}

            {/* Speakerphone nudge — critical for dual-side recording */}
            {isConnected && !isSpeaker && (
              <View style={styles.speakerNudge}>
                <Text style={styles.speakerNudgeText}>
                  🔊 Enable Speaker for clearer recording
                </Text>
              </View>
            )}
          </View>

          {/* ── BOTTOM: Controls ─────────────────────────── */}
          <View style={styles.controlsArea}>

            <View style={styles.controlRow}>
              {/* Mute */}
              <ControlButton
                icon={isMuted
                  ? <IconMic size={26} color="#fff" />
                  : <IconMicOutline size={26} color="rgba(255,255,255,0.75)" />}
                label={isMuted ? 'Unmute' : 'Mute'}
                active={isMuted}
                onPress={() => setIsMuted(m => !m)}
              />
              {/* Speaker */}
              <ControlButton
                icon={<IconVolumeUp size={26} color={isSpeaker ? '#fff' : 'rgba(255,255,255,0.75)'} />}
                label="Speaker"
                active={isSpeaker}
                onPress={() => setIsSpeaker(s => !s)}
                highlight
              />
              {/* Add call */}
              <ControlButton
                icon={<IconAdd size={26} color="rgba(255,255,255,0.75)" />}
                label="Add Call"
                onPress={() => {}}
              />
            </View>

            <View style={styles.controlRow}>
              <ControlButton
                icon={<IconHistory size={26} color="rgba(255,255,255,0.75)" />}
                label="Keypad"
                onPress={() => {}}
              />
              <ControlButton
                icon={<IconPause size={26} color="rgba(255,255,255,0.75)" />}
                label="Hold"
                onPress={() => {}}
              />
              <ControlButton
                icon={<IconCheckCircle size={26} color="rgba(255,255,255,0.75)" />}
                label="Transfer"
                onPress={() => {}}
              />
            </View>

            {/* Hang up */}
            <TouchableOpacity style={styles.hangUpBtn} onPress={onHangUp} activeOpacity={0.8}>
              <IconClose size={32} color="#fff" />
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────
function ControlButton({
  icon, label, onPress, active = false, highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <TouchableOpacity style={btnStyles.wrap} onPress={onPress} activeOpacity={0.7}>
      <View style={[
        btnStyles.circle,
        active && btnStyles.circleActive,
        highlight && active && btnStyles.circleHighlight,
      ]}>
        {icon}
      </View>
      <Text style={btnStyles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  wrap:            { alignItems: 'center', width: (width - 48 * 2) / 3 },
  circle:          { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  circleActive:    { backgroundColor: 'rgba(255,255,255,0.25)' },
  circleHighlight: { backgroundColor: 'rgba(99,183,255,0.35)' },
  label:           { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
});

// ─── Styles ────────────────────────────────────────────────────────────────────
const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: Platform.OS === 'ios' ? 50 : 36,
    justifyContent: 'space-between',
  },

  // Info
  infoArea:       { alignItems: 'center', flex: 1, justifyContent: 'center' },
  avatarRing:     { width: 148, height: 148, borderRadius: 74, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  avatarRingActive:{ borderColor: colors.accent + '80' },
  avatar:         { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 16 },
  avatarText:     { fontSize: 48, fontWeight: '800', color: '#fff' },
  name:           { fontSize: 28, color: '#fff', fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  phoneNum:       { fontSize: 16, color: 'rgba(255,255,255,0.55)', marginTop: 6, textAlign: 'center' },
  statusText:     { fontSize: 20, color: 'rgba(255,255,255,0.9)', fontWeight: '300', marginTop: 18, textAlign: 'center' },

  recordBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, marginTop: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  recordDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 6 },
  recordLabel:    { fontSize: 11, color: '#ef4444', fontWeight: '800', letterSpacing: 1 },

  speakerNudge:   { marginTop: 14, backgroundColor: 'rgba(255,193,7,0.12)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,193,7,0.3)' },
  speakerNudgeText:{ fontSize: 12, color: 'rgba(255,220,100,0.9)', fontWeight: '600', textAlign: 'center' },

  // Controls
  controlsArea:   { gap: 32, alignItems: 'center' },
  controlRow:     { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%' },

  hangUpBtn:      { width: 76, height: 76, borderRadius: 38, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 15 },
});
