import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Shield, Search, User, Trash2, CheckCircle, Eye, EyeOff, KeyRound, ChevronDown, UserPlus, LogOut } from 'lucide-react';

const DEFAULT_FEATURES = {
  dashboards: {
    client: true, task: true, leads: true, call_logs: true,
    other_records: true, my_status: true, admin_sales: true,
    admin_field: true, admin_approvals: true, map: true, settings: true
  },
  actions: {
    dialer: true, whatsapp: true, upload_files: true,
    voice_record: true, edit_profile: true
  },
  background: {
    auto_call_record: true, live_location: true
  }
};

const LIMITS = {
  Sales: 10,
  Field: 10,
  Admin: 5
};

export default function AccessDashboard() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Delete/Approve Modals
  const [actionData, setActionData] = useState<{ id: string, name: string, type: 'DELETE' | 'APPROVE' } | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Add User Modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddUserRoleOpen, setIsAddUserRoleOpen] = useState(false);
  const [addUserData, setAddUserData] = useState({ username: '', email: '', password: '', confirmPassword: '', role: 'Sales', industry_position: '' });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [limitErrorPopup, setLimitErrorPopup] = useState(false);

  const selectedProfile = useMemo(() => profiles.find(p => p.id === selectedProfileId), [profiles, selectedProfileId]);

  const counts = useMemo(() => {
    return {
      Sales: profiles.filter(p => p.role === 'Sales' || p.role === 'User').length,
      Field: profiles.filter(p => p.role === 'Field').length,
      Admin: profiles.filter(p => p.role === 'Admin').length,
    };
  }, [profiles]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) console.error("Error:", error);
    if (data) setProfiles(data);
    setLoading(false);
  }

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const name = p.username || p.full_name || p.feature_flags?.email || '';
      if (name === 'Super Administrator' || p.role === 'SuperAdmin' || name === 'Foxdigital Backend (DO NOT DELETE)') return false;
      
      const matchSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = filterRole === 'ALL' || 
                        (filterRole === 'PENDING' && p.approval_status === 'Pending') ||
                        (filterRole === 'APPROVED' && p.approval_status === 'Approved') ||
                        (p.role?.toLowerCase() === filterRole.toLowerCase());
      return matchSearch && matchRole;
    });
  }, [profiles, searchQuery, filterRole]);

  async function handleToggle(category: string, key: string, value: boolean) {
    if (!selectedProfile) return;
    
    const currentFeatures = selectedProfile.feature_flags || DEFAULT_FEATURES;
    const updated = {
      ...currentFeatures,
      [category]: {
        ...(currentFeatures[category] || {}),
        [key]: value
      }
    };

    if (!updated.dashboards) updated.dashboards = DEFAULT_FEATURES.dashboards;
    if (!updated.actions) updated.actions = DEFAULT_FEATURES.actions;
    if (!updated.background) updated.background = DEFAULT_FEATURES.background;

    setProfiles(prev => prev.map(p => p.id === selectedProfile.id ? { ...p, feature_flags: updated } : p));
    const { error } = await supabase.from('profiles').update({ feature_flags: updated }).eq('id', selectedProfile.id);
    if (error) {
      alert("Failed to save feature flag: " + error.message);
      fetchProfiles();
    }
  }

  const renderToggle = (category: string, key: string, label: string) => {
    if (!selectedProfile) return null;
    const features = selectedProfile.feature_flags || DEFAULT_FEATURES;
    const catObj = features[category] || (DEFAULT_FEATURES as any)[category];
    const isEnabled = catObj[key] !== false;

    return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 500 }}>{label}</span>
        <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 24 }}>
          <input 
            type="checkbox" 
            checked={isEnabled} 
            onChange={(e) => handleToggle(category, key, e.target.checked)}
            style={{ opacity: 0, width: 0, height: 0 }} 
          />
          <span style={{
            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: isEnabled ? 'var(--accent)' : 'var(--border)',
            transition: '.4s', borderRadius: 24
          }}>
            <span style={{
              position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3,
              backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
              transform: isEnabled ? 'translateX(16px)' : 'translateX(0)'
            }} />
          </span>
        </label>
      </div>
    );
  };

  async function handleActionConfirm() {
    if (!actionData) return;
    setActionError('');
    setActionLoading(true);

    if (actionData.type === 'APPROVE') {
      const { error } = await supabase.from('profiles').update({ approval_status: 'Approved', role: 'User' }).eq('id', actionData.id);
      if (error) {
        setActionError(error.message);
      } else {
        await fetchProfiles();
        setActionData(null);
        setAdminPassword('');
      }
      setActionLoading(false);
      return;
    }

    if (actionData.type === 'DELETE') {
      if (!adminPassword.trim()) {
        setActionError('Admin password is required to delete a user.');
        setActionLoading(false);
        return;
      }
      
      try {
        const response = await fetch('https://ganesh-backend-3j1t.onrender.com/api/delete-employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: actionData.id,
            admin_password: adminPassword
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete employee');
        
        await fetchProfiles();
        setActionData(null);
        setAdminPassword('');
        if (selectedProfileId === actionData.id) setSelectedProfileId(null);
      } catch (err: any) {
        setActionError(err.message || 'Error deleting user.');
      } finally {
        setActionLoading(false);
      }
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddUserError('');
    if (!addUserData.email || !addUserData.password || !addUserData.role) {
      setAddUserError('Please fill all fields');
      return;
    }
    if (addUserData.password !== addUserData.confirmPassword) {
      setAddUserError('Passwords do not match');
      return;
    }

    if (
      (addUserData.role === 'Sales' && counts.Sales >= LIMITS.Sales) ||
      (addUserData.role === 'Field' && counts.Field >= LIMITS.Field) ||
      (addUserData.role === 'Admin' && counts.Admin >= LIMITS.Admin)
    ) {
      setLimitErrorPopup(true);
      return;
    }
    
    setAddUserLoading(true);
    try {
      const dbRole = addUserData.role === 'Sales' ? 'User' : addUserData.role;
      const response = await fetch('https://ganesh-backend-3j1t.onrender.com/api/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addUserData.email,
          password: addUserData.password,
          role: dbRole,
          industry_position: addUserData.industry_position || undefined
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create employee');
      
      if (data.user?.id) {
        let existing = null;
        for (let i = 0; i < 5; i++) {
          const res = await supabase.from('profiles').select('feature_flags').eq('id', data.user.id).single();
          if (res.data) {
            existing = res.data;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const newFlags = {
          ...(existing?.feature_flags || DEFAULT_FEATURES),
          email: addUserData.email,
          initial_password: addUserData.password
        };
        await supabase.from('profiles').update({ feature_flags: newFlags, username: addUserData.username }).eq('id', data.user.id);
      }

      setIsAddUserOpen(false);
      setAddUserData({ username: '', email: '', password: '', confirmPassword: '', role: 'Sales', industry_position: '' });
      await fetchProfiles();
    } catch (err: any) {
      setAddUserError(err.message || 'Something went wrong');
    } finally {
      setAddUserLoading(false);
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Background Orbs & Grid */}
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '-10%', left: '-5%', width: '800px', height: '800px', borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, var(--orb1) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '700px', height: '700px', borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, var(--orb2) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.1, 0.15, 0.1] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        style={{ position: 'absolute', top: '30%', left: '40%', width: '600px', height: '600px', borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, var(--orb3) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--border-dark) 1px, transparent 1px), linear-gradient(90deg, var(--border-dark) 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.4 }} />

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '2rem', position: 'relative', zIndex: 10 }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'transparent', backgroundImage: 'linear-gradient(to right, #0f172a, var(--accent))', WebkitBackgroundClip: 'text', letterSpacing: '-0.04em', marginBottom: 6, marginTop: 0 }}>
            Access Control Portal
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 500, margin: 0 }}>
            Manage user roles, create employee accounts, and configure feature visibility.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {['Sales', 'Field', 'Admin'].map(role => {
              const current = counts[role as keyof typeof counts];
              const limit = LIMITS[role as keyof typeof LIMITS];
              const isFull = current >= limit;
              const roleColor = role === 'Admin' ? '#a855f7' : role === 'Field' ? '#10b981' : '#0ea5e9';
              return (
                <div key={role} style={{ background: 'var(--surface)', border: `1px solid ${isFull ? '#ef4444' : 'var(--border)'}`, borderBottomColor: 'var(--border-dark)', borderRightColor: 'var(--border-dark)', borderTop: `3px solid ${roleColor}`, borderRadius: 12, padding: '8px 16px', display: 'flex', flexDirection: 'column', minWidth: 100, backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>{role} LIMIT</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isFull ? '#ef4444' : 'var(--text)' }}>{current}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>/ {limit}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.removeItem('fox_access_auth');
              window.location.href = '/login';
            }}
            className="btn-hover"
            style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.05)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', color: '#e11d48', outline: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', height: 'fit-content' }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
        {/* LEFT PANE: Users List */}
        <div style={{
          width: '480px', flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid var(--border)', borderBottomColor: 'var(--border-dark)', borderRightColor: 'var(--border-dark)', borderRadius: 20, padding: '1.25rem', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)'
        }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
              <input 
                type="text" placeholder="Search user..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 12, border: '1px solid var(--border-dark)', background: 'var(--bg2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                style={{ padding: '8px 16px', borderRadius: 12, border: '1px solid var(--border-dark)', background: 'var(--bg2)', backdropFilter: 'blur(20px)', color: 'var(--text)', outline: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: '100%', minWidth: 120, justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                  {filterRole === 'ALL' ? 'All Users' : filterRole.charAt(0).toUpperCase() + filterRole.slice(1).toLowerCase()}
                </span>
                <ChevronDown size={16} color="var(--muted)" style={{ transform: isFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
              </button>
              
              <AnimatePresence>
                {isFilterOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsFilterOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }} transition={{ duration: 0.15 }}
                      style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 150, background: 'var(--bg2)', border: '1px solid var(--border-dark)', borderRadius: 12, padding: 6, boxShadow: '0 10px 40px rgba(0,0,0,0.1)', zIndex: 100 }}
                    >
                      {['ALL', 'ADMIN', 'SALES', 'FIELD'].map(role => (
                        <button
                          key={role}
                          onClick={() => { setFilterRole(role); setIsFilterOpen(false); }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: filterRole === role ? 'rgba(99,102,241,0.1)' : 'transparent',
                            color: filterRole === role ? 'var(--accent)' : 'var(--text)',
                            fontSize: '0.9rem', fontWeight: filterRole === role ? 600 : 500,
                            display: 'block', transition: 'background 0.1s'
                          }}
                        >
                          {role === 'ALL' ? 'All Users' : role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="btn-hover"
              style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', outline: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: '100%', fontWeight: 600, transition: '0.2s', boxShadow: '0 4px 14px var(--accent-glow)' }}
            >
              <UserPlus size={16} /> Add Employee
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
            {loading ? (
              <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 20 }}>Loading...</div>
            ) : filteredProfiles.length === 0 ? (
              <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 20 }}>No users found.</div>
            ) : (
              filteredProfiles.map(p => {
                const name = p.username || p.full_name || p.feature_flags?.email || 'Unknown User';
                const isSelected = selectedProfileId === p.id;
                const isPending = p.approval_status === 'Pending';
                const roleColor = p.role === 'Admin' ? '#a855f7' : p.role === 'Field' ? '#10b981' : '#0ea5e9';
                const roleBg = p.role === 'Admin' ? 'rgba(168,85,247,0.15)' : p.role === 'Field' ? 'rgba(16,185,129,0.15)' : 'rgba(14,165,233,0.15)';
                
                return (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    style={{
                      padding: '12px', borderRadius: 12, cursor: 'pointer',
                      background: isSelected ? 'rgba(99,102,241,0.05)' : 'var(--bg2)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-dark)'}`,
                      borderLeft: isSelected ? `4px solid ${roleColor}` : '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ background: roleBg, border: `1px solid ${roleColor}44`, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={16} color={roleColor} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{name}</div>
                        <div style={{ fontSize: '0.75rem', color: isPending ? '#f59e0b' : 'var(--muted)', fontWeight: isPending ? 700 : 500 }}>
                          {p.role} {isPending && ' • PENDING'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isPending && (
                        <button onClick={(e) => { e.stopPropagation(); setActionData({ id: p.id, name, type: 'APPROVE' }); }} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: 6, borderRadius: 8, cursor: 'pointer', color: '#10b981' }} title="Approve User">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setActionData({ id: p.id, name, type: 'DELETE' }); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: 6, borderRadius: 8, cursor: 'pointer', color: '#ef4444' }} title="Delete User">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Feature Toggles */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid var(--border)', borderBottomColor: 'var(--border-dark)', borderRightColor: 'var(--border-dark)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)'
        }}>
          {!selectedProfile ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', gap: 12 }}>
              <Shield size={48} opacity={0.2} />
              <p>Select a user to manage their access & features.</p>
            </div>
          ) : (
            <>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-dark)', background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)' }}>
                    {selectedProfile.username || selectedProfile.full_name || selectedProfile.feature_flags?.email || 'Unknown User'}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4 }}>
                    Manage user access and features
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{
                    background: selectedProfile.role === 'Admin' ? '#a855f7' : selectedProfile.role === 'Field' ? '#10b981' : '#0ea5e9',
                    color: '#fff',
                    padding: '6px 16px',
                    borderRadius: 12,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    boxShadow: `0 4px 12px ${selectedProfile.role === 'Admin' ? 'rgba(168,85,247,0.4)' : selectedProfile.role === 'Field' ? 'rgba(16,185,129,0.4)' : 'rgba(14,165,233,0.4)'}`
                  }}>
                    {selectedProfile.role === 'User' ? 'Sales' : selectedProfile.role}
                  </div>
                  {selectedProfile.approval_status === 'Pending' && (
                    <div style={{ padding: '6px 14px', fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
                      Pending
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
                {selectedProfile.feature_flags?.email && selectedProfile.feature_flags?.initial_password && (
                  <div style={{ marginBottom: '2rem', padding: '1.25rem', background: 'rgba(99,102,241,0.05)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)' }}>
                    <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Login Credentials</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Email ID</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 500, userSelect: 'all' }}>{selectedProfile.feature_flags.email}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Password</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 500, userSelect: 'all' }}>{selectedProfile.feature_flags.initial_password}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Dashboards & Main Screens</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                    {selectedProfile.role?.includes('Admin') ? (
                      <>
                        {renderToggle('dashboards', 'admin_sales', 'Sales Team Monitoring')}
                        {renderToggle('dashboards', 'admin_field', 'Field Team Monitoring')}
                      </>
                    ) : selectedProfile.role === 'Field' ? (
                      <>
                        {renderToggle('dashboards', 'map', 'Map')}
                        {renderToggle('dashboards', 'client', 'Clients')}
                        {renderToggle('dashboards', 'task', 'Timeline')}
                        {renderToggle('dashboards', 'call_logs', 'Call Log')}
                        {renderToggle('dashboards', 'other_records', 'Other Records')}
                        {renderToggle('dashboards', 'leads', 'Leads')}
                      </>
                    ) : (
                      <>
                        {renderToggle('dashboards', 'client', 'Clients')}
                        {renderToggle('dashboards', 'task', 'Timeline')}
                        {renderToggle('dashboards', 'call_logs', 'Call Log')}
                        {renderToggle('dashboards', 'other_records', 'Other Records')}
                        {renderToggle('dashboards', 'leads', 'Leads')}
                      </>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Client & Lead Actions</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                    {renderToggle('actions', 'dialer', 'Dialer & Calling')}
                    {renderToggle('actions', 'whatsapp', 'Send WhatsApp Messages')}
                    {renderToggle('actions', 'upload_files', 'Upload Files & Documents')}
                    {renderToggle('actions', 'voice_record', 'Voice Record in Notes')}
                    {renderToggle('actions', 'edit_profile', 'Edit Client Profile')}
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Background Services</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                    {renderToggle('background', 'auto_call_record', 'Automatic Call Recording')}
                    {renderToggle('background', 'live_location', 'Live Location Tracking')}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Global Features</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                    {renderToggle('dashboards', 'settings', 'Settings Menu Access')}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Modal (Approve / Delete) */}
      <AnimatePresence>
        {actionData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setActionData(null)}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--surface)', backdropFilter: 'blur(30px)', border: `1px solid ${actionData.type === 'DELETE' ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)'}`, borderRadius: 20, padding: '2rem', width: '90%', maxWidth: 400, boxShadow: `0 0 30px ${actionData.type === 'DELETE' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}, 0 24px 64px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,1)` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem', color: actionData.type === 'DELETE' ? '#ef4444' : '#10b981' }}>
                {actionData.type === 'DELETE' ? <Trash2 size={24} /> : <CheckCircle size={24} />}
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{actionData.type === 'DELETE' ? 'Delete' : 'Approve'} User</h3>
              </div>
              <p style={{ color: 'var(--text)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to {actionData.type.toLowerCase()} <strong>{actionData.name}</strong>?
                {actionData.type === 'DELETE' && " This action will permanently remove their account and erase their data."}
              </p>

              {actionData.type === 'DELETE' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <KeyRound size={14} /> Admin Verification
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Enter Admin Password"
                      style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: 12, border: '1px solid var(--border-dark)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none', transition: 'all 0.2s' }}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {actionError && (
                    <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: 8 }}>{actionError}</p>
                  )}
                </div>
              )}

              {actionData.type === 'APPROVE' && actionError && (
                <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: -8, marginBottom: 12 }}>{actionError}</p>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={() => setActionData(null)} disabled={actionLoading} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--border-dark)', color: 'var(--text)', fontSize: '0.95rem', fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleActionConfirm} disabled={actionLoading} style={{ flex: 1, padding: '12px', borderRadius: 12, background: actionData.type === 'DELETE' ? '#ef4444' : '#10b981', border: 'none', color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {actionLoading ? 'Processing...' : actionData.type === 'DELETE' ? 'Delete User' : 'Approve User'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddUserOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setIsAddUserOpen(false)}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--surface)', backdropFilter: 'blur(30px)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: 20, padding: '2rem', width: '90%', maxWidth: 460, boxShadow: '0 0 30px rgba(99,102,241,0.2), 0 24px 64px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,1)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem', color: 'var(--accent)' }}>
                <UserPlus size={24} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)' }}>Create Employee Account</h3>
              </div>
              
              <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                  <input required type="email" value={addUserData.email} onChange={e => setAddUserData({...addUserData, email: e.target.value})}
                    placeholder="user@example.com"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-dark)', background: 'var(--bg2)', color: 'var(--text)', outline: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    <input required type="password" value={addUserData.password} onChange={e => setAddUserData({...addUserData, password: e.target.value})}
                      placeholder="Min 6 characters"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-dark)', background: 'var(--bg2)', color: 'var(--text)', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm Password</label>
                    <input required type="password" value={addUserData.confirmPassword} onChange={e => setAddUserData({...addUserData, confirmPassword: e.target.value})}
                      placeholder="Retype password"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-dark)', background: 'var(--bg2)', color: 'var(--text)', outline: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Role</label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setIsAddUserRoleOpen(!isAddUserRoleOpen)}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-dark)', background: 'var(--bg2)', color: 'var(--text)', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      >
                        {addUserData.role === 'Sales' ? 'Sales Employee' : addUserData.role === 'Field' ? 'Field Employee' : 'Admin'}
                        <ChevronDown size={16} color="var(--muted)" style={{ transform: isAddUserRoleOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                      </button>
                      <AnimatePresence>
                        {isAddUserRoleOpen && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsAddUserRoleOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }} transition={{ duration: 0.15 }}
                              style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 150, background: 'var(--surface)', backdropFilter: 'blur(30px)', border: '1px solid var(--border-dark)', borderRadius: 12, padding: 6, boxShadow: '0 10px 40px rgba(0,0,0,0.1)', zIndex: 100 }}
                            >
                              {[
                                { value: 'Admin', label: 'Admin' },
                                { value: 'Sales', label: 'Sales Employee' },
                                { value: 'Field', label: 'Field Employee' }
                              ].map(role => (
                                <button
                                  type="button"
                                  key={role.value}
                                  onClick={() => { setAddUserData({...addUserData, role: role.value}); setIsAddUserRoleOpen(false); }}
                                  style={{
                                    width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    background: addUserData.role === role.value ? 'rgba(79,70,229,0.1)' : 'transparent',
                                    color: addUserData.role === role.value ? 'var(--accent)' : 'var(--text)',
                                    fontSize: '0.9rem', fontWeight: addUserData.role === role.value ? 600 : 500,
                                    display: 'block', transition: 'background 0.1s'
                                  }}
                                >
                                  {role.label}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Industry Position</label>
                    <input type="text" value={addUserData.industry_position} onChange={e => setAddUserData({...addUserData, industry_position: e.target.value})}
                      placeholder="(e.g., Manager)"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-dark)', background: 'var(--bg2)', color: 'var(--text)', outline: 'none' }} />
                  </div>
                </div>

                {addUserError && (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{addUserError}</p>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setIsAddUserOpen(false)} disabled={addUserLoading} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.95rem', fontWeight: 600, cursor: addUserLoading ? 'not-allowed' : 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={addUserLoading} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: addUserLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {addUserLoading ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Limit Exceeded Popup */}
      <AnimatePresence>
        {limitErrorPopup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setLimitErrorPopup(false)}
          >
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--surface)', backdropFilter: 'blur(30px)', border: '1px solid #ef4444', borderRadius: 24, padding: '2.5rem', width: '90%', maxWidth: 420, boxShadow: '0 24px 64px rgba(239,68,68,0.1), inset 0 1px 0 rgba(255,255,255,1)', textAlign: 'center' }}
            >
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <Shield size={32} />
              </div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>Limit Exceeded</h3>
              <p style={{ color: 'var(--muted)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                You have reached the maximum allowed accounts for this role.
                <br /><br />
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>Please contact Fox Digital</span> to upgrade your plan or increase your limit.
              </p>
              <button 
                onClick={() => setLimitErrorPopup(false)}
                style={{ width: '100%', padding: '14px', borderRadius: 14, background: '#ef4444', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(239,68,68,0.3)' }}
              >
                Understood
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </motion.div>
    </div>
  );
}
