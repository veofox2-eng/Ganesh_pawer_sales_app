import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { TrendingUp, Users, UserCog, ArrowUpRight, Mic, MapPin, User, Calendar, Search, ChevronDown, Paperclip } from 'lucide-react';
import { useRef, useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import SalesEmployeesDashboard from './SalesEmployeesDashboard';
import FieldEmployeesDashboard from './FieldEmployeesDashboard';

const pageV = {
  initial: { opacity: 0, y: 18, scale: 0.99 },
  animate: { opacity: 1, y: 0,  scale: 1,  transition: { duration: 0.4, ease: 'easeOut' as const } },
  exit:    { opacity: 0, y: -10, scale: 0.99, transition: { duration: 0.22, ease: 'easeIn' as const } },
};

/* ── Role Badge ─────────────────────────────────────────── */
function RoleBadge({ role }: { role?: string }) {
  const r = role?.toLowerCase() || '';
  const isSales = r === 'sales' || r === 'user';
  const isField = r === 'field';
  
  if (!isSales && !isField) return null;

  const color = isSales ? '#10b981' : '#eab308';
  const label = isSales ? 'Sales' : 'Field';

  return (
    <span style={{
      border: `1px solid ${color}`,
      color: color,
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '0.65rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      boxShadow: `0 0 8px ${color}40`,
      background: 'transparent'
    }}>
      {label}
    </span>
  );
}

/* ── Custom Audio Player (Bypasses IDM) ─────────────────── */
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
      width: '100%', maxWidth: 350, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
    }}>
      {/* Hidden native audio element so IDM cannot find dimensions to attach its popup */}
      <audio ref={audioRef} src={src} style={{ display: 'none', width: 0, height: 0 }} />
      
      <button 
        onClick={togglePlay}
        style={{ 
          width: 28, height: 28, borderRadius: '50%', 
          background: 'var(--accent)', border: 'none', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          cursor: 'pointer', flexShrink: 0,
          boxShadow: '0 2px 8px rgba(170, 59, 255, 0.4)'
        }}
      >
        {isPlaying ? (
          <div style={{ width: 10, height: 10, background: '#fff', borderRadius: 2 }} />
        ) : (
          <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid #fff', marginLeft: 2 }} />
        )}
      </button>
      
      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', minWidth: 65, fontWeight: 500, fontFamily: 'monospace' }}>
        {formatTime(progress)} / {formatTime(duration)}
      </span>
      
      <input 
        type="range" min={0} max={duration || 100} value={progress} onChange={handleSeek}
        style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: 4, borderRadius: 2 }}
      />
    </div>
  );
}

