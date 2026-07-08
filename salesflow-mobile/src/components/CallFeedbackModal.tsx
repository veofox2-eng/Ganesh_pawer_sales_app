import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import PremiumDateTimePicker from './PremiumDateTimePicker';
import { supabase } from '../lib/supabase';
import { scheduleClientReminder } from '../lib/Notifications';
import { spacing, radius, STATUS_COLORS } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconCheck, IconClose, IconCalendar, IconTime } from '../lib/Icons';

interface CallFeedbackModalProps {
  visible: boolean;
  clientId: string;
  clientName: string;
  startTime?: number; // Added to calculate duration
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CallFeedbackModal({
  visible, clientId, clientName, startTime, onClose, onSuccess
}: CallFeedbackModalProps) {
  const { colors, isDark } = useTheme();
  const [step, setStep] = useState<'loading' | 'pickup' | 'outcome' | 'followup' | 'notes'>('loading');
  const [isFirstCall, setIsFirstCall] = useState(true);
  const [pickedUp, setPickedUp] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [callNotes, setCallNotes] = useState('');

  // Follow-up state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [clientPhone, setClientPhone] = useState('');

  useEffect(() => {
    if (visible && clientId) {
      checkClientHistory();
    }
  }, [visible, clientId]);

  const checkClientHistory = async () => {
    setStep('loading');
    try {
      const { data: client } = await supabase.from('clients').select('status, reminder_date, phone').eq('id', clientId).single();
      const { data: interactions } = await supabase.from('interactions').select('id').eq('client_id', clientId).limit(1);
      
      const hasInteractions = interactions && interactions.length > 0;
      const isStatusChanged = client && (client.status !== 'Follow-up' || client.reminder_date);
      
      setIsFirstCall(!hasInteractions && !isStatusChanged);
      
      if (client?.phone) {
        setClientPhone(client.phone);
      }

      if (client?.reminder_date) {
        setSelectedDate(new Date(client.reminder_date));
      } else {
        const tmrw = new Date();
        tmrw.setDate(tmrw.getDate() + 1);
        setSelectedDate(tmrw);
      }
      setStep('pickup');
    } catch (e) {
      setIsFirstCall(true);
      setStep('pickup');
    }
  };

  const reset = () => {
    setStep('loading');
    setPickedUp(null);
    setLoading(false);
    setCallNotes('');
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => v < 10 ? '0' + v : v).join(':');
  };

  const handlePickup = async (didPickUp: boolean) => {
    setPickedUp(didPickUp);
    
    // Log pickup status immediately to timeline
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let content = didPickUp ? 'Client picked call' : "Client didn't pick call";
      
      if (didPickUp && startTime) {
        const duration = Date.now() - startTime;
        content += ` (Duration: ${formatDuration(duration)})`;
      }

      const { error: insertError } = await supabase.from('interactions').insert({
        client_id: clientId,
        user_id: user?.id,
        type: 'CALL_MADE',
        content: content,
        author: 'System',
      });
      
      if (insertError) throw insertError;
      
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error('Error logging pickup status:', e);
    }

