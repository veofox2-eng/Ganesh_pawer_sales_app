import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Shield, UserCog, CheckCircle, Trash2, Calendar, Play, Pause } from 'lucide-react';

/* ── Custom Audio Player ───────────────────────────────── */
function CustomAudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onEnded = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, []);

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      audioRef.current?.play();
      setPlaying(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // If the audio URL is literally 'DELETED', it's unplayable from this source
  const isDeletedStr = src === 'DELETED';

  return (
    <div style={{ 
      display: 'inline-flex', alignItems: 'center', gap: '1rem', 
      background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.02))', 
      border: '1px solid var(--border)', borderRadius: 100, padding: '6px 16px 6px 6px',
      minWidth: 260, maxWidth: 320, boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
    }}>
      {!isDeletedStr && <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />}
      
      <button 
        onClick={isDeletedStr ? undefined : toggle} 
        disabled={isDeletedStr}
        style={{ 
          background: isDeletedStr ? 'var(--muted)' : playing ? 'var(--text)' : 'var(--accent)', 
          color: playing ? 'var(--bg)' : '#fff', border: 'none', width: 32, height: 32, 
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          cursor: isDeletedStr ? 'not-allowed' : 'pointer', flexShrink: 0, padding: 0,
          transition: 'all 0.2s ease', boxShadow: playing || isDeletedStr ? 'none' : '0 4px 10px rgba(99,102,241,0.3)'
        }}
      >
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: isDeletedStr ? 0.5 : 1 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {isDeletedStr ? '0:00' : formatTime(progress)}
        </span>
        
        <div 
          style={{ flex: 1, height: 24, display: 'flex', alignItems: 'center', cursor: isDeletedStr ? 'not-allowed' : 'pointer', position: 'relative', touchAction: 'none' }}
          onPointerDown={isDeletedStr ? undefined : (e) => {
            if (!audioRef.current || duration === 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            const updateProgress = (clientX: number) => {
              const val = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
              if (audioRef.current) {
                audioRef.current.currentTime = val * duration;
                setProgress(val * duration);
              }
            };
            updateProgress(e.clientX);
            const handlePointerMove = (moveEvent: React.PointerEvent) => updateProgress(moveEvent.clientX);
            const handlePointerUp = (upEvent: React.PointerEvent) => {
              upEvent.currentTarget.releasePointerCapture(upEvent.pointerId);
              e.currentTarget.removeEventListener('pointermove', handlePointerMove as any);
              e.currentTarget.removeEventListener('pointerup', handlePointerUp as any);
            };
            e.currentTarget.addEventListener('pointermove', handlePointerMove as any);
            e.currentTarget.addEventListener('pointerup', handlePointerUp as any);
          }}
        >
          <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
             <div style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%`, height: '100%', background: 'var(--accent)', position: 'absolute', left: 0, top: 0, transition: 'width 0.1s linear' }} />
          </div>
          <div style={{
             position: 'absolute', left: `${duration > 0 ? (progress / duration) * 100 : 0}%`, top: '50%', transform: 'translate(-50%, -50%)',
             width: 10, height: 10, borderRadius: '50%', background: 'var(--text)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', pointerEvents: 'none'
          }} />
        </div>

        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {isDeletedStr ? '--:--' : formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

export default function AdminEmployeesDashboard() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Data for the selected admin
  const [adminApprovals, setAdminApprovals] = useState<any[]>([]);
  const [deletedAudios, setDeletedAudios] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'approvals' | 'deleted'>('approvals');

  useEffect(() => {
    async function fetchAdmins() {
      const { data } = await supabase.from('profiles').select('*');
      if (data) {
        const appAdmins = data.filter((p: any) => {
          const r = p.role?.toLowerCase() || '';
          const n = (p.username || '').toLowerCase();
          return (r === 'admin') && !n.includes('super') && !n.includes('backend') && !n.includes('access');
        });
        setAdmins(appAdmins);
      }
      setLoading(false);
    }
    fetchAdmins();
  }, []);

  useEffect(() => {
    if (!selectedAdminId) return;
    
    async function fetchDetails() {
      setDetailsLoading(true);
      const selectedAdmin = admins.find(a => a.id === selectedAdminId);
      if (!selectedAdmin) return;

      // Fetch approvals given by this admin
      const { data: approvalsData } = await supabase
        .from('interactions')
        .select('*')
        .eq('author', selectedAdmin.username)
        .ilike('type', '%APPROVAL%')
        .order('created_at', { ascending: false });
        
      // Fetch deleted call records (system wide or related to this admin)
      // The user wants to see "deleted audio" here. If media_url is DELETED or is_deleted is true.
      // We will fetch interactions where media_url === 'DELETED' or type includes DELETED.
      // And we will also fetch interactions where is_deleted might be true.
      // For now, we fetch CALL_RECORDINGs that are deleted.
      const { data: deletedData } = await supabase
        .from('interactions')
        .select('*, profiles:user_id(username)')
        .eq('type', 'CALL_RECORDING')
        .order('created_at', { ascending: false });

      // We filter out deleted records: either media_url is 'DELETED' or an 'is_deleted' flag if it exists.
      const actualDeletedAudios = (deletedData || []).filter((d: any) => d.media_url === 'DELETED' || d.is_deleted === true || d.content?.toLowerCase().includes('deleted'));

      setAdminApprovals(approvalsData || []);
      setDeletedAudios(actualDeletedAudios);
      setDetailsLoading(false);
    }
    fetchDetails();
  }, [selectedAdminId, admins]);

  const filteredAdmins = admins.filter(a => (a.username || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedAdmin = admins.find(a => a.id === selectedAdminId);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', overflow: 'hidden' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>App Administrators</h2>
          <p style={{ color: 'var(--muted)', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>Manage app admins, view approvals, and access deleted records.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Panel: Admins List */}
        <div className="glass-card" style={{ width: 320, display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Search admins..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none'
                }}
              />
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="custom-scrollbar">
            {loading ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '2rem 0' }}
              >
                <div style={{ position: 'relative', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: 'var(--accent)', filter: 'blur(15px)' }}
                  />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    style={{ position: 'absolute', width: 44, height: 44, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--accent)', borderRightColor: 'var(--accent)' }}
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    style={{ position: 'absolute', width: 28, height: 28, borderRadius: '50%', border: '2px solid transparent', borderBottomColor: 'var(--text)', borderLeftColor: 'var(--text)' }}
                  />
                </div>
                <motion.div 
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  Loading...
                </motion.div>
              </motion.div>
            ) : filteredAdmins.map(emp => (
              <motion.div 
                key={emp.id}
                onClick={() => setSelectedAdminId(emp.id)}
                whileHover={{ boxShadow: '0 0 15px rgba(99,102,241,0.4)', borderColor: 'var(--accent)', scale: 1.02 }}
                style={{
                  padding: '1rem', borderRadius: 12, marginBottom: '0.5rem', cursor: 'pointer',
                  background: selectedAdminId === emp.id ? 'var(--accent)' : 'var(--bg)',
                  color: selectedAdminId === emp.id ? '#fff' : 'var(--text)',
                  border: selectedAdminId === emp.id ? '1px solid var(--accent)' : '1px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: selectedAdminId === emp.id ? 'rgba(255,255,255,0.2)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={18} color={selectedAdminId === emp.id ? '#fff' : 'var(--accent)'} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{emp.username || 'Unknown Admin'}</div>
                    <div style={{ fontSize: '0.75rem', opacity: selectedAdminId === emp.id ? 0.9 : 0.6 }}>{emp.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Panel: Details */}
        <div className="glass-card" style={{ flex: 1, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selectedAdmin ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
              <UserCog size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>Select an App Admin to view their activity.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                  <Shield size={24} color="var(--accent)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>{selectedAdmin.username}</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted)' }}>App Administrator</p>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem 1.5rem 0 1.5rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ 
                    display: 'inline-flex', 
                    background: 'rgba(15, 23, 42, 0.04)', 
                    padding: '6px', 
                    borderRadius: '16px', 
                    gap: '4px',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                    marginBottom: '1rem' 
                  }}>
                    {[{ id: 'approvals', label: 'Approvals Given', Icon: CheckCircle }, { id: 'deleted', label: 'Deleted Call Records', Icon: Trash2 }].map(tab => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'approvals' | 'deleted')}
                        style={{ 
                          position: 'relative',
                          background: 'transparent', 
                          border: 'none', 
                          padding: '0.6rem 1.5rem', 
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontSize: '0.85rem', 
                          fontWeight: 600,
                          color: activeTab === tab.id ? 'var(--accent)' : 'var(--muted)',
                          display: 'flex', alignItems: 'center', gap: 8,
                          outline: 'none',
                          zIndex: 1
                        }}
                      >
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="activeAdminTab"
                            style={{ 
                              position: 'absolute', inset: 0, background: '#fff', borderRadius: '12px', 
                              boxShadow: '0 4px 15px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.02)', 
                              zIndex: -1 
                            }}
                            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                          />
                        )}
                        <tab.Icon size={16} /> 
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }} className="custom-scrollbar">
                  {detailsLoading ? (
                    <p style={{ color: 'var(--muted)' }}>Loading activity...</p>
                  ) : (
                    <AnimatePresence mode="wait">
                      {activeTab === 'approvals' && (
                        <motion.div key="approvals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                          {adminApprovals.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--muted)' }}>
                              <CheckCircle size={32} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                              <p style={{ margin: 0, fontSize: '0.875rem' }}>No approvals recorded yet.</p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {adminApprovals.map(app => (
                                <div key={app.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                                  <div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 }}>{app.content || 'Approval Action'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Calendar size={12} /> {new Date(app.created_at).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}

                      {activeTab === 'deleted' && (
                        <motion.div key="deleted" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                          {deletedAudios.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--muted)' }}>
                              <Trash2 size={32} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                              <p style={{ margin: 0, fontSize: '0.875rem' }}>No deleted call records found.</p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {deletedAudios.map(audio => (
                                <div key={audio.id} style={{ background: 'var(--bg)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: '1rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <div>
                                      <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 600 }}>Call with Client (Deleted)</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>Rep: {audio.profiles?.username || 'Unknown'}</div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Calendar size={12} /> {new Date(audio.created_at).toLocaleString()}
                                    </div>
                                  </div>
                                  
                                  <CustomAudioPlayer src={audio.media_url !== 'DELETED' ? audio.media_url : 'DELETED'} />
                                  {audio.media_url === 'DELETED' && (
                                    <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem', marginBottom: 0 }}>
                                      * The physical audio file was completely removed from storage.
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
