import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Modal, Share, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { IconAdd, IconClose, IconDocument, IconSend, IconWhatsApp, IconChevronForward, IconPeopleOutline, IconMenu } from '../lib/Icons';
import { useSidebar } from '../context/SidebarContext';

export default function LeadSectionScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { openSidebar } = useSidebar();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [customFields, setCustomFields] = useState<{name: string, type: string}[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [purposeType, setPurposeType] = useState<'text' | 'dropdown'>('text');
  const [purposeOptions, setPurposeOptions] = useState<string[]>([]);
  const [newPurposeOption, setNewPurposeOption] = useState('');
  const [creating, setCreating] = useState(false);

  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    fetchProjects();
    const unsub = navigation.addListener('focus', fetchProjects);
    return unsub;
  }, [navigation]);

  async function fetchProjects() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lead_projects')
        .select(`
          *,
          lead_applicants(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (err: any) {
      console.log('Error fetching lead projects:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject() {
    if (!projectName.trim()) {
      Alert.alert('Required', 'Please enter a project name.');
      return;
    }

    setCreating(true);
    try {
        if (purposeType === 'dropdown' && purposeOptions.length < 2) {
          Alert.alert('Required', 'Please add at least 2 dropdown options for Purpose of Enquiry.');
          setCreating(false);
          return;
        }

        let finalCustomFields = [...customFields];
        if (newFieldName.trim()) {
          finalCustomFields.push({ name: newFieldName.trim(), type: newFieldType });
        }

        const finalPurposeOptions = purposeType === 'dropdown' ? purposeOptions : null;

        const { data, error } = await supabase
          .from('lead_projects')
          .insert([{ project_name: projectName.trim(), created_by: user?.id, custom_fields: finalCustomFields, purpose_options: finalPurposeOptions }])
          .select()
          .single();

      if (error) throw error;
        setProjectName('');
        setCustomFields([]);
        setNewFieldName('');
        setNewFieldType('text');
        setPurposeType('text');
        setPurposeOptions([]);
        setNewPurposeOption('');
        setShowModal(false);
        fetchProjects();
      
      // Optionally show success or copy link immediately
      Alert.alert('Success', 'Lead Project created successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleShare(project: any) {
    const formUrl = `https://gp-leadsform-a3498b.netlify.app/?id=${project.id}`;
    
    try {
      await Share.share({
        message: `Please fill out our lead form for ${project.project_name}: ${formUrl}`,
        url: formUrl, // iOS only
      });
      
      // Log interaction in timeline
      await supabase.from('interactions').insert([{
        user_id: user?.id,
        type: 'NOTE_ADDED',
        notes: `Shared lead form for project: ${project.project_name}`,
      }]);
    } catch (error: any) {
      Alert.alert('Error sharing', error.message);
    }
  }

  const renderItem = ({ item }: { item: any }) => {
    const applicantCount = item.lead_applicants?.[0]?.count || 0;
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('LeadProfileDetail', { project: item })}
      >
        <View style={styles.cardIcon}>
          <IconDocument size={24} color={colors.accent} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.project_name}</Text>
          {item.delete_status === 'Pending' ? (
            <Text style={[styles.cardSubtitle, { color: colors.danger, fontWeight: 'bold' }]}>Deletion Pending</Text>
          ) : (
            <Text style={styles.cardSubtitle}>
              {applicantCount} {applicantCount === 1 ? 'Applicant' : 'Applicants'}
            </Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.shareBtn} 
          onPress={() => handleShare(item)}
        >
          <IconSend size={18} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Lead Forms</Text>
          <Text style={styles.subtitle}>Generate and share forms per project</Text>
        </View>
      </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: 16 }}>
          <TouchableOpacity 
            style={styles.generateBtn}
            activeOpacity={0.8}
            onPress={() => {
              setProjectName('');
              setCustomFields([]);
              setNewFieldName('');
              setNewFieldType('text');
              setPurposeType('text');
              setPurposeOptions([]);
              setNewPurposeOption('');
              setShowModal(true);
            }}
          >
            <IconAdd color="#fff" size={24} />
            <Text style={styles.generateBtnText}>Generate New Form</Text>
          </TouchableOpacity>
        </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <IconPeopleOutline size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No Lead Projects found.</Text>
              <Text style={[styles.emptyText, { fontSize: 13, marginTop: 4 }]}>Tap Generate New Form to create one.</Text>
            </View>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate Lead Form</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
                <IconClose size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400, paddingBottom: 20 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Project Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Summer Campaign 2026"
                  placeholderTextColor={colors.textMuted}
                  value={projectName}
                  onChangeText={setProjectName}
                />
              </View>

              <View style={[styles.inputGroup, { marginTop: 16 }]}>
                <Text style={styles.label}>Purpose of Enquiry Field</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: purposeType === 'text' ? colors.accent : colors.border, backgroundColor: purposeType === 'text' ? colors.accent + '15' : colors.bg, alignItems: 'center' }}
                    onPress={() => setPurposeType('text')}
                  >
                    <Text style={{ color: purposeType === 'text' ? colors.accent : colors.textPrimary, fontWeight: 'bold' }}>Text Typing</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: purposeType === 'dropdown' ? colors.accent : colors.border, backgroundColor: purposeType === 'dropdown' ? colors.accent + '15' : colors.bg, alignItems: 'center' }}
                    onPress={() => setPurposeType('dropdown')}
                  >
                    <Text style={{ color: purposeType === 'dropdown' ? colors.accent : colors.textPrimary, fontWeight: 'bold' }}>Dropdown</Text>
                  </TouchableOpacity>
                </View>

                {purposeType === 'dropdown' && (
                  <View style={{ marginTop: 8 }}>
                    {purposeOptions.map((opt, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ flex: 1, color: colors.textPrimary }}>{opt}</Text>
                        <TouchableOpacity onPress={() => setPurposeOptions(purposeOptions.filter((_, i) => i !== idx))} style={{ padding: 4 }}>
                          <Text style={{ color: 'red', fontWeight: 'bold' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Add dropdown option..."
                        placeholderTextColor={colors.textMuted}
                        value={newPurposeOption}
                        onChangeText={setNewPurposeOption}
                      />
                      <TouchableOpacity 
                        style={{ backgroundColor: colors.accent, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: 44 }}
                        onPress={() => {
                          if (newPurposeOption.trim() && purposeOptions.length < 100) {
                            setPurposeOptions([...purposeOptions, newPurposeOption.trim()]);
                            setNewPurposeOption('');
                          }
                        }}
                      >
                        <IconAdd color="#fff" size={24} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <View style={[styles.inputGroup, { marginTop: 16 }]}>
                <Text style={styles.label}>Custom Form Fields (Optional)</Text>
                
                {customFields.map((field, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{field.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' }}>Type: {field.type}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setCustomFields(customFields.filter((_, i) => i !== idx))} style={{ padding: 4 }}>
                      <Text style={{ color: 'red', fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 2 }]}
                    placeholder="Field Name (e.g. Budget)"
                    placeholderTextColor={colors.textMuted}
                    value={newFieldName}
                    onChangeText={setNewFieldName}
                  />
                  
                  <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => {
                      const types = ['text', 'number', 'date', 'longtext'];
                      const nextType = types[(types.indexOf(newFieldType) + 1) % types.length];
                      setNewFieldType(nextType);
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 13, textTransform: 'uppercase', fontWeight: 'bold' }}>{newFieldType}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 9 }}>Tap to change</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ backgroundColor: colors.accent, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: 44 }}
                    onPress={() => {
                      if (newFieldName.trim()) {
                        setCustomFields([...customFields, { name: newFieldName.trim(), type: newFieldType }]);
                        setNewFieldName('');
                      }
                    }}
                  >
                    <IconAdd color="#fff" size={24} />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.saveBtn, (!projectName.trim() || creating) && { opacity: 0.5 }]}
              onPress={handleCreateProject}
              disabled={!projectName.trim() || creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Generate Form & Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  
  generateBtn: {
    backgroundColor: colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: radius.md,
  },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgPanel, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: 12,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: radius.full,
    backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: colors.textMuted },
  shareBtn: {
    backgroundColor: colors.success,
    width: 36, height: 36, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12,
  },

  centered: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15, marginTop: 12, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.bgPanel, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  modalClose: { padding: 4 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.bg, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
  },
  saveBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
