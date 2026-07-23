import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserMinus, Archive, Calendar, Users, PhoneCall, Building, ArrowLeft, CheckCircle, MessageCircle, FileText, Paperclip, Play, Pause } from 'lucide-react';

const formatDateTimeDDMMYYYY = (dateObj: Date) => {
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear();
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${d}-${m}-${y}, ${timeStr}`;
};

/* ── Custom Audio Player ───────────────────────────────── */
function CustomAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => { setIsPlaying(false); setProgress(0); };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (t: number) => {
    if (isNaN(t) || t === 0) return '0:00';
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 24, padding: '6px 16px 6px 6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      width: '100%', maxWidth: 400
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button 
        onClick={togglePlay}
        style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
        }}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input 
          type="range" min="0" max={duration || 100} value={progress} onChange={handleSeek}
          style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--border)', appearance: 'none', outline: 'none', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Stat Card ─────────────────────────────────────────── */
function StatCard({ title, value, icon, highlight = false, isActive = false, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        background: isActive ? 'var(--accent)' : 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.02))', 
        border: `1px solid ${isActive ? 'var(--accent)' : highlight ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`, 
        borderRadius: 16, padding: '1.25rem', 
        display: 'flex', flexDirection: 'column', gap: '0.75rem', 
        boxShadow: isActive ? '0 8px 25px rgba(99,102,241,0.3)' : '0 4px 15px rgba(0,0,0,0.02)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        transform: isActive ? 'translateY(-2px)' : 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--muted)' }}>
        {icon} <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: isActive ? '#fff' : 'var(--text)', lineHeight: 1 }}>{value}</div>
    </div>
  );
}

export default function ExEmployeesDashboard() {
  const [exEmployees, setExEmployees] = useState<{ id: string, name: string }[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [selectedExName, setSelectedExName] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dashboardScrollPos = useRef<number>(0);

  useEffect(() => {
    async function fetchArchivedClients() {
      const { data } = await supabase
        .from('clients')
        .select('*, interactions(*)')
        .eq('is_ex_employee_client', true)
        .order('created_at', { ascending: false });
        
      if (data) {
        setAllClients(data);
        const names = Array.from(new Set(data.map(c => c.ex_employee_name).filter(Boolean)));
        const uniqueExEmployees = names.map((name, index) => ({
          id: `ex_${index}`,
          name: name as string
        }));
        
        setExEmployees(uniqueExEmployees);
      }
      setLoading(false);
    }
    fetchArchivedClients();
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (selectedClientId) {
      scrollRef.current.scrollTop = 0;
    } else {
      scrollRef.current.scrollTop = dashboardScrollPos.current;
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      dashboardScrollPos.current = 0;
    }
  }, [selectedExName]);

  const filteredExEmployees = exEmployees.filter(emp => (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedExEmployee = exEmployees.find(emp => emp.name === selectedExName);
  
  const selectedClients = allClients.filter(c => c.ex_employee_name === selectedExName).map(c => {
    const cInteractions = c.interactions || [];
    return {
      ...c,
      callCount: cInteractions.filter((i:any) => i.type === 'CALL_RECORDING' || i.type === 'CALL_MADE').length,
      whatsappCount: cInteractions.filter((i:any) => i.type === 'WHATSAPP_CONTACT').length,
      noteCount: cInteractions.filter((i:any) => i.type === 'NOTE_ADDED' || i.type === 'VOICE_INSTRUCTION').length,
      attachmentCount: cInteractions.filter((i:any) => i.type === 'ATTACHMENT_ADDED').length,
      cInteractions
    }
  });

  const selectedClient = selectedClients.find(c => c.id === selectedClientId);

  const stats = {
    total: selectedClients.length,
    converted: selectedClients.length,
    callCount: selectedClients.reduce((acc, c) => acc + c.callCount, 0),
    whatsappCount: selectedClients.reduce((acc, c) => acc + c.whatsappCount, 0),
    noteCount: selectedClients.reduce((acc, c) => acc + c.noteCount, 0),
    attachmentCount: selectedClients.reduce((acc, c) => acc + c.attachmentCount, 0),
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
      
      {/* LEFT SIDEBAR: Ex-Employee List */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        style={{ width: 320, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}
      >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserMinus size={18} color="var(--accent)" />
              Ex-Employees
            </h2>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search ex-employee..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
          ) : filteredExEmployees.map(emp => {
            const clientCount = allClients.filter(c => c.ex_employee_name === emp.name).length;
            return (
              <motion.div 
                key={emp.id}
                onClick={() => { setSelectedExName(emp.name); setSelectedClientId(null); }}
                whileHover={{ boxShadow: '0 0 15px rgba(99,102,241,0.4)', borderColor: 'var(--accent)', scale: 1.02 }}
                style={{
                  padding: '1rem', borderRadius: 12, marginBottom: '0.5rem', cursor: 'pointer',
                  background: selectedExName === emp.name ? 'var(--accent)' : 'var(--bg)',
                  color: selectedExName === emp.name ? '#fff' : 'var(--text)',
                  border: selectedExName === emp.name ? '1px solid var(--accent)' : '1px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 2 }}>{emp.name}</div>
                    <div style={{ fontSize: '0.75rem', opacity: selectedExName === emp.name ? 0.9 : 0.6 }}>
                      {clientCount} Clients Archived
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
          {!loading && filteredExEmployees.length === 0 && <p style={{ padding: '1rem', color: 'var(--muted)', textAlign: 'center', fontSize: '0.85rem' }}>No ex-employees found.</p>}
        </div>
      </motion.div>

      {/* RIGHT SIDE: Detail View */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}
      >
        {!selectedExEmployee ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--muted)', gap: 12 }}>
            <Archive size={48} opacity={0.2} />
            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Select an ex-employee to view their archived clients</p>
          </div>
        ) : (
          <div ref={scrollRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            
            {/* Employee Header */}
            <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to right, rgba(99,102,241,0.05), transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, var(--accent), #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem', fontWeight: 700, boxShadow: '0 8px 20px rgba(99,102,241,0.3)' }}>
                  {selectedExEmployee.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{selectedExEmployee.name}</h1>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 500 }}>Archived Ex-Employee</p>
                </div>
              </div>
            </div>

            {selectedClient ? (
              /* --- CLIENT LEVEL REPORT --- */
              <div style={{ padding: '2.5rem' }}>
                <button 
                  onClick={() => setSelectedClientId(null)}
                  style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 600, transition: 'opacity 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <ArrowLeft size={16} /> Back to {selectedExEmployee.name}'s Portfolio
                </button>
                
                {/* Client Profile Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      {selectedClient.name || 'Unnamed Client'}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ 
                        padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        background: 'rgba(16,185,129,0.1)', color: '#10b981'
                      }}>
                        Converted
                      </span>
                      {selectedClient.phone && (
                        <span style={{ color: 'var(--muted)', fontSize: '1rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <PhoneCall size={16} /> {selectedClient.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Miniature Stats for Client */}
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Calls</span>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>{selectedClient.callCount}</span>
                    </div>
                    <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>WhatsApp</span>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>{selectedClient.whatsappCount}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))', borderRadius: 24, border: '1px solid var(--border)', padding: '2.5rem' }}>
                  <h3 style={{ margin: '0 0 2rem 0', fontSize: '1.25rem', color: 'var(--text)', fontWeight: 700 }}>
                    Interaction Timeline
                  </h3>
                  {(() => {
                    const timelineInteractions = selectedClient.cInteractions.sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                    if (timelineInteractions.length === 0) {
                      return (
                        <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg)', borderRadius: 16, border: '1px dashed var(--border)' }}>
                          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem' }}>No interactions found.</p>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', paddingLeft: '1rem' }}>
                        {/* Vertical Line */}
                        <div style={{ position: 'absolute', left: '1.9rem', top: '1rem', bottom: '1rem', width: 2, background: 'var(--border)', zIndex: 0 }} />
                        
                        {timelineInteractions.map((i: any) => (
                        <div key={i.id} style={{ display: 'flex', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
                          <div style={{ 
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: i.type === 'WHATSAPP_CONTACT' ? 'linear-gradient(135deg, #25D366, #128C7E)' : 
                                        (i.type === 'NOTE_ADDED' || i.type === 'VOICE_INSTRUCTION') ? 'linear-gradient(135deg, #eab308, #ca8a04)' :
                                        i.type === 'ATTACHMENT_ADDED' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' :
                                        'linear-gradient(135deg, var(--accent), #818cf8)',
                            color: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', border: '4px solid var(--surface)'
                          }}>
                            {i.type === 'WHATSAPP_CONTACT' ? <MessageCircle size={14} /> : 
                             (i.type === 'NOTE_ADDED' || i.type === 'VOICE_INSTRUCTION') ? <FileText size={14} /> :
                             i.type === 'ATTACHMENT_ADDED' ? <Paperclip size={14} /> :
                             <PhoneCall size={14} />}
                          </div>
                          <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                                {i.type === 'WHATSAPP_CONTACT' ? 'WhatsApp Message' : 
                                 i.type === 'NOTE_ADDED' ? 'Note Added' :
                                 i.type === 'VOICE_INSTRUCTION' ? 'Voice Instruction' :
                                 i.type === 'ATTACHMENT_ADDED' ? 'Attachment Uploaded' :
                                 i.type === 'CALL_MADE' ? 'Call Made' :
                                 'Call Logged'}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500 }}>
                                {formatDateTimeDDMMYYYY(new Date(i.created_at))}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)', opacity: 0.85, lineHeight: 1.5 }}>
                              {i.content || (
                                i.type === 'WHATSAPP_CONTACT' ? 'WhatsApp interaction logged automatically.' : 
                                i.type === 'NOTE_ADDED' ? 'Empty note.' :
                                i.type === 'VOICE_INSTRUCTION' ? 'Voice note attached.' :
                                i.type === 'ATTACHMENT_ADDED' ? 'File attached.' :
                                i.type === 'CALL_MADE' ? 'Manual call logged.' :
                                'Call recording uploaded automatically.'
                              )}
                            </p>
                            {(i.type === 'CALL_RECORDING' || i.type === 'VOICE_INSTRUCTION') && i.media_url && i.media_url !== 'DELETED' && (
                              <div style={{ marginTop: '1rem' }}>
                                <CustomAudioPlayer src={i.media_url} />
                              </div>
                            )}
                            {i.type === 'ATTACHMENT_ADDED' && i.media_url && (
                              <div style={{ marginTop: '1rem' }}>
                                <a href={i.media_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, color: 'var(--text)', textDecoration: 'none', fontSize: '0.8rem', border: '1px solid var(--border)' }}>
                                  <Paperclip size={14} /> View File Attachment
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* --- EX-EMPLOYEE LEVEL REPORT --- */
              <div style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
                  {/* Summary Stats Grid */}
                  <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Status Stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Details</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <StatCard title="Total Archived" value={stats.total.toString()} icon={<Users size={16} />} highlight={true} />
                        <StatCard title="Converted" value={stats.converted.toString()} icon={<CheckCircle size={16} />} highlight={true} />
                      </div>
                    </div>

                    {/* Interaction Stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h4 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conversation Details</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '1rem' }}>
                        <StatCard title="Total Calls" value={stats.callCount.toString()} icon={<PhoneCall size={16} />} />
                        <StatCard title="WhatsApp" value={stats.whatsappCount.toString()} icon={<MessageCircle size={16} />} />
                        <StatCard title="Notes Added" value={stats.noteCount.toString()} icon={<FileText size={16} />} />
                        <StatCard title="Attachments" value={stats.attachmentCount.toString()} icon={<Paperclip size={16} />} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clients Table */}
                <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))', borderRadius: 24, border: '1px solid var(--border)', padding: '2rem', boxShadow: '0 8px 30px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)', fontWeight: 700 }}>Client Portfolio</h3>
                    </div>
                  </div>
                  <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                      <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        <tr>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Client Name</th>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Calls</th>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>WhatsApp</th>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Notes</th>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Attachments</th>
                          <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClients.length === 0 ? (
                          <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No clients found.</td></tr>
                        ) : selectedClients.map((client: any, i: number) => (
                          <tr key={client.id} style={{ borderBottom: i === selectedClients.length - 1 ? 'none' : '1px solid var(--border)', background: 'var(--surface)' }}>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span 
                                  onClick={() => {
                                    if (scrollRef.current) dashboardScrollPos.current = scrollRef.current.scrollTop;
                                    setSelectedClientId(client.id);
                                  }}
                                  style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'none' }}
                                  onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {client.name || 'Unnamed Client'}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                              <span style={{ 
                                padding: '4px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                                background: 'rgba(16,185,129,0.1)', color: '#10b981'
                              }}>
                                Converted
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.callCount}</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.whatsappCount}</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.noteCount}</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.attachmentCount}</td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                              <button 
                                onClick={() => {
                                  if (scrollRef.current) dashboardScrollPos.current = scrollRef.current.scrollTop;
                                  setSelectedClientId(client.id);
                                }}
                                style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                View Report
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