/* ── Detailed Interaction Viewer ────────────────────────── */
function DetailedInteractionViewer({ type }: { type: 'recordings' | 'locations' | 'attachments' }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allEmployees, setAllEmployees] = useState<{ username: string, role: string }[]>([]);
  
  // Combobox state
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      const queryType = type === 'recordings' ? 'CALL_RECORDING' : type === 'locations' ? 'PINNED_LOCATION' : 'ATTACHMENT_ADDED';
      
      // Fetch interactions (limit to 100 to prevent browser hanging)
      let q = supabase
        .from('interactions')
        .select(`
          id, content, author, created_at, media_url,
          profiles:user_id(username, role)
        `)
        .eq('type', queryType)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (type === 'recordings' || type === 'attachments') q = q.not('media_url', 'is', null);
      
      const [{ data: interactionsData }, { data: profilesData }] = await Promise.all([
        q,
        supabase.from('profiles').select('id, username, role')
      ]);

      if (interactionsData) {
        const mapped = interactionsData.map((d: any) => ({
          ...d,
          resolvedName: d.profiles?.username || (d.author === 'System' ? 'Employee' : d.author) || 'Unknown',
          role: d.profiles?.role
        }));
        setItems(mapped.filter((d: any) => type !== 'recordings' || d.media_url !== 'DELETED'));
      }

      if (profilesData) {
        // Filter out admins and format employee list
        const filteredProfiles = profilesData.filter((p: any) => p.role?.toLowerCase() !== 'admin');
        const uniqueProfilesMap = new Map();
        filteredProfiles.forEach((p: any) => {
          const name = p.username || `Unknown User (${p.id.slice(0, 4)})`;
          uniqueProfilesMap.set(name, { username: name, role: p.role });
        });
        setAllEmployees(Array.from(uniqueProfilesMap.values()).sort((a, b) => a.username.localeCompare(b.username)));
      }
      
      setLoading(false);
    }
    fetchDetails();
  }, [type]);

  const filteredItems = useMemo(() => {
    if (!selectedEmp) return items;
    return items.filter(i => i.resolvedName === selectedEmp);
  }, [items, selectedEmp]);

  const searchedEmployees = useMemo(() => {
    if (!searchQuery || searchQuery === selectedEmp) return allEmployees.slice(0, 50);
    return allEmployees.filter(emp => emp.username.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 50);
  }, [allEmployees, searchQuery, selectedEmp]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{ overflow: 'visible', marginBottom: '1.5rem' }}
    >
      <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid var(--border)', boxShadow: '0 10px 40px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)', borderRadius: 20, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            {type === 'recordings' ? 'Call Recordings' : type === 'locations' ? 'Location Pins' : 'Attachments'} 
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem', marginLeft: 8 }}>({items.length} Total)</span>
          </h3>
          
          {/* Searchable Combobox */}
          <div style={{ position: 'relative', width: 260, zIndex: 10 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: 12 }} />
              <input 
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  if (e.target.value === '') setSelectedEmp(null);
                }}
                style={{
                  width: '100%', padding: '0.6rem 2.2rem 0.6rem 2.2rem',
                  borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)',
                  fontSize: '0.875rem', outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              />
              <ChevronDown size={16} color="var(--muted)" style={{ position: 'absolute', right: 12, pointerEvents: 'none' }} />
              
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedEmp(null); setIsDropdownOpen(false); }}
                  style={{ position: 'absolute', right: 36, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem', padding: 0 }}
                >
                  &times;
                </button>
              )}
            </div>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '0.5rem', maxHeight: 200, overflowY: 'auto',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
                    zIndex: 50
                  }}
                  className="custom-scrollbar"
                >
                  <div 
                    onClick={() => { setSelectedEmp(null); setSearchQuery(''); setIsDropdownOpen(false); }}
                    style={{
                      padding: '0.6rem 0.75rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text)',
                      background: !selectedEmp ? 'var(--bg)' : 'transparent', fontWeight: !selectedEmp ? 600 : 400
                    }}
                  >
                    All Employees
                  </div>
                  {searchedEmployees.length === 0 ? (
                    <div style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem', color: 'var(--muted)' }}>No employees found.</div>
                  ) : (
                    searchedEmployees.map(emp => (
                      <div 
                        key={emp.username}
                        onClick={() => { setSelectedEmp(emp.username); setSearchQuery(emp.username); setIsDropdownOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.6rem 0.75rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text)',
                          background: selectedEmp === emp.username ? 'var(--bg)' : 'transparent', fontWeight: selectedEmp === emp.username ? 600 : 400,
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = selectedEmp === emp.username ? 'var(--bg)' : 'transparent')}
                      >
                        <span>{emp.username}</span>
                        <RoleBadge role={emp.role} />
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '1rem 0' }}>Loading details...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '1rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <User size={32} color="var(--border)" />
            <span>{selectedEmp ? `${selectedEmp} has no data` : `No ${type} found.`}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 400, overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
            {filteredItems.map(item => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg2)', padding: '1.25rem', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                    <div style={{ background: 'rgba(99,102,241,0.1)', padding: 6, borderRadius: '50%' }}>
                      <User size={14} color="var(--accent)" />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.resolvedName}</span>
                    <RoleBadge role={item.role} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: '0.75rem' }}>
                    <Calendar size={12} />
                    {(() => {
                      const d = new Date(item.created_at);
                      const datePart = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                      const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return `${datePart}, ${timePart}`;
                    })()}
                  </div>
                </div>
                
                {item.content && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--text)', opacity: 0.9, lineHeight: 1.5, marginTop: '0.25rem', paddingLeft: 36, display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span>{item.content}</span>
                    {type === 'locations' && (() => {
                      const coords = item.content.match(/\(([\d.-]+),\s*([\d.-]+)\)/);
                      const mapUrl = coords 
                        ? `https://www.google.com/maps?q=${coords[1]},${coords[2]}` 
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.content)}`;
                      
                      return (
                        <a 
                          href={mapUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                            padding: '6px 14px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 600,
                            textDecoration: 'none', border: '1px solid rgba(59, 130, 246, 0.2)',
                            transition: 'all 0.2s ease', marginTop: 4
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)'; }}
                        >
                          <MapPin size={12} />
                          Show in Google Maps
                        </a>
                      );
                    })()}
                  </div>
                )}

                {type === 'recordings' && item.media_url && (
                  <div style={{ marginTop: '0.75rem', paddingLeft: 36 }}>
                    <CustomAudioPlayer src={item.media_url} />
                  </div>
                )}
                
                {type === 'attachments' && item.media_url && (
                  <div style={{ marginTop: '0.75rem', paddingLeft: 36, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500, wordBreak: 'break-all', flex: 1 }}>
                      {item.content || item.media_url.split('/').pop()}
                    </span>
                    <a 
                      href={item.media_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--accent)', color: '#fff',
                        padding: '6px 14px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 600,
                        textDecoration: 'none', border: 'none',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                        transition: 'all 0.2s ease', cursor: 'pointer', whiteSpace: 'nowrap'
                      }}
                    >
                      <Paperclip size={12} />
                      View
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Compact Glass Progress Card ─────────────────────────────── */
function MiniProgressStat({
  label, value, total, percentage, icon: Icon, color, delay = 0, onClick, isActive
}: {
  label: string; value: string; total?: string; percentage: number;
  icon: React.ElementType; color: string; delay?: number;
  onClick?: () => void; isActive?: boolean;
}) {
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={{ y: -2, boxShadow: `0 10px 25px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px ${color}55` }}
      style={{
        background: isActive ? `linear-gradient(145deg, var(--bg2), ${color}15)` : 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        border: `1px solid ${isActive ? color : 'var(--border)'}`,
        borderRadius: 18, padding: '1rem 1.25rem',
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        boxShadow: isActive ? `0 8px 32px ${color}33, inset 0 1px 0 rgba(255,255,255,0.1)` : '0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `${color}15`, border: `1px solid ${color}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={16} color={color} />
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
          {isActive && (
            <span style={{ marginLeft: 6, fontSize: '0.6rem', color: color, fontWeight: 800, padding: '2px 8px', background: `${color}15`, borderRadius: 10, letterSpacing: '0.05em' }}>
              ACTIVE
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
          {total && <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>Total</span>}
        </div>
      </div>
      
      <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay: delay + 0.2, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: 4, boxShadow: `0 0 10px ${color}99` }}
        />
      </div>
    </motion.div>
  );
}

