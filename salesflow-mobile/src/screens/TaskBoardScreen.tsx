import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert,
  Dimensions, KeyboardAvoidingView, Platform, BackHandler,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PremiumDateTimePicker from '../components/PremiumDateTimePicker';
import { supabase } from '../lib/supabase';
import { spacing, radius, PRIORITY_COLORS } from '../theme';
import { useTheme } from '../context/ThemeContext';
import type { AppColors } from '../context/ThemeContext';
import {
  IconAdd, IconCheckCircle, IconCheckCircleOutline, IconCircle,
  IconTrash, IconCalendar, IconChevronDown, IconCloseCircle,
  IconClose, IconFlame, IconTime, IconCheckmarkDone, IconMenu,
} from '../lib/Icons';
import { useSidebar } from '../context/SidebarContext';

type Priority = 'Low' | 'Medium' | 'High';

interface Task {
  id: string; title: string; priority: Priority;
  description?: string; voice_note_url?: string;
  client_id?: string;
  due_date?: string; is_completed: boolean;
  completed_at?: string; user_id?: string; created_at: string;
}

interface Client { id: string; name: string; }

import VoiceRecorder from '../lib/VoiceRecorder';
import { format } from 'date-fns';
import { scheduleClientReminder, cancelNotification } from '../lib/Notifications';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - 10) / 2;

