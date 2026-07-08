import React, { useState, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TextInput, FlatList, Dimensions, Platform, SafeAreaView
} from 'react-native';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  IconCall, IconClose, IconBackspace, IconSearch,
  IconTime,
} from '../lib/Icons';

const { width } = Dimensions.get('window');
const KEY_SIZE  = Math.floor((width - 48 * 2 - 32) / 3); // 2 × 48 padding + 2 × 16 gaps

const KEYPAD: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const KEY_SUB: Record<string, string> = {
  '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO',
  '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '0': '+',
};

interface DialerModalProps {
  visible: boolean;
  onClose: () => void;
  onCall: (phone: string) => void;
  initialPhone?: string;
  recents?: any[];
}

export default function DialerModal({
  visible, onClose, onCall, initialPhone = '', recents = [],
}: DialerModalProps) {
  const { colors, isDark } = useTheme();
  const [phone, setPhone] = useState(initialPhone);
  const [tab,   setTab]   = useState<'keypad' | 'recents'>('keypad');

  React.useEffect(() => {
    if (visible) { setPhone(initialPhone); setTab('keypad'); }
  }, [visible, initialPhone]);

  const press     = (k: string) => setPhone(p => p + k);
  const backspace = ()          => setPhone(p => p.slice(0, -1));

  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(8,9,16,0.97)' : 'rgba(248,249,252,0.97)' }]}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* ── Header ─────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <IconClose size={22} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.pills}>
              {(['keypad', 'recents'] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.pill, tab === t && styles.pillActive]}>
                  <Text style={[styles.pillText, tab === t && styles.pillTextActive]}>
                    {t === 'keypad' ? 'Keypad' : 'Recents'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.iconBtn}>
              <IconSearch size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── Phone Display ───────────────────────── */}
          <View style={styles.displayRow}>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              showSoftInputOnFocus={false}
              selectionColor={colors.accent}
              textAlign="center"
            />
            {phone.length > 0 && (
              <TouchableOpacity onPress={backspace} style={styles.backspaceBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <IconBackspace size={22} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Tab Content ─────────────────────────── */}
          <View style={{ flex: 1 }}>
            {tab === 'keypad' ? (
              <View style={styles.keypad}>
                {KEYPAD.map((row, ri) => (
                  <View key={ri} style={styles.keyRow}>
                    {row.map(k => (
                      <TouchableOpacity
                        key={k}
                        onPress={() => press(k)}
                        onLongPress={() => k === '0' && press('+')}
                        style={[styles.key, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.keyMain}>{k}</Text>
                        {KEY_SUB[k] && <Text style={styles.keySub}>{KEY_SUB[k]}</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <FlatList
                data={recents}
                keyExtractor={(_, i) => i.toString()}
                contentContainerStyle={styles.recentsList}
                ListEmptyComponent={() => (
                  <View style={styles.emptyWrap}>
                    <IconTime size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No recent calls</Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.recentRow} onPress={() => setPhone(item.phone)}>
                    <View style={[styles.recentAvatar, { backgroundColor: colors.accentLight }]}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>
                        {item.name[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.recentName}>{item.name}</Text>
                      <Text style={styles.recentPhone}>{item.phone}</Text>
                    </View>
                    <Text style={styles.recentTime}>{item.time}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* ── Call Button ─────────────────────────── */}
          <View style={styles.callRow}>
            <TouchableOpacity
              style={[styles.callBtn, { opacity: phone.length > 0 ? 1 : 0.45 }]}
              onPress={() => phone.length > 0 && onCall(phone)}
              disabled={phone.length === 0}
              activeOpacity={0.8}
            >
              <IconCall size={30} color="#fff" />
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay:  { flex: 1 },

  // Header
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  iconBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pills:    { flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 99, padding: 4 },
  pill:     { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 99 },
  pillActive:     { backgroundColor: colors.bgCard, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  pillText:       { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  pillTextActive: { color: colors.textPrimary },

  // Display
  displayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 48, paddingVertical: 20, minHeight: 80 },
  phoneInput: { flex: 1, fontSize: 40, color: colors.textPrimary, fontWeight: '300', textAlign: 'center' },
  backspaceBtn: { padding: 8 },

  // Keypad
  keypad:  { paddingHorizontal: 48, paddingTop: 8 },
  keyRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  key:     { width: KEY_SIZE, height: KEY_SIZE * 0.85, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  keyMain: { fontSize: 26, color: colors.textPrimary, fontWeight: '400' },
  keySub:  { fontSize: 9, color: colors.textMuted, fontWeight: '700', marginTop: 1, letterSpacing: 0.5 },

  // Call button — in normal flow, not absolute
  callRow:  { alignItems: 'center', paddingVertical: 24 },
  callBtn:  { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', shadowColor: colors.success, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },

  // Recents
  recentsList:  { paddingHorizontal: 20 },
  recentRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  recentAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  recentName:   { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  recentPhone:  { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  recentTime:   { fontSize: 12, color: colors.textMuted },
  emptyWrap:    { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText:    { color: colors.textMuted, marginTop: 16, fontSize: 16 },
});