/* ── 3-D Mouse-Tilt Card ──────────────────────────────── */
function TiltCard({
  label, value, sub, icon: Icon, color, delay = 0, onClick
}: {
  label: string; value: string; sub: string;
  icon: React.ElementType; color: string; delay?: number;
  onClick?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-8, 8]);
  const glowX   = useTransform(x, [-0.5, 0.5], [0, 100]);
  const glowY   = useTransform(y, [-0.5, 0.5], [0, 100]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current!.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width  - 0.5);
    y.set((e.clientY - rect.top)  / rect.height - 0.5);
  };
  const onLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      style={{
        rotateX, rotateY,
        transformStyle: 'preserve-3d',
        transformPerspective: 1000,
        position: 'relative', overflow: 'hidden', borderRadius: 20,
        background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: '1px solid var(--border)',
        padding: '1.75rem',
        cursor: 'none',
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
      whileHover={{ boxShadow: `0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2), 0 0 0 1px ${color}55` }}
    >
      {/* Mouse-spotlight */}
      <motion.div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 18,
          background: useTransform(
            [glowX, glowY],
            ([gx, gy]) => `radial-gradient(circle at ${gx}% ${gy}%, ${color}22 0%, transparent 60%)`
          ),
        }}
      />

      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: -50, right: -50,
        width: 140, height: 140, borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${color}28, transparent 70%)`,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `${color}16`, border: `1px solid ${color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={color} />
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#34d399', fontWeight: 600, letterSpacing: '0.03em' }}>
            <ArrowUpRight size={12} /> LIVE
          </span>
        </div>
        <p style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6, transition: 'color 0.4s ease' }}>
          {value}
        </p>
        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', marginBottom: 3, opacity: 0.8, transition: 'color 0.4s ease' }}>{label}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', transition: 'color 0.4s ease' }}>{sub}</p>
      </div>
    </motion.div>
  );
}

