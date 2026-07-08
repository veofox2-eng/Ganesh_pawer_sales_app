import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, MessageSquare, Plus, Search, X, User, Clock,
  Calendar, Trash2, FileText, Image, Mic, MicOff,
  PhoneCall, DollarSign, Paperclip, AlertCircle, StopCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import styles from './CallSheet.module.css';

type Status = 'Follow-up' | 'Converted' | 'Lost';
type DrawerTab = 'add' | 'timeline' | 'payments';
type InputMode = 'note' | 'voice' | 'file';

interface Client {
  id: string; name: string; phone: string; email?: string;
  project_name?: string; source?: string; status: Status;
  reason_for_contact?: string; reminder_date?: string;
  deal_value?: number; is_deleted: boolean;
  created_at: string; user_id: string;
}

interface Interaction {
  id: string; client_id: string; type: string;
  content?: string; media_url?: string; amount?: number;
  author?: string; created_at: string;
}

interface Payment {
  id: string; client_id: string; type: string;
  payment_frequency: string; amount: number;
  description?: string; due_date?: string;
  is_cleared: boolean; created_at: string;
}

const STATUS_STYLE: Record<Status, string> = {
  'Follow-up': styles.statusFollowup,
  'Converted': styles.statusConverted,
  'Lost': styles.statusLost,
};

const FILTERS = ['All', 'Follow-up', 'Converted', 'Lost'];
const SUPABASE_URL = 'https://korgtxyzpznaondfiytk.supabase.co';

function getPublicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/client-attachments/${path}`;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getInteractionIcon(type: string) {
  switch (type) {
    case 'NOTE_ADDED': return { icon: FileText, cls: styles.dotNote, label: 'Note Added' };
    case 'CALL_MADE': return { icon: PhoneCall, cls: styles.dotCall, label: 'Call Logged' };
    case 'CALL_RECORDING': return { icon: StopCircle, cls: styles.dotRecording, label: 'Call Recording' };
    case 'VOICE_INSTRUCTION': return { icon: Mic, cls: styles.dotVoice, label: 'Voice Note' };
    case 'ATTACHMENT_ADDED': return { icon: Paperclip, cls: styles.dotAttachment, label: 'Attachment' };
    case 'PAYMENT_RECEIVED': return { icon: DollarSign, cls: styles.dotPayment, label: 'Payment' };
    default: return { icon: FileText, cls: styles.dotNote, label: type };
  }
}

export function CallSheet() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('add');
  const [inputMode, setInputMode] = useState<InputMode>('note');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [clientPayments, setClientPayments] = useState<Payment[]>([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [logCallNote, setLogCallNote] = useState('');

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', phone: '', email: '', project_name: '', source: '',
    status: 'Follow-up' as Status, reason_for_contact: '',
    reminder_date: '', deal_value: '',
  });

  useEffect(() => { fetchClients(); }, []);

  async function fetchClients() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('clients').select('*')
      .eq('user_id', user.id).eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (data) setClients(data);
    setLoading(false);
  }

  const openClientDrawer = useCallback(async (client: Client) => {
    setSelectedClient(client);
    setDrawerTab('add');
    setInteractions([]);
    setClientPayments([]);
    // Fetch interactions
    const { data: intData } = await supabase
      .from('interactions').select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    if (intData) setInteractions(intData);
    // Fetch payments for this client
    const { data: payData } = await supabase
      .from('payments').select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    if (payData) setClientPayments(payData);
  }, []);

  async function handleSaveClient() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('clients').insert({
      name: form.name, phone: form.phone, email: form.email || null,
      project_name: form.project_name || null, source: form.source || 'Manual',
      status: form.status, reason_for_contact: form.reason_for_contact || null,
      reminder_date: form.reminder_date || null,
      deal_value: form.deal_value ? parseFloat(form.deal_value) : 0,
      user_id: user.id, is_deleted: false,
    }).select().single();
    if (!error && data) { setClients(prev => [data, ...prev]); setShowModal(false); resetForm(); }
    setSaving(false);
  }

  async function handleStatusChange(clientId: string, status: Status) {
    await supabase.from('clients').update({ status }).eq('id', clientId);
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status } : c));
    if (selectedClient?.id === clientId) setSelectedClient(prev => prev ? { ...prev, status } : prev);
  }

  async function handleDelete(clientId: string) {
    await supabase.from('clients').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', clientId);
    setClients(prev => prev.filter(c => c.id !== clientId));
    if (selectedClient?.id === clientId) setSelectedClient(null);
  }

  async function addInteraction(type: string, content?: string, mediaUrl?: string, amount?: number) {
    if (!selectedClient) return;
    const { data } = await supabase.from('interactions').insert({
      client_id: selectedClient.id, type, content: content || null,
      media_url: mediaUrl || null, amount: amount || null, author: 'You',
    }).select().single();
    if (data) setInteractions(prev => [data, ...prev]);
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    await addInteraction('NOTE_ADDED', newNote.trim());
    setNewNote('');
    setSavingNote(false);
  }

  async function handleLogCall() {
    await addInteraction('CALL_MADE', logCallNote || `Called ${selectedClient?.name}`);
    setLogCallNote('');
    setShowLogCallModal(false);
  }

  // ─── Voice Recording ───
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        await uploadAudio(blob, 'VOICE_INSTRUCTION');
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingInterval.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      alert('Microphone permission required');
    }
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    if (recordingInterval.current) clearInterval(recordingInterval.current);
    setIsRecording(false);
  }

  async function uploadAudio(blob: Blob, type: 'VOICE_INSTRUCTION' | 'CALL_RECORDING') {
    if (!selectedClient) return;
    setUploading(true);
    const fileName = `${selectedClient.id}/${Date.now()}.webm`;
    const { data, error } = await supabase.storage.from('client-attachments').upload(fileName, blob);
    if (!error && data) {
      const url = getPublicUrl(data.path);
      await addInteraction(type, type === 'CALL_RECORDING' ? 'Call Recording' : 'Voice Note', url);
    }
    setUploading(false);
  }

  // ─── File Upload ───
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !selectedClient) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fileName = `${selectedClient.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('client-attachments').upload(fileName, file);
      if (!error && data) {
        const url = getPublicUrl(data.path);
        const isImage = file.type.startsWith('image/');
        await addInteraction('ATTACHMENT_ADDED', file.name, url);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleCallRecordingUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedClient) return;
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    await uploadAudio(blob, 'CALL_RECORDING');
  }

  function resetForm() {
    setForm({ name: '', phone: '', email: '', project_name: '', source: '', status: 'Follow-up', reason_for_contact: '', reminder_date: '', deal_value: '' });
  }

  const filtered = clients.filter(c => {
    const matchStatus = filter === 'All' || c.status === filter;
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.project_name || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Build unified timeline (interactions + payments)
  const timelineItems = [
    ...interactions.map(i => ({ ...i, _kind: 'interaction' as const })),
    ...clientPayments.map(p => ({
      id: p.id, client_id: p.client_id,
      type: 'PAYMENT_RECEIVED', content: p.description || `${p.type} · ${p.payment_frequency}`,
      amount: p.amount, media_url: undefined, created_at: p.created_at,
      _kind: 'payment' as const, _payment: p,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Client <span>Call Sheet</span></h1>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Client
        </button>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input className={styles.searchInput} placeholder="Search by name, phone or project..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}>{f}</button>
        ))}
      </div>

      {/* Client List */}
      <div className={styles.clientGrid}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.clientCard} style={{ opacity: 0.3, minHeight: 80 }} />
          ))
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <User size={56} className={styles.emptyIcon} />
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No clients found</p>
            <p style={{ fontSize: '0.9rem' }}>Add your first client using the button above.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((client, i) => (
              <motion.div key={client.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }} transition={{ delay: i * 0.04 }}
                className={styles.clientCard} onClick={() => openClientDrawer(client)}
              >
                <div className={styles.clientAvatar}>{getInitials(client.name)}</div>
                <div className={styles.clientInfo}>
                  <div className={styles.clientName}>{client.name}</div>
                  <div className={styles.clientMeta}>
                    {client.phone && <span className={styles.clientPhone}><Phone size={12} /> {client.phone}</span>}
                    {client.project_name && <span className={styles.clientProject}>{client.project_name}</span>}
                    {client.reminder_date && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {formatDate(client.reminder_date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.clientActions} onClick={e => e.stopPropagation()}>
                  <select
                    className={`${styles.statusBadge} ${STATUS_STYLE[client.status]}`}
                    value={client.status}
                    onChange={e => handleStatusChange(client.id, e.target.value as Status)}
                    onClick={e => e.stopPropagation()}
                    style={{ appearance: 'none', border: 'none', outline: 'none', cursor: 'pointer', padding: '0.3rem 0.75rem', background: 'transparent' }}
                  >
                    <option value="Follow-up">Follow-up</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                  </select>
                  <button className={`${styles.actionBtn} ${styles.callBtn}`}
                    onClick={() => window.open(`tel:${client.phone}`)}><Phone size={15} /></button>
                  <button className={`${styles.actionBtn} ${styles.waBtn}`}
                    onClick={() => window.open(`https://wa.me/${(client.phone || '').replace(/\D/g, '')}`)}><MessageSquare size={15} /></button>
                  <button className={styles.actionBtn} style={{ color: 'var(--danger)' }}
                    onClick={() => handleDelete(client.id)}><Trash2 size={15} /></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add Client Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={styles.modalOverlay} onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <span className={styles.modalTitle}>Add New Client</span>
                <button className={styles.closeBtn} onClick={() => setShowModal(false)}><X size={18} /></button>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Full Name *</label>
                    <input className={styles.formInput} placeholder="Enter name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Phone Number</label>
                    <input className={styles.formInput} placeholder="+91 99999 99999" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email</label>
                    <input className={styles.formInput} type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Project Name</label>
                    <input className={styles.formInput} placeholder="Project name" value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Lead Source</label>
                    <select className={styles.formSelect} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                      <option value="">Select source</option>
                      <option>WhatsApp</option><option>Facebook</option><option>Instagram</option>
                      <option>Referral</option><option>Website</option><option>Manual</option><option>Other</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Status</label>
                    <select className={styles.formSelect} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Converted">Converted</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Deal Value (₹)</label>
                    <input className={styles.formInput} type="number" placeholder="0" value={form.deal_value} onChange={e => setForm({ ...form, deal_value: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Reminder Date & Time</label>
                    <input className={styles.formInput} type="datetime-local" value={form.reminder_date} onChange={e => setForm({ ...form, reminder_date: e.target.value })} />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Reason for Contact</label>
                  <textarea className={styles.formTextarea} placeholder="Why are you contacting this client?" value={form.reason_for_contact} onChange={e => setForm({ ...form, reason_for_contact: e.target.value })} />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button className={styles.saveBtn} onClick={handleSaveClient} disabled={saving || !form.name.trim()}>
                  {saving ? 'Saving...' : 'Add Client'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Call Modal */}
      <AnimatePresence>
        {showLogCallModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={styles.modalOverlay} onClick={() => setShowLogCallModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className={styles.modal} style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <span className={styles.modalTitle}>Log a Call</span>
                <button className={styles.closeBtn} onClick={() => setShowLogCallModal(false)}><X size={18} /></button>
              </div>
              <div className={styles.callLogForm}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Call Notes (optional)</label>
                  <textarea className={styles.formTextarea} placeholder="What was discussed?" value={logCallNote} onChange={e => setLogCallNote(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Upload Call Recording (optional)</label>
                  <input type="file" accept="audio/*,video/*" onChange={handleCallRecordingUpload}
                    style={{ display: 'none' }} id="callRecordingInput" />
                  <label htmlFor="callRecordingInput" className={styles.fileDropZone} style={{ cursor: 'pointer' }}>
                    <StopCircle size={24} style={{ margin: '0 auto', color: 'var(--danger)', display: 'block' }} />
                    <div className={styles.fileDropText}>Click to upload call recording (MP3, M4A, MP4, etc.)</div>
                  </label>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => setShowLogCallModal(false)}>Cancel</button>
                <button className={styles.saveBtn} onClick={handleLogCall}>Save Call Log</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Enhanced Drawer ─── */}
      <AnimatePresence>
        {selectedClient && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 89 }}
              onClick={() => setSelectedClient(null)} />
            <motion.div initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className={styles.drawer}>

              {/* Drawer Header */}
              <div className={styles.drawerHeader}>
                <div className={styles.drawerAvatar}>{getInitials(selectedClient.name)}</div>
                <div className={styles.drawerClientInfo}>
                  <div className={styles.drawerName}>{selectedClient.name}</div>
                  {selectedClient.phone && (
                    <div className={styles.drawerPhone}><Phone size={13} />{selectedClient.phone}</div>
                  )}
                  <select
                    className={`${styles.statusSelect} ${styles.statusBadge} ${STATUS_STYLE[selectedClient.status]}`}
                    value={selectedClient.status}
                    onChange={e => handleStatusChange(selectedClient.id, e.target.value as Status)}
                  >
                    <option value="Follow-up">Follow-up</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
                <button className={styles.closeBtn} onClick={() => setSelectedClient(null)}
                  style={{ marginLeft: 'auto', alignSelf: 'flex-start' }}><X size={18} /></button>
              </div>

              {/* Quick Actions */}
              <div className={styles.quickActions}>
                {selectedClient.phone && (
                  <button className={`${styles.qaBtn} ${styles.qaCallBtn}`}
                    onClick={() => window.open(`tel:${selectedClient.phone}`)}>
                    <Phone size={14} /> Call
                  </button>
                )}
                {selectedClient.phone && (
                  <button className={`${styles.qaBtn} ${styles.qaWaBtn}`}
                    onClick={() => window.open(`https://wa.me/${(selectedClient.phone || '').replace(/\D/g, '')}`)}>
                    <MessageSquare size={14} /> WhatsApp
                  </button>
                )}
                <button className={`${styles.qaBtn} ${styles.qaLogBtn}`}
                  onClick={() => setShowLogCallModal(true)}>
                  <PhoneCall size={14} /> Log Call
                </button>
                {selectedClient.deal_value ? (
                  <div style={{ marginLeft: 'auto', fontSize: '0.9rem', color: 'var(--success)', fontWeight: 700 }}>
                    ₹{selectedClient.deal_value.toLocaleString('en-IN')}
                  </div>
                ) : null}
              </div>

              {/* Tabs */}
              <div className={styles.drawerTabs}>
                {([['add', 'Add Content'], ['timeline', 'Timeline'], ['payments', `Payments (${clientPayments.length})`]] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setDrawerTab(key as DrawerTab)}
                    className={`${styles.drawerTab} ${drawerTab === key ? styles.drawerTabActive : ''}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Drawer Body */}
              <div className={styles.drawerBody}>
                {/* ── ADD CONTENT TAB ── */}
                {drawerTab === 'add' && (
                  <div className={styles.addSection}>
                    {/* Input Mode switcher */}
                    <div className={styles.inputTypeTabs}>
                      {([['note', 'Note', FileText], ['voice', 'Voice', Mic], ['file', 'File / Image', Paperclip]] as const).map(([mode, label, Icon]) => (
                        <button key={mode} onClick={() => setInputMode(mode as InputMode)}
                          className={`${styles.inputTypeBtn} ${inputMode === mode ? styles.inputTypeBtnActive : ''}`}>
                          <Icon size={13} /> {label}
                        </button>
                      ))}
                    </div>

                    {/* Note */}
                    {inputMode === 'note' && (
                      <>
                        <textarea className={styles.noteInput} placeholder="Write a note, instruction or update..."
                          value={newNote} onChange={e => setNewNote(e.target.value)} rows={4} />
                        <div className={styles.submitRow}>
                          <button className={styles.noteSubmitBtn} onClick={handleAddNote}
                            disabled={savingNote || !newNote.trim()}>
                            {savingNote ? 'Saving...' : 'Save Note'}
                          </button>
                        </div>
                      </>
                    )}

                    {/* Voice Note */}
                    {inputMode === 'voice' && (
                      <div className={styles.voiceRecorder}>
                        <div className={styles.recorderStatus}>
                          {isRecording
                            ? `Recording… ${Math.floor(recordingTime / 60).toString().padStart(2, '0')}:${(recordingTime % 60).toString().padStart(2, '0')}`
                            : uploading ? 'Uploading voice note...'
                            : 'Tap the button to start recording a voice note'}
                        </div>
                        <div className={styles.recorderControls}>
                          {!isRecording ? (
                            <button className={`${styles.recordBtn} ${styles.recordStartBtn}`} onClick={startRecording} disabled={uploading}>
                              <div className={styles.recordingDot} style={{ animation: 'none', background: 'var(--danger)' }} />
                              Start Recording
                            </button>
                          ) : (
                            <button className={`${styles.recordBtn} ${styles.recordStopBtn}`} onClick={stopRecording}>
                              <MicOff size={15} /> Stop & Save
                            </button>
                          )}
                        </div>
                        {uploading && <div className={styles.uploadingBar} />}
                      </div>
                    )}

                    {/* File / Image Upload */}
                    {inputMode === 'file' && (
                      <>
                        <input type="file" ref={fileInputRef} multiple
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                          onChange={handleFileUpload} style={{ display: 'none' }} />
                        <div className={styles.fileDropZone} onClick={() => fileInputRef.current?.click()}>
                          <Image size={28} style={{ margin: '0 auto', color: 'var(--accent-primary)', display: 'block' }} />
                          <div className={styles.fileDropText}>
                            Click to upload images or documents<br />
                            <span style={{ fontSize: '0.78rem' }}>PNG, JPG, PDF, DOC, XLS supported</span>
                          </div>
                          {uploading && <div className={styles.uploadingBar} />}
                        </div>
                      </>
                    )}

                    {/* Show recent media from interactions */}
                    {interactions.filter(i => i.media_url && (i.type === 'ATTACHMENT_ADDED')).length > 0 && (
                      <>
                        <div className={styles.sectionTitle}>Attachments</div>
                        <div className={styles.mediaGrid}>
                          {interactions.filter(i => i.media_url && i.type === 'ATTACHMENT_ADDED').map(i => {
                            const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(i.media_url || '');
                            return isImg ? (
                              <a key={i.id} href={i.media_url} target="_blank" rel="noreferrer" className={styles.mediaThumb}>
                                <img src={i.media_url} alt={i.content || 'attachment'} />
                              </a>
                            ) : (
                              <a key={i.id} href={i.media_url} target="_blank" rel="noreferrer" className={styles.mediaDoc}>
                                <FileText size={20} color="#6366f1" />
                                <div className={styles.mediaDocName}>{i.content}</div>
                              </a>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Show voice notes */}
                    {interactions.filter(i => i.media_url && (i.type === 'VOICE_INSTRUCTION' || i.type === 'CALL_RECORDING')).map(i => (
                      <div key={i.id} className={styles.audioItem}>
                        <div>
                          <div className={styles.audioLabel}>{i.type === 'CALL_RECORDING' ? '📞 Call Recording' : '🎤 Voice Note'}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{formatDate(i.created_at)}</div>
                        </div>
                        <audio src={i.media_url} controls className={undefined} style={{ flex: 1, height: 36 }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* ── TIMELINE TAB ── */}
                {drawerTab === 'timeline' && (
                  <div>
                    <div className={styles.sectionTitle}>All Activity (Newest First)</div>
                    {timelineItems.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                        No activities yet. Add notes, log calls, or make payments.
                      </p>
                    ) : (
                      <div className={styles.timeline}>
                        {timelineItems.map((item: any) => {
                          const { icon: Icon, cls, label } = getInteractionIcon(item.type);
                          return (
                            <div key={item.id} className={styles.timelineItem}>
                              <div className={`${styles.timelineDotWrap} ${cls}`}>
                                <Icon size={14} />
                              </div>
                              <div className={styles.timelineContent}>
                                <div className={`${styles.timelineType} ${cls}`} style={{ color: 'inherit' }}>{label}</div>
                                {item.content && <div className={styles.timelineText}>{item.content}</div>}
                                {item.media_url && (item.type === 'VOICE_INSTRUCTION' || item.type === 'CALL_RECORDING') && (
                                  <audio src={item.media_url} controls style={{ marginTop: '0.5rem', height: 32, width: '100%' }} />
                                )}
                                {item.media_url && item.type === 'ATTACHMENT_ADDED' && (
                                  (() => {
                                    const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(item.media_url || '');
                                    return isImg
                                      ? <a href={item.media_url} target="_blank" rel="noreferrer"><img src={item.media_url} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 6 }} /></a>
                                      : <a href={item.media_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: 'var(--accent-primary)' }}>{item.content}</a>;
                                  })()
                                )}
                                {item._kind === 'payment' && item.amount && (
                                  <div className={styles.timelineAmount}>
                                    {item._payment?.type === 'Income' ? '+' : '-'}₹{Number(item.amount).toLocaleString('en-IN')}
                                    <span style={{ fontSize: '0.75rem', color: item._payment?.is_cleared ? 'var(--success)' : 'var(--warning)', marginLeft: 8 }}>
                                      {item._payment?.is_cleared ? '✓ Cleared' : '⏳ Pending'}
                                    </span>
                                  </div>
                                )}
                                <div className={styles.timelineDate}>{formatDate(item.created_at)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── PAYMENTS TAB ── */}
                {drawerTab === 'payments' && (
                  <div>
                    <div className={styles.sectionTitle}>Client Payments</div>
                    {clientPayments.length === 0 ? (
                      <div className={styles.noPayments}>
                        <DollarSign size={36} style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.3 }} />
                        <p>No payments linked to this client yet.</p>
                        <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Add a payment from the Payments module.</p>
                      </div>
                    ) : (
                      <>
                        {/* Summary */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                          {[
                            { label: 'Income', val: clientPayments.filter(p => p.type === 'Income').reduce((s, p) => s + p.amount, 0), color: 'var(--success)' },
                            { label: 'Expense', val: clientPayments.filter(p => p.type === 'Expense').reduce((s, p) => s + p.amount, 0), color: 'var(--danger)' },
                          ].map(({ label, val, color }) => (
                            <div key={label} style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>₹{val.toLocaleString('en-IN')}</div>
                            </div>
                          ))}
                        </div>
                        {clientPayments.map(p => (
                          <div key={p.id} className={styles.paymentItem}>
                            <div className={styles.paymentItemLeft}>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: p.type === 'Income' ? 'var(--success)' : 'var(--danger)' }}>
                                {p.type === 'Income' ? '↑' : '↓'} {p.type}
                              </div>
                              {p.description && <div className={styles.paymentItemDesc}>{p.description}</div>}
                              <div className={styles.paymentItemDate}>{formatDate(p.created_at)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className={`${styles.paymentItemAmount} ${p.type === 'Income' ? styles.paymentItemIncome : styles.paymentItemExpense}`}>
                                ₹{Number(p.amount).toLocaleString('en-IN')}
                              </div>
                              {p.is_cleared
                                ? <div className={styles.paymentCleared}>✓ Cleared</div>
                                : <div className={styles.paymentPending}><AlertCircle size={11} /> Pending</div>}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input type="file" ref={fileInputRef} multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileUpload} style={{ display: 'none' }} />
    </div>
  );
}