export default function TaskBoardScreen() {
  const { colors } = useTheme();
  const { openSidebar } = useSidebar();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'edit' | 'activity'>('edit');
  const [interactions, setInteractions] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', priority: 'Medium' as Priority, due_date: '', description: '', voice_note_url: '', client_id: '' });
  const [filter, setFilter] = useState<Priority | 'All'>('All');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => { fetchTasks(); }, []);

  // Android hardware back button: close modal instead of going back
  useEffect(() => {
    if (!showModal && !detailTaskId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeModal();
      setDetailTaskId(null);
      return true;
    });
    return () => sub.remove();
  }, [showModal, detailTaskId]);

  function closeModal() {
    setEditingTaskId(null);
    setShowModal(false);
    setForm({ title: '', priority: 'Medium', due_date: '', description: '', voice_note_url: '', client_id: '' });
    setShowDatePicker(false);
  }

  async function fetchInteractions(taskId: string) {
    const { data } = await supabase.from('interactions')
      .select('*').eq('task_id', taskId).order('created_at', { ascending: false });
    if (data) setInteractions(data);
  }

  async function openDetail(task: Task, initialTab: 'edit' | 'activity' = 'edit') {
    setDetailTaskId(task.id);
    handleEdit(task);
    setDetailTab(initialTab);
    fetchInteractions(task.id);
  }

  function handleEdit(task: Task) {
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      priority: task.priority,
      due_date: task.due_date || '',
      description: task.description || '',
      voice_note_url: task.voice_note_url || '',
      client_id: task.client_id || '',
    });
    if (task.due_date) setSelectedDate(new Date(task.due_date));
    setShowModal(true);
  }

  async function fetchTasks() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: taskData }, { data: clientData }] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').eq('user_id', user.id).eq('is_deleted', false).order('name'),
    ]);
    if (taskData) setTasks(taskData);
    if (clientData) setClients(clientData);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      title: form.title, priority: form.priority,
      description: form.description || null,
      due_date: form.due_date || null,
      client_id: form.client_id || null,
    };

    if (editingTaskId) {
      const old = tasks.find(t => t.id === editingTaskId);
      const { data, error } = await supabase.from('tasks').update(payload)
        .eq('id', editingTaskId).select().single();

      if (!error && data) {
        setTasks(prev => prev.map(t => t.id === editingTaskId ? data : t));
        
        // Handle Notifications
        if (old?.due_date !== data.due_date) {
           // Cancel old one if exists (id was based on taskId)
           await cancelNotification(`task_${data.id}`);
           if (data.due_date) {
             const linkedClient = clients.find(c => c.id === data.client_id);
             let phone = '';
             if (linkedClient) {
                const { data: cData } = await supabase.from('clients').select('phone').eq('id', linkedClient.id).single();
                phone = cData?.phone || '';
             }
             await scheduleClientReminder(
               `Task Reminder: ${data.title}`,
               data.description || 'Time to complete your task!',
               new Date(data.due_date),
               { taskId: data.id, phone, type: 'task' }
             );
           }
        }

        // Generate detailed change description
        let changes = [];
        if (old) {
          if (old.title !== data.title) changes.push(`Title: "${old.title}" → "${data.title}"`);
          if (old.priority !== data.priority) changes.push(`Priority: ${old.priority} → ${data.priority}`);
          if (old.description !== data.description) changes.push(`Description updated`);
          if (old.due_date !== data.due_date) {
            const oldDate = old.due_date ? formatDueDate(old.due_date) : 'None';
            const newDate = data.due_date ? formatDueDate(data.due_date) : 'None';
            changes.push(`Rescheduled: ${oldDate} → ${newDate}`);
          }
        }

        let logMsg = changes.length > 0 
          ? `Changes: ${changes.join(', ')}` 
          : `Task details re-saved: ${data.title}`;

        await supabase.from('interactions').insert({
          task_id: data.id, 
          client_id: data.client_id || null,
          type: 'NOTE_ADDED', content: logMsg, author: 'System', 
          user_id: user.id
        });
        closeModal();
      } else Alert.alert('Error', error?.message);
    } else {
      const { data, error } = await supabase.from('tasks').insert({
        ...payload,
        is_completed: false, user_id: user.id,
      }).select().single();
      if (!error && data) {
        setTasks(prev => [data, ...prev]);

        // Schedule Notification
        if (data.due_date) {
          const linkedClient = clients.find(c => c.id === data.client_id);
          let phone = '';
          if (linkedClient) {
             const { data: cData } = await supabase.from('clients').select('phone').eq('id', linkedClient.id).single();
             phone = cData?.phone || '';
          }
          await scheduleClientReminder(
            `Task Reminder: ${data.title}`,
            data.description || 'Time to complete your task!',
            new Date(data.due_date),
            { taskId: data.id, phone, type: 'task' }
          );
        }

        await supabase.from('interactions').insert({
          task_id: data.id, 
          client_id: data.client_id || null,
          type: 'NOTE_ADDED', content: `Task created: ${data.title}`, author: 'System',
          user_id: user.id
        });
        closeModal();
      }
    }
    setSaving(false);
  }

  async function toggleDone(task: Task) {
    const now = new Date().toISOString();
    await supabase.from('tasks').update({
      is_completed: !task.is_completed,
      completed_at: !task.is_completed ? now : null,
    }).eq('id', task.id);
    
    if (!task.is_completed) {
      await cancelNotification(`task_${task.id}`);
    }
    
    await supabase.from('interactions').insert({
      task_id: task.id,
      client_id: task.client_id || null,
      type: 'NOTE_ADDED',
      content: !task.is_completed ? 'Task marked as Completed' : 'Task reverted to Pending',
      author: 'System',
      user_id: task.user_id || (await supabase.auth.getUser()).data.user?.id
    });

    setTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, is_completed: !t.is_completed, completed_at: !t.is_completed ? now : undefined }
      : t));
  }

  async function deleteTask(id: string) {
    const performDelete = async () => {
      await supabase.from('tasks').delete().eq('id', id);
      setTasks(prev => prev.filter(t => t.id !== id));
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this task?')) {
        await performDelete();
      }
      return;
    }

    Alert.alert('Delete Task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: performDelete },
    ]);
  }

  function isOverdue(task: Task) {
    return !task.is_completed && task.due_date && new Date(task.due_date) < new Date();
  }

  function formatDueDate(dateStr?: string) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return 'Today';
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }

  const pending = tasks.filter(t => !t.is_completed);
  const done = tasks.filter(t => t.is_completed);
  const filteredTasks = tasks.filter(t =>
    filter === 'All' ? true : t.priority === filter
  );

  function renderTaskCard({ item: t, index }: { item: Task; index: number }) {
    const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS['Medium'];
    const overdue = isOverdue(t);
    const dueLabel = formatDueDate(t.due_date);
    return (
      <TouchableOpacity 
        onPress={() => openDetail(t)}
        style={[
          styles.taskCard,
          { marginLeft: index % 2 === 0 ? 0 : 10 },
          t.is_completed && styles.taskCardDone,
        ]}
      >
        <View style={[styles.priorityBar, { backgroundColor: pc.text }]} />
        <View style={styles.cardInner}>
          <Text style={[styles.taskTitle, t.is_completed && styles.taskTitleDone]}
            numberOfLines={2}>{t.title}</Text>
          
          <View style={[styles.priorityBadge, { backgroundColor: pc.bg, borderColor: pc.border, marginTop: 4 }]}>
            <Text style={[styles.priorityText, { color: pc.text }]}>{t.priority}</Text>
          </View>
          
          <View style={{ flex: 1 }} />
          
          {dueLabel ? (
            <View style={styles.dueDateRow}>
              <IconCalendar size={11} color={overdue ? colors.danger : colors.textMuted} />
              <Text style={[styles.dueDateText, overdue && styles.overdueText]}>
                {dueLabel}
              </Text>
            </View>
          ) : null}

          <View style={styles.cardActions}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleDone(t); }} style={styles.checkBtn}>
              {t.is_completed
                ? <IconCheckCircle size={22} color={colors.success} />
                : <IconCircle size={22} color={colors.textMuted} />
              }
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); openDetail(t, 'activity'); }} style={styles.historyBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <IconTime size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); deleteTask(t.id); }} style={styles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <IconTrash size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>{profile?.username || 'Employee'}</Text>
            <View style={{ backgroundColor: colors.accentLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '700', textTransform: 'uppercase' }}>{profile?.feature_flags?.industry_position || profile?.role}</Text>
            </View>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>Task Board</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{pending.length} pending · {done.length} done</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <IconAdd size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        {[
          { label: 'Pending', count: pending.length, color: colors.warning, Icon: IconTime },
          { label: 'Done', count: done.length, color: colors.success, Icon: IconCheckmarkDone },
          { label: 'High Priority', count: tasks.filter(t => !t.is_completed && t.priority === 'High').length, color: colors.danger, Icon: IconFlame },
        ].map(({ label, count, color, Icon }) => (
          <View key={label} style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: color }]}>
              <Icon size={18} color="#fff" />
            </View>
            <Text style={[styles.summaryCount, { color }]}>{count}</Text>
            <Text style={styles.summaryLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Priority Filter */}
      <View style={styles.filterRow}>
        {(['All', 'High', 'Medium', 'Low'] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}>
            <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task Grid */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={item => item.id}
          renderItem={renderTaskCard}
          numColumns={2}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ marginBottom: 10 }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <IconCheckmarkDone size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>No tasks yet</Text>
              <Text style={styles.emptySubText}>Tap + Add to create your first task</Text>
            </View>
          }
        />
      )}

      {/* Unified Task Detail Modal */}
      <Modal visible={!!detailTaskId || showModal} animationType="slide" presentationStyle="pageSheet" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.bottomSheet}>
            <View style={[styles.bottomSheetContent, { height: '90%', paddingBottom: 0 }]}>
              <View style={styles.sheetHandle} />
              
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Task Details</Text>
                  {detailTaskId && tasks.find(x => x.id === detailTaskId)?.is_completed && (
                    <View style={styles.completedBadge}>
                      <IconCheckCircle size={10} color={colors.success} />
                      <Text style={styles.completedBadgeText}>Completed</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => { closeModal(); setDetailTaskId(null); }} style={styles.cancelIconBtn}>
                  <IconClose size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Tabs */}
              <View style={styles.tabBar}>
                <TouchableOpacity onPress={() => setDetailTab('edit')} style={[styles.tabBtn, detailTab === 'edit' && styles.tabBtnActive]}>
                  <Text style={[styles.tabBtnText, detailTab === 'edit' && styles.tabBtnTextActive]}>{detailTaskId ? 'Edit Details' : 'Task Details'}</Text>
                </TouchableOpacity>
                {detailTaskId && (
                  <TouchableOpacity onPress={() => setDetailTab('activity')} style={[styles.tabBtn, detailTab === 'activity' && styles.tabBtnActive]}>
                    <Text style={[styles.tabBtnText, detailTab === 'activity' && styles.tabBtnTextActive]}>Activity Log</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
                {detailTab === 'edit' ? (
                  <View style={{ gap: 14 }}>
                    <Text style={styles.fieldLabel}>Title</Text>
                    <TextInput
                      style={[styles.fieldInput, { fontWeight: '700', fontSize: 16 }]}
                      placeholder="Task title"
                      placeholderTextColor={colors.textMuted}
                      value={form.title}
                      onChangeText={v => setForm(prev => ({ ...prev, title: v }))}
                    />

                    <Text style={styles.fieldLabel}>Link to Client (optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled={true}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setForm(prev => ({ ...prev, client_id: '' }))} style={[styles.clientChip, !form.client_id && styles.clientChipActive]}>
                          <Text style={[styles.clientChipText, !form.client_id && { color: colors.accent }]}>None</Text>
                        </TouchableOpacity>
                        {clients.map(c => (
                          <TouchableOpacity key={c.id} onPress={() => setForm(prev => ({ ...prev, client_id: c.id }))} style={[styles.clientChip, form.client_id === c.id && styles.clientChipActive]}>
                            <Text style={[styles.clientChipText, form.client_id === c.id && { color: colors.accent }]}>{c.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.fieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
                      placeholder="Add more details..."
                      placeholderTextColor={colors.textMuted}
                      value={form.description}
                      onChangeText={v => setForm(prev => ({ ...prev, description: v }))}
                      multiline
                    />

                    <VoiceRecorder 
                        label="Task Voice Memo"
                        folder={`tasks/${detailTaskId || 'new'}`}
                        existingUrl={form.voice_note_url}
                        onUpload={async (url) => {
                          setForm(prev => ({ ...prev, voice_note_url: url }));
                          await supabase.from('interactions').insert({
                            task_id: detailTaskId, type: 'VOICE_INSTRUCTION', 
                            content: 'Voice note attached to task.', author: 'System', media_url: url,
                            user_id: (await supabase.auth.getUser()).data.user?.id
                          });
                        }}
                      />

                    <Text style={styles.fieldLabel}>Priority</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['High', 'Medium', 'Low'] as Priority[]).map(p => {
                        const pc = PRIORITY_COLORS[p];
                        return (
                          <TouchableOpacity key={p} onPress={() => setForm(prev => ({ ...prev, priority: p }))}
                            style={[styles.priorityOptionBtn, { borderColor: form.priority === p ? pc.text : colors.border },
                              form.priority === p && { backgroundColor: pc.bg }]}>
                            <Text style={[styles.priorityOptionText, { color: form.priority === p ? pc.text : colors.textMuted }]}>
                              {p}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={styles.fieldLabel}>Due Date</Text>
                    <View style={styles.datePickerContainer}>
                      <IconCalendar size={18} color={colors.accent} style={{ marginRight: 10 }} />
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          value={form.due_date || ''}
                          onChange={(e) => {
                            const date = new Date(e.target.value);
                            if (!isNaN(date.getTime())) {
                              setSelectedDate(date);
                              setForm(prev => ({ ...prev, due_date: e.target.value }));
                            }
                          }}
                          style={{
                            flex: 1, backgroundColor: 'transparent', border: 'none',
                            color: colors.textPrimary, fontSize: '14px', outline: 'none',
                            cursor: 'pointer', fontFamily: 'inherit'
                          }}
                        />
                      ) : (
                        <TouchableOpacity style={{ flex: 1, height: 40, justifyContent: 'center' }} onPress={() => setShowDatePicker(true)}>
                          <Text style={[styles.datePickerBtnText, !form.due_date && { color: colors.textMuted }]}>
                            {(() => { try { const d = new Date(form.due_date); return isNaN(d.getTime()) ? 'Select due date' : d.toLocaleDateString('en-US'); } catch { return 'Select due date'; } })()}
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      <PremiumDateTimePicker
                        visible={showDatePicker}
                        value={selectedDate || new Date()}
                        minimumDate={new Date()}
                        onClose={() => setShowDatePicker(false)}
                        onChange={(date) => {
                          setSelectedDate(date);
                          setForm(prev => ({ ...prev, due_date: date.toISOString() }));
                        }}
                      />
                    </View>

                    <TouchableOpacity style={styles.primaryBtn} onPress={async () => { await handleSave(); setDetailTaskId(null); }} disabled={saving || !form.title.trim()}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Changes</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.deleteModalBtn} onPress={async () => { if (detailTaskId) { await deleteTask(detailTaskId); setDetailTaskId(null); } }}>
                      <IconTrash size={18} color={colors.danger} />
                      <Text style={styles.deleteModalBtnText}>Delete This Task</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ paddingVertical: 10 }}>
                    {interactions.length === 0 ? (
                      <Text style={styles.emptyLog}>No activity history yet.</Text>
                    ) : (
                      interactions.map((item, idx) => {
                        const isCompletedLog = item.content.includes('Completed');
                        const isCreatedLog = item.content.includes('created');
                        return (
                          <View key={item.id} style={styles.timelineItem}>
                            {idx < interactions.length - 1 && <View style={styles.timelineLine} />}
                            <View style={[styles.timelineDot, { 
                                backgroundColor: isCompletedLog ? colors.successLight : isCreatedLog ? colors.accentLight : colors.bgPanel,
                                borderColor: isCompletedLog ? colors.success : isCreatedLog ? colors.accent : colors.border
                            }]}>
                              {isCompletedLog ? <IconCheckmarkDone size={14} color={colors.success} /> : 
                               isCreatedLog ? <IconAdd size={14} color={colors.accent} /> :
                               <IconTime size={14} color={colors.textMuted} />
                              }
                            </View>
                            <View style={styles.timelineBody}>
                              <Text style={[styles.timelineContent, isCompletedLog && { color: colors.success, fontWeight: '700' }]}>{item.content}</Text>
                              <View style={styles.timelineDateRow}>
                                <IconCalendar size={10} color={colors.textMuted} />
                                <Text style={styles.timelineDate}>
                                  {(() => { try { const d = new Date(item.created_at); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

function getStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
    headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.full,
      elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
    },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    summaryRow: {
      flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
    },
    summaryCard: {
      flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.border, padding: spacing.md,
      alignItems: 'center', minHeight: 90, maxHeight: 110, justifyContent: 'center',
    },
    summaryIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    summaryCount: { fontSize: 22, fontWeight: '800' },
    summaryLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '500', textAlign: 'center' },
    filterRow: {
      flexDirection: 'row', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, alignItems: 'center',
    },
    filterPill: {
      height: 36, paddingHorizontal: 16, borderRadius: radius.full,
      borderWidth: 1, borderColor: colors.border, marginRight: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    filterPillActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
    filterPillText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
    filterPillTextActive: { color: colors.accent },
    taskCard: {
      width: CARD_WIDTH, backgroundColor: colors.bgCard, borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden', minHeight: 160,
    },
    taskCardDone: { opacity: 0.5 },
    priorityBar: { height: 4, width: '100%' },
    cardInner: { flex: 1, padding: spacing.md, gap: 8 },
    taskTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, lineHeight: 20 },
    taskTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
    priorityBadge: {
      alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: radius.full, borderWidth: 1,
    },
    priorityText: { fontSize: 10, fontWeight: '700' },
    dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dueDateText: { fontSize: 11, color: colors.textMuted },
    overdueText: { color: colors.danger, fontWeight: '600' },
    cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    checkBtn: { padding: 2 },
    emptyText: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
    emptySubText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
    bottomSheet: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    bottomSheetContent: {
      backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: spacing.xl, gap: 14,
    },
    sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center' },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    cancelIconBtn: { padding: 4 },
    fieldLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
    fieldInput: {
      backgroundColor: colors.bgPanel,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      color: colors.textPrimary, padding: 14, fontSize: 14,
    },
    datePickerContainer: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.bgPanel,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 50,
    },
    datePickerBtnText: { flex: 1, fontSize: 14, color: colors.textPrimary },
    priorityOptionBtn: {
      flex: 1, paddingVertical: 8, borderRadius: radius.full,
      borderWidth: 1, alignItems: 'center',
    },
    priorityOptionText: { fontSize: 12, fontWeight: '700' },
    primaryBtn: {
      backgroundColor: colors.accent, borderRadius: radius.md,
      paddingVertical: 14, alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    cancelBtn: {
      borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    cancelBtnText: { color: colors.textMuted, fontWeight: '500' },
    historyBtn: { padding: 8 },
    deleteBtn: { padding: 8 },
    deleteModalBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginTop: 12, paddingVertical: 12, borderRadius: radius.md,
      borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'transparent'
    },
    deleteModalBtnText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
    clientChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
      borderWidth: 1, borderColor: colors.border,
    },
    clientChipActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
    clientChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheetMenu: {
      backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: spacing.xl, gap: 10,
    },
    menuHeaderTitle: { fontSize: 16, fontWeight: '700', color: colors.textMuted, textAlign: 'center', marginBottom: 10 },
    menuItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    menuIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    menuItemText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    menuItemCancel: { paddingVertical: 16, alignItems: 'center', marginTop: 10 },
    menuCancelText: { fontSize: 16, fontWeight: '700', color: colors.danger },
    
    // Tab styles
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: colors.accent },
    tabBtnText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    tabBtnTextActive: { color: colors.accent },
    
    // New Timeline styles
    timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 20, position: 'relative' },
    timelineDot: {
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, flexShrink: 0,
      zIndex: 1, backgroundColor: colors.bgCard,
    },
    timelineLine: {
      position: 'absolute', left: 15, top: 32,
      width: 2, bottom: -20, backgroundColor: colors.border,
    },
    timelineBody: { flex: 1, paddingTop: 4 },
    timelineContent: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginBottom: 4 },
    timelineDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timelineDate: { fontSize: 12, color: colors.textMuted },
    completedBadge: { 
      flexDirection: 'row', alignItems: 'center', gap: 4, 
      backgroundColor: colors.successLight, paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: 4, alignSelf: 'flex-start', marginTop: 4,
    },
    completedBadgeText: { fontSize: 10, fontWeight: '700', color: colors.success },
    emptyLog: { color: colors.textMuted, textAlign: 'center', padding: 20 },
  });
}