function Overview() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ sales: 0, field: 0, admin: 0 });
  const [extraStats, setExtraStats] = useState({ recordings: 0, locations: 0, attachments: 0 });
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'recordings' | 'locations' | 'attachments' | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Run all initial queries concurrently
      const [profilesRes, recRes, locRes, attRes] = await Promise.all([
        supabase.from('profiles').select('id, role'),
        supabase.from('interactions')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'CALL_RECORDING')
          .not('media_url', 'is', null)
          .neq('media_url', 'DELETED'),
        supabase.from('interactions')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'PINNED_LOCATION'),
        supabase.from('interactions')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'ATTACHMENT_ADDED')
      ]);

      // Handle Profiles
      if (profilesRes.error) {
        setDbError(profilesRes.error.message);
      } else if (profilesRes.data) {
        if (profilesRes.data.length === 0) {
          setDbError("Table is empty or RLS is blocking read access.");
        } else {
          setDbError(null);
        }

        const salesCount = profilesRes.data.filter((p: any) => p.role === 'User' || p.role === 'sales' || p.role === 'Sales').length;
        const fieldCount = profilesRes.data.filter((p: any) => p.role === 'Field' || p.role === 'field').length;
        const adminCount = profilesRes.data.filter((p: any) => p.role === 'Admin' || p.role === 'admin').length;

        setCounts({ sales: salesCount, field: fieldCount, admin: adminCount });
      }

      // Handle Interactions
      setExtraStats({
        recordings: recRes.count || 0,
        locations: locRes.count || 0,
        attachments: attRes.count || 0,
      });

      setLoading(false);
    }
    fetchData();

    // Subscribe to real-time inserts to update counts lively
    const interactionsSub = supabase.channel('interactions_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'interactions' }, payload => {
        if (payload.new.type === 'CALL_RECORDING' && payload.new.media_url && payload.new.media_url !== 'DELETED') {
          setExtraStats(prev => ({ ...prev, recordings: prev.recordings + 1 }));
        }
        if (payload.new.type === 'PINNED_LOCATION') {
          setExtraStats(prev => ({ ...prev, locations: prev.locations + 1 }));
        }
        if (payload.new.type === 'ATTACHMENT_ADDED') {
          setExtraStats(prev => ({ ...prev, attachments: prev.attachments + 1 }));
        }
      }).subscribe();

    return () => {
      supabase.removeChannel(interactionsSub);
    };
  }, []);

  return (
    <motion.div {...pageV}>
      {dbError && (
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#fca5a5', marginBottom: '1rem' }}>
          Database Error: {dbError}
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ marginBottom: '1.75rem' }}
      >
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'transparent', backgroundImage: 'linear-gradient(to right, var(--text), var(--accent))', WebkitBackgroundClip: 'text', letterSpacing: '-0.04em', marginBottom: 6 }}>
          Overview
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.01em' }}>
          Fox Sales App — Backend Operations Dashboard
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <TiltCard label="Sales Employees" value={loading ? "—" : counts.sales.toString()} sub="Total Active" icon={Users} color="#6366f1" delay={0.1} onClick={() => navigate('/dashboard/sales-employees')} />
        <TiltCard label="Field Employees" value={loading ? "—" : counts.field.toString()} sub="Total Active" icon={UserCog} color="#10b981" delay={0.2} onClick={() => navigate('/dashboard/field-employees')} />
        <TiltCard label="Admin Employees" value={loading ? "—" : counts.admin.toString()} sub="Total Active" icon={TrendingUp} color="#f59e0b" delay={0.3} />
      </div>

      {/* Mini Progress Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <MiniProgressStat 
          label="Call Recordings" value={loading ? "—" : `${extraStats.recordings} Total`} percentage={100} 
          icon={Mic} color="#a855f7" delay={0.4} 
          onClick={() => setExpandedSection(prev => prev === 'recordings' ? null : 'recordings')}
          isActive={expandedSection === 'recordings'}
        />
        <MiniProgressStat 
          label="Location Pins" value={loading ? "—" : `${extraStats.locations} Total`} percentage={100} 
          icon={MapPin} color="#ef4444" delay={0.45} 
          onClick={() => setExpandedSection(prev => prev === 'locations' ? null : 'locations')}
          isActive={expandedSection === 'locations'}
        />
        <MiniProgressStat 
          label="Attachments" value={loading ? "—" : `${extraStats.attachments} Total`} percentage={100} 
          icon={Paperclip} color="#3b82f6" delay={0.5} 
          onClick={() => setExpandedSection(prev => prev === 'attachments' ? null : 'attachments')}
          isActive={expandedSection === 'attachments'}
        />
      </div>

      <AnimatePresence mode="wait">
        {expandedSection && <DetailedInteractionViewer key={expandedSection} type={expandedSection} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '1.5rem',
          transition: 'background 0.4s ease, border-color 0.4s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={20} color="var(--accent)" />
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', transition: 'color 0.4s ease' }}>
            Getting Started
          </h3>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6, transition: 'color 0.4s ease' }}>
          Navigate to <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sales Employees</span> or <span style={{ color: '#10b981', fontWeight: 600 }}>Field Employees</span> from the sidebar to view call logs, conversions, pie charts, timelines, and recordings.
        </p>
      </motion.div>
    </motion.div>
  );
}


export default function Dashboard() {
  const location = useLocation();
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/"                  element={<Overview />} />
          <Route path="/sales-employees"   element={<SalesEmployeesDashboard />} />
          <Route path="/field-employees"   element={<FieldEmployeesDashboard />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}