    if (isFirstCall) {
      setStep('outcome');
    } else {
      setStep('notes');
    }
  };

  const updateStatus = async (status: 'Converted' | 'Follow-up' | 'Lost', reminderDate?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          status,
          reminder_date: reminderDate || null,
        })
        .eq('id', clientId);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('interactions').insert({
        client_id: clientId,
        user_id: user?.id,
        type: 'NOTE_ADDED',
        content: `Call Outcome: ${status}${pickedUp ? ' (Picked up)' : ' (No answer)'}${reminderDate ? ' - Reminder set for ' + new Date(reminderDate).toLocaleString() : ''}`,
        author: 'System',
      });

      if (onSuccess) onSuccess();
      onClose();
      reset();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const saveNotesAndReminder = async () => {
    setLoading(true);
    try {
      const isoDate = selectedDate.toISOString();
      
      await supabase.from('clients').update({ reminder_date: isoDate }).eq('id', clientId);
      
      await scheduleClientReminder(
        'Follow-up Reminder',
        `Call ${clientName} today as scheduled.`,
        selectedDate,
        { clientId, phone: clientPhone }
      );

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('interactions').insert({
        client_id: clientId,
        user_id: user?.id,
        type: 'NOTE_ADDED',
        content: `Call Notes: ${callNotes || (pickedUp ? 'Picked up' : 'No answer')}\nNext Follow-up: ${selectedDate.toLocaleString()}`,
        author: 'Employee',
      });

      if (onSuccess) onSuccess();
      onClose();
      reset();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleFollowupSave = async () => {
    const isoDate = selectedDate.toISOString();
    await scheduleClientReminder(
      'Follow-up Reminder',
      `Call ${clientName} today as scheduled.`,
      selectedDate,
      { clientId, phone: clientPhone }
    );
    await updateStatus('Follow-up', isoDate);
  };

  const renderPickup = () => (
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Did {clientName} pick up the call?</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => handlePickup(true)}>
          <Text style={styles.btnText}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.danger }]} onPress={() => handlePickup(false)}>
          <Text style={styles.btnText}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOutcome = () => {
    const options = pickedUp ? ['Converted', 'Follow-up', 'Lost'] : ['Follow-up', 'Lost'];
    return (
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Select Outcome</Text>
        <View style={styles.outcomeRow}>
          {options.map((opt: any) => (
            <TouchableOpacity 
              key={opt}
              style={[styles.outcomeBtn, { borderColor: colors.border }]}
              onPress={() => opt === 'Follow-up' ? setStep('followup') : updateStatus(opt)}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderFollowup = () => (
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Schedule Follow-up</Text>
      
      <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.bgPanel, borderColor: colors.border }]} onPress={() => setShowDatePicker(true)}>
        <IconCalendar size={20} color={colors.accent} />
        <Text style={{ color: colors.textPrimary, marginLeft: 10 }}>{selectedDate.toLocaleDateString()}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.bgPanel, borderColor: colors.border }]} onPress={() => setShowTimePicker(true)}>
        <IconTime size={20} color={colors.accent} />
        <Text style={{ color: colors.textPrimary, marginLeft: 10 }}>{selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleFollowupSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Set Reminder</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderNotes = () => (
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Why did you call?</Text>
      <TextInput
        style={[styles.textArea, { backgroundColor: colors.bgPanel, color: colors.textPrimary, borderColor: colors.border }]}
        placeholder="Enter call notes or outcome..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={3}
        value={callNotes}
        onChangeText={setCallNotes}
      />

      <Text style={[styles.title, { color: colors.textPrimary, fontSize: 16, marginTop: 10 }]}>Update Follow-up (Optional)</Text>
      <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
        <TouchableOpacity style={[styles.pickerBtn, { flex: 1, backgroundColor: colors.bgPanel, borderColor: colors.border }]} onPress={() => setShowDatePicker(true)}>
          <IconCalendar size={18} color={colors.accent} />
          <Text style={{ color: colors.textPrimary, marginLeft: 8, fontSize: 13 }}>{selectedDate.toLocaleDateString()}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickerBtn, { flex: 1, backgroundColor: colors.bgPanel, borderColor: colors.border }]} onPress={() => setShowTimePicker(true)}>
          <IconTime size={18} color={colors.accent} />
          <Text style={{ color: colors.textPrimary, marginLeft: 8, fontSize: 13 }}>{selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={saveNotesAndReminder} disabled={loading || !callNotes.trim()}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Notes</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.bgCard }]}>
          
          {step === 'loading' && <ActivityIndicator size="large" color={colors.accent} style={{ margin: 40 }} />}
          {step === 'pickup' && renderPickup()}
          {step === 'outcome' && renderOutcome()}
          {step === 'followup' && renderFollowup()}
          {step === 'notes' && renderNotes()}
          
          <PremiumDateTimePicker
            visible={showDatePicker || showTimePicker}
            value={selectedDate}
            minimumDate={new Date()}
            onClose={() => {
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
            onChange={(date) => {
              setSelectedDate(date);
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: spacing.xl,
  },
  modal: {
    width: '100%', borderRadius: radius.xl, padding: spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },
  closeIcon: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  content: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12, width: '100%' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  outcomeRow: { width: '100%', gap: 10 },
  outcomeBtn: { width: '100%', paddingVertical: 16, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md, borderWidth: 1, width: '100%' },
  saveBtn: { width: '100%', paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 10 },
  textArea: { width: '100%', height: 80, borderRadius: radius.md, borderWidth: 1, padding: 12, textAlignVertical: 'top' },
});
