import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconChevronBack, IconMail, IconLock, IconPerson, IconShield } from '../lib/Icons';

export default function AdminCreateUserScreen({ navigation }: any) {
  const { colors: themeColors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'Admin' | 'User' | 'Field'>('User');
  const [loading, setLoading] = useState(false);

  async function handleCreateUser() {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      // Check if role registration limit has been reached
      const { data: isAllowed, error: rpcError } = await supabase.rpc('check_role_limit', { target_role: role });
      if (rpcError) throw rpcError;
      
      if (!isAllowed) {
        Alert.alert('Limit Reached', 'Kindly contact FOX DIGITAL for adding more user');
        setLoading(false);
        return;
      }

      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email, password, username, role },
      });

      if (error) throw error;

      Alert.alert(
        'Success', 
        `${role} account for ${username} created successfully!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Could not create user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <IconChevronBack size={24} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Create New Account</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Full Name / Username</Text>
              <View style={styles.inputWrap}>
                <IconPerson size={18} color={themeColors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={themeColors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrap}>
                <IconMail size={18} color={themeColors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="email@example.com"
                  placeholderTextColor={themeColors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <IconLock size={18} color={themeColors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={themeColors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Assign Role</Text>
              <View style={styles.roleToggle}>
                {(['User', 'Field', 'Admin'] as const).map(r => (
                  <TouchableOpacity 
                    key={r}
                    onPress={() => setRole(r)}
                    style={[
                      styles.roleBtn, 
                      role === r && styles.roleBtnActive,
                      role === r && { borderColor: r === 'Admin' ? themeColors.accent : themeColors.success }
                    ]}
                  >
                    {r === 'Admin' && <IconShield size={14} color={role === r ? themeColors.accent : themeColors.textMuted} style={{ marginRight: 6 }} />}
                    <Text style={[
                      styles.roleText, 
                      role === r && styles.roleTextActive,
                      role === r && { color: r === 'Admin' ? themeColors.accent : r === 'Field' ? themeColors.warning : themeColors.success }
                    ]}>
                      {r === 'User' ? 'Indoor Sales' : r === 'Field' ? 'Field Agent' : r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, { backgroundColor: themeColors.accent }]} 
              onPress={handleCreateUser}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitText}>Create {role} Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },
  header: { 
    flexDirection: 'row', alignItems: 'center', 
    padding: spacing.lg, gap: 12 
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  card: {
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border,
  },
  field: { marginBottom: spacing.xl },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgPanel,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 12, marginLeft: 10 },
  roleToggle: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: radius.md, 
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgPanel,
  },
  roleBtnActive: { backgroundColor: 'rgba(255,255,255,0.03)' },
  roleText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  roleTextActive: { color: colors.textPrimary },
  submitBtn: {
    borderRadius: radius.md, paddingVertical: 16, alignItems: 'center',
    marginTop: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
