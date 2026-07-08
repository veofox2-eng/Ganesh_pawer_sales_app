import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share, Alert, Linking, ScrollView, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { IconArrowBack, IconSend, IconPerson, IconCallOutline, IconDocument, IconPeopleOutline, IconDownload } from '../lib/Icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';

export default function LeadProfileDetailScreen({ route, navigation }: any) {
  const { project } = route.params;
  const { colors } = useTheme();
  const { user, isAdmin } = useAuth();
  
  const [applicants, setApplicants] = useState<any[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState(project.delete_status || 'None');
  const [deleting, setDeleting] = useState(false);
  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    fetchApplicants();
    
    // Subscribe to real-time new applicants
    const channel = supabase
      .channel(`public:lead_applicants:project_id=eq.${project.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'lead_applicants',
        filter: `project_id=eq.${project.id}`
      }, (payload) => {
        setApplicants(current => [payload.new, ...current]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id]);

  async function fetchApplicants() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lead_applicants')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplicants(data || []);
    } catch (err: any) {
      console.log('Error fetching applicants:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPDF() {
    if (applicants.length === 0) {
      Alert.alert('Empty', 'No applicants to download.');
      return;
    }
    try {
      // Gather dynamic custom field names from all applicants
      const customFieldNames = new Set<string>();
      applicants.forEach(a => {
        if (a.custom_responses) {
          Object.keys(a.custom_responses).forEach(key => customFieldNames.add(key));
        }
      });
      const customCols = Array.from(customFieldNames);

      const htmlContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 20px; color: #333; }
              h1 { text-align: center; color: #1a1b26; margin-bottom: 5px; }
              p { text-align: center; color: #666; margin-top: 0; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f4f4f5; color: #1a1b26; font-weight: bold; }
              tr:nth-child(even) { background-color: #fafafa; }
            </style>
          </head>
          <body>
            <h1>${project?.project_name || 'Leads'} Export</h1>
            <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Purpose</th>
                  ${customCols.map(col => `<th>${col}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${applicants.map(a => `
                  <tr>
                    <td>${new Date(a.created_at).toLocaleString('en-IN')}</td>
                    <td>${a.name || ''}</td>
                    <td>${a.phone || ''}</td>
                    <td>${a.purpose || ''}</td>
                    ${customCols.map(col => `<td>${a.custom_responses?.[col] || ''}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Download Lead Sheet PDF'
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  async function handleShare() {
    const formUrl = `https://gp-leadsform-a3498b.netlify.app/?id=${project.id}`;
    
    try {
      await Share.share({
        message: `Please fill out our lead form for ${project.project_name}: ${formUrl}`,
        url: formUrl,
      });
      
      await supabase.from('interactions').insert([{
        user_id: user?.id,
        type: 'NOTE_ADDED',
        notes: `Shared lead form for project: ${project.project_name}`,
      }]);
    } catch (error: any) {
      Alert.alert('Error sharing', error.message);
    }
  }

  async function handleDelete() {
    if (isAdmin) {
      Alert.alert(
        'Delete Project',
        'Are you sure you want to permanently delete this project and all its applicants?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeleting(true);
              const { error } = await supabase.from('lead_projects').delete().eq('id', project.id);
              setDeleting(false);
              if (error) Alert.alert('Error', error.message);
              else navigation.goBack();
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Request Deletion',
        'Are you sure you want to request the admin to delete this project?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Request',
            onPress: async () => {
              setDeleting(true);
              const { error: err1 } = await supabase
                .from('lead_projects')
                .update({ delete_status: 'Pending' })
                .eq('id', project.id);
              
              if (err1) {
                Alert.alert('Error', err1.message);
                setDeleting(false);
                return;
              }

              const { error: err2 } = await supabase.from('interactions').insert([{
                user_id: user?.id,
                client_id: null,
                type: 'DELETE_REQUESTED',
                content: `Request to delete lead project: ${project.project_name}`,
                media_url: project.id,
              }]);

              setDeleting(false);
              if (err2) {
                Alert.alert('Error', err2.message);
              } else {
                setDeleteStatus('Pending');
                Alert.alert('Success', 'Deletion request sent to admin.');
              }
            }
          }
        ]
      );
    }
  }

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    // Determine sequential number based on array order
    const applicantNumber = applicants.length - index;

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => setSelectedApplicant({ ...item, applicantNumber })}
      >
        <View style={[styles.cardHeader, { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }]}>
          <View style={styles.applicantBadge}>
            <Text style={styles.applicantBadgeText}>Applicant {applicantNumber}</Text>
          </View>
          <Text style={styles.dateText}>{format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}</Text>
        </View>

        <View style={[styles.detailRow, { marginTop: 12, marginBottom: 0 }]}>
          <IconPerson size={16} color={colors.textMuted} />
          <Text style={styles.detailText}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <IconArrowBack size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{project.project_name}</Text>
          <Text style={styles.subtitle}>{applicants.length} Total Applicants</Text>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadPDF}>
          <IconDownload size={18} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={handleShare}>
          <IconSend size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.urlContainer}>
        <Text style={styles.urlLabel}>Your Unique Form URL:</Text>
        <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
          {`https://gp-leadsform-a3498b.netlify.app/?id=${project.id}`}
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={applicants}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <IconPeopleOutline size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No applicants yet.</Text>
              <Text style={[styles.emptyText, { fontSize: 13, marginTop: 4 }]}>Share the link above to start collecting leads.</Text>
            </View>
          }
        />
      )}

      {/* Delete Button */}
      <View style={{ padding: spacing.lg, paddingBottom: 20 }}>
        <TouchableOpacity
          style={[
            styles.deleteBtn,
            (deleting || deleteStatus === 'Pending') && { opacity: 0.5 }
          ]}
          onPress={handleDelete}
          disabled={deleting || deleteStatus === 'Pending'}
        >
          {deleting ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.deleteBtnText}>
              {isAdmin ? 'Delete Project' : (deleteStatus === 'Pending' ? 'Deletion Pending Approval' : 'Request Deletion')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      {/* Applicant Details Modal */}
      <Modal visible={!!selectedApplicant} transparent animationType="fade" onRequestClose={() => setSelectedApplicant(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedApplicant && (
              <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                <View style={[styles.cardHeader, { marginTop: 4 }]}>
                  <View style={styles.applicantBadge}>
                    <Text style={styles.applicantBadgeText}>Applicant {selectedApplicant.applicantNumber}</Text>
                  </View>
                  <Text style={styles.dateText}>{format(new Date(selectedApplicant.created_at), 'MMM d, yyyy h:mm a')}</Text>
                </View>

                <View style={styles.detailRow}>
                  <IconPerson size={16} color={colors.textMuted} />
                  <Text style={styles.detailText}>{selectedApplicant.name}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <IconCallOutline size={16} color={colors.textMuted} />
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedApplicant.phone}`)}>
                    <Text style={[styles.detailText, { color: colors.accent, textDecorationLine: 'underline' }]}>{selectedApplicant.phone}</Text>
                  </TouchableOpacity>
                </View>

                {selectedApplicant.purpose ? (
                  <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                    <IconDocument size={16} color={colors.textMuted} />
                    <Text style={styles.purposeText}>{selectedApplicant.purpose}</Text>
                  </View>
                ) : null}

                {/* Dynamic Custom Responses */}
                {selectedApplicant.custom_responses && Object.keys(selectedApplicant.custom_responses).length > 0 && (
                  <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                    {Object.entries(selectedApplicant.custom_responses).map(([key, value]) => (
                      <View key={key} style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>{key}</Text>
                        <Text style={{ fontSize: 15, color: colors.textPrimary }}>{String(value)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
            
            <TouchableOpacity onPress={() => setSelectedApplicant(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  actionBtn: {
    backgroundColor: colors.bgPanel,
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  
  urlContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    backgroundColor: colors.bgPanel,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  urlLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  urlText: { fontSize: 13, color: colors.accent },

  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: colors.bgPanel, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  applicantBadge: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },
  applicantBadgeText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  dateText: { fontSize: 12, color: colors.textMuted },
  
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  detailText: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  purposeText: { fontSize: 14, color: colors.textSecondary, flex: 1, lineHeight: 20 },

  centered: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15, marginTop: 12, textAlign: 'center' },
  deleteBtn: {
    backgroundColor: colors.danger + '18',
    borderColor: colors.danger + '50',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg
  },
  modalContent: {
    backgroundColor: colors.bgPanel, width: '100%',
    borderRadius: radius.lg, padding: spacing.xl, maxHeight: '80%',
    borderWidth: 1, borderColor: colors.border
  },
  closeBtn: {
    marginTop: 20, backgroundColor: colors.bg,
    paddingVertical: 14, borderRadius: radius.md, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border
  },
  closeBtnText: {
    color: colors.textPrimary, fontSize: 15, fontWeight: '700'
  },
});
