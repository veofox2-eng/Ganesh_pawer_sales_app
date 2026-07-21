import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Shield, Search, User, Trash2, CheckCircle, Eye, EyeOff, KeyRound, ChevronDown, UserPlus, LogOut, Sun, Moon } from 'lucide-react';

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

// Dynamic limits are now fetched from tenant_config in the component state

export default function AccessDashboard() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('fox_access_theme') || 'dark');
  const [tenantLimits, setTenantLimits] = useState({ max_admin: 5, max_user: 10, max_field: 10 });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fox_access_theme', theme);
  }, [theme]);

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
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);
  const [showAddUserConfirmPassword, setShowAddUserConfirmPassword] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [limitErrorPopup, setLimitErrorPopup] = useState(false);

  const selectedProfile = useMemo(() => profiles.find(p => p.id === selectedProfileId), [profiles, selectedProfileId]);

  const counts = useMemo(() => {
    return {
      Sales: profiles.filter(p => p.role === 'Sales' || p.role === 'User').length,
      Field: profiles.filter(p => p.role === 'Field').length,
      Admin: profiles.filter(p => {
        if (p.role !== 'Admin') return false;
        const ident = (p.feature_flags?.email || p.username || '').toLowerCase();
        // Exclude system-level admins by email or username
        const systemAdmins = [
          'foxsuperadmin@gmail.com',
          'backendadmin1@gmail.com',
          'fox_test_admin_04@fox.com',
          'super administrator'
        ];
        return !systemAdmins.some(sys => ident.includes(sys));
      }).length,
    };
  }, [profiles]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    const [profilesRes, configRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('tenant_config').select('*').eq('id', 1).single()
    ]);
    if (configRes.data) {
      setTenantLimits({
        max_admin: configRes.data.max_admin || 5,
        max_user: configRes.data.max_user || 10,
        max_field: configRes.data.max_field || 10
      });
    }
    if (profilesRes.error) console.error("Error:", profilesRes.error);
    if (profilesRes.data) setProfiles(profilesRes.data);
    setLoading(false);
  }

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const name = p.username || p.full_name || p.feature_flags?.email || '';
      if (name === 'Super Administrator' || p.role === 'SuperAdmin' || name === 'Foxdigital Backend (DO NOT DELETE)') return false;
      
      const matchSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      let matchRole = false;
      if (filterRole === 'ALL') {
        matchRole = true;
      } else if (filterRole === 'PENDING') {
        matchRole = p.approval_status === 'Pending';
      } else if (filterRole === 'APPROVED') {
        matchRole = p.approval_status === 'Approved';
      } else if (filterRole === 'SALES') {
        matchRole = p.role === 'Sales' || p.role === 'User';
      } else if (filterRole === 'ADMIN') {
        matchRole = p.role === 'Admin';
      } else if (filterRole === 'FIELD') {
        matchRole = p.role === 'Field';
      } else {
        matchRole = p.role?.toLowerCase() === filterRole.toLowerCase();
      }

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
            backgroundColor: isEnabled ? 'var(--accent)' : '#cbd5e1',
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
      (addUserData.role === 'Sales' && counts.Sales >= tenantLimits.max_user) ||
      (addUserData.role === 'Field' && counts.Field >= tenantLimits.max_field) ||
      (addUserData.role === 'Admin' && counts.Admin >= tenantLimits.max_admin)
    ) {
      setLimitErrorPopup(true);
      return;
    }
    
    setAddUserLoading(true);
    try {
      const dbRole = addUserData.role === 'Sales' ? 'User' : addUserData.role;
      const response = await fetch('http://localhost:5002/api/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addUserData.email,
          username: addUserData.username,
          password: addUserData.password,
          role: dbRole,
          industry_position: addUserData.industry_position || undefined
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create employee');
      
      // Profile and feature flags are already fully initialized by the backend in the create-employee endpoint.
      // We don't need to poll or update it again here!

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
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '-10%', left: '-5%', width: '800px', height: '800px', borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, var(--orb1) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '700px', height: '700px', borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, var(--orb2) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.15, 0.3, 0.15] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        style={{ position: 'absolute', top: '30%', left: '40%', width: '600px', height: '600px', borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, var(--orb3) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--border-dark) 1px, transparent 1px), linear-gradient(90deg, var(--border-dark) 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.3 }} />

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '2rem', position: 'relative', zIndex: 10 }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 6, marginTop: 0 }}>
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
              const limit = role === 'Sales' ? tenantLimits.max_user : role === 'Field' ? tenantLimits.max_field : tenantLimits.max_admin;
              const isFull = current >= limit;
              const roleColor = role === 'Admin' ? '#a855f7' : role === 'Field' ? '#10b981' : '#0ea5e9';
              return (
                <div key={role} className="glass" style={{ borderTop: `3px solid ${roleColor}`, borderRadius: 16, padding: '12px 20px', display: 'flex', flexDirection: 'column', minWidth: 120 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>{role} LIMIT</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: isFull ? '#ef4444' : 'var(--text)' }}>{current}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>/ {limit}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="btn-hover"
            style={{ padding: '10px', borderRadius: 12, border: '1px solid var(--border-dark)', background: 'var(--bg2)', color: 'var(--text)', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', height: 'fit-content' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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
        <div className="glass-card" style={{ width: '480px', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflow: 'hidden' }}>
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
                          {p.role === 'User' ? 'Sales' : p.role} {isPending && ' • PENDING'}
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
        <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}>
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

                {selectedProfile.role?.includes('Admin') && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>My Workspace</h3>
                    <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}>
                      {renderToggle('dashboards', 'client', 'Clients')}
                      {renderToggle('dashboards', 'call_logs', 'Call Logs')}
                      {renderToggle('dashboards', 'other_records', 'Other Records')}
                      {renderToggle('dashboards', 'leads', 'Leads')}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Client & Lead Actions</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}>
                    {renderToggle('actions', 'dialer', 'Dialer & Calling')}
                    {renderToggle('actions', 'whatsapp', 'Send WhatsApp Messages')}
                    {renderToggle('actions', 'upload_files', 'Upload Files & Documents')}
                    {renderToggle('actions', 'voice_record', 'Voice Record in Notes')}
                    {renderToggle('actions', 'edit_profile', 'Edit Client Profile')}
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Background Services</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}>
                    {renderToggle('background', 'auto_call_record', 'Automatic Call Recording')}
                    {renderToggle('background', 'live_location', 'Live Location Tracking')}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Global Features</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}>
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
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: theme === 'dark' ? 'rgba(3, 7, 18, 0.7)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setActionData(null)}
          >
              <motion.div initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="glass-card"
              style={{ 
                position: 'relative', overflow: 'visible',
                border: `1px solid ${actionData.type === 'DELETE' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, 
                padding: '2.5rem', 
                width: '90%', maxWidth: 440, 
                background: theme === 'dark' ? 'linear-gradient(180deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.9) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(241,245,249,0.95) 100%)',
                boxShadow: actionData.type === 'DELETE' ? '0 24px 64px rgba(239,68,68,0.15)' : '0 24px 64px rgba(16,185,129,0.15)' 
              }}
            >
              {/* Decorative Background Orbs Clipped */}
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 20, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: actionData.type === 'DELETE' ? '#ef4444' : '#10b981', filter: 'blur(80px)', opacity: 0.2 }} />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1.25rem', color: actionData.type === 'DELETE' ? '#ef4444' : '#10b981', position: 'relative', zIndex: 1 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: actionData.type === 'DELETE' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #10b981, #047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: actionData.type === 'DELETE' ? '0 8px 16px rgba(239,68,68,0.3)' : '0 8px 16px rgba(16,185,129,0.3)' }}>
                  {actionData.type === 'DELETE' ? <Trash2 size={24} color="#fff" /> : <CheckCircle size={24} color="#fff" />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{actionData.type === 'DELETE' ? 'Delete' : 'Approve'} User</h3>
                </div>
              </div>
              <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.6, position: 'relative', zIndex: 1, fontSize: '0.95rem' }}>
                Are you sure you want to {actionData.type.toLowerCase()} <strong>{actionData.name}</strong>?
                {actionData.type === 'DELETE' && " This action will permanently remove their account and erase their data."}
              </p>

              {actionData.type === 'DELETE' && (
                <div style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <KeyRound size={14} /> Admin Verification
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Enter Admin Password"
                      style={{ width: '100%', padding: '14px 40px 14px 16px', borderRadius: 12, border: '1px solid var(--border-dark)', background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                      autoComplete="new-password"
                      onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-dark)'}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {actionError && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                      style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', padding: '8px 12px', borderRadius: 6, marginTop: 12 }}>
                      <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>{actionError}</p>
                    </motion.div>
                  )}
                </div>
              )}

              {actionData.type === 'APPROVE' && actionError && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', padding: '8px 12px', borderRadius: 6, marginBottom: 16 }}>
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>{actionError}</p>
                </motion.div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', position: 'relative', zIndex: 1 }}>
                <button onClick={() => setActionData(null)} disabled={actionLoading} 
                  style={{ flex: 1, padding: '14px', borderRadius: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem', fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Cancel
                </button>
                <button onClick={handleActionConfirm} disabled={actionLoading} 
                  style={{ flex: 1, padding: '14px', borderRadius: 12, background: actionData.type === 'DELETE' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #10b981, #047857)', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: actionData.type === 'DELETE' ? '0 8px 20px rgba(239,68,68,0.3)' : '0 8px 20px rgba(16,185,129,0.3)', transition: 'all 0.2s' }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = actionData.type === 'DELETE' ? '0 12px 28px rgba(239,68,68,0.4)' : '0 12px 28px rgba(16,185,129,0.4)' }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = actionData.type === 'DELETE' ? '0 8px 20px rgba(239,68,68,0.3)' : '0 8px 20px rgba(16,185,129,0.3)' }}
                >
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
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: theme === 'dark' ? 'rgba(3, 7, 18, 0.7)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setIsAddUserOpen(false)}
          >
            <motion.div initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="glass-card"
              style={{ 
                padding: '2.5rem', 
                width: '90%', 
                maxWidth: 480, 
                position: 'relative',
                overflow: 'visible',
                background: theme === 'dark' ? 'linear-gradient(180deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.9) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(241,245,249,0.95) 100%)',
                boxShadow: theme === 'dark' ? '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' : '0 24px 64px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)',
                border: '1px solid var(--border)'
              }}
            >
              {/* Decorative Background Orbs Clipped */}
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 20, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: -50, left: -50, width: 150, height: 150, background: 'var(--accent)', filter: 'blur(80px)', opacity: 0.4 }} />
                <div style={{ position: 'absolute', bottom: -50, right: -50, width: 150, height: 150, background: 'var(--accent2)', filter: 'blur(80px)', opacity: 0.3 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px var(--accent-glow)' }}>
                  <UserPlus size={24} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Create Employee</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>Add a new team member to your workspace.</p>
                </div>
              </div>
              
              <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                  <input required type="email" value={addUserData.email} onChange={e => setAddUserData({...addUserData, email: e.target.value})}
                    placeholder="name@company.com"
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border-dark)', background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', color: 'var(--text)', outline: 'none', caretColor: 'var(--accent)', cursor: 'text', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} 
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-dark)'}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input required type={showAddUserPassword ? 'text' : 'password'} value={addUserData.password} onChange={e => setAddUserData({...addUserData, password: e.target.value})}
                        placeholder="Min 6 characters"
                        style={{ width: '100%', padding: '14px 40px 14px 16px', borderRadius: 12, border: '1px solid var(--border-dark)', background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', color: 'var(--text)', outline: 'none', caretColor: 'var(--accent)', cursor: 'text', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} 
                        onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border-dark)'}
                      />
                      <button type="button" onClick={() => setShowAddUserPassword(!showAddUserPassword)} style={{ position: 'absolute', right: 12, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                        {showAddUserPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input required type={showAddUserConfirmPassword ? 'text' : 'password'} value={addUserData.confirmPassword} onChange={e => setAddUserData({...addUserData, confirmPassword: e.target.value})}
                        placeholder="Retype password"
                        style={{ width: '100%', padding: '14px 40px 14px 16px', borderRadius: 12, border: '1px solid var(--border-dark)', background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', color: 'var(--text)', outline: 'none', caretColor: 'var(--accent)', cursor: 'text', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} 
                        onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border-dark)'}
                      />
                      <button type="button" onClick={() => setShowAddUserConfirmPassword(!showAddUserConfirmPassword)} style={{ position: 'absolute', right: 12, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                        {showAddUserConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Role</label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setIsAddUserRoleOpen(!isAddUserRoleOpen)}
                        style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border-dark)', background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', color: 'var(--text)', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.2s' }}
                      >
                        <span style={{ fontWeight: 500 }}>{addUserData.role === 'Sales' ? 'Sales Employee' : addUserData.role === 'Field' ? 'Field Employee' : 'Admin'}</span>
                        <ChevronDown size={18} color="var(--muted)" style={{ transform: isAddUserRoleOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                      </button>
                      <AnimatePresence>
                        {isAddUserRoleOpen && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsAddUserRoleOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.2, ease: "easeOut" }}
                              style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '100%', background: theme === 'dark' ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(24px)', border: '1px solid var(--border)', borderRadius: 12, padding: 8, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', zIndex: 100 }}
                            >
                              {[
                                { value: 'Admin', label: 'Admin', desc: 'Full system access' },
                                { value: 'Sales', label: 'Sales Employee', desc: 'Manage leads & clients' },
                                { value: 'Field', label: 'Field Employee', desc: 'On-site operations' }
                              ].map(role => (
                                <button
                                  type="button"
                                  key={role.value}
                                  onClick={() => { setAddUserData({...addUserData, role: role.value}); setIsAddUserRoleOpen(false); }}
                                  style={{
                                    width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    background: addUserData.role === role.value ? 'var(--accent-glow)' : 'transparent',
                                    display: 'flex', flexDirection: 'column', gap: 2, transition: 'background 0.2s'
                                  }}
                                >
                                  <span style={{ color: addUserData.role === role.value ? 'var(--accent)' : 'var(--text)', fontSize: '0.95rem', fontWeight: addUserData.role === role.value ? 700 : 500 }}>{role.label}</span>
                                  <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{role.desc}</span>
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Industry Position</label>
                    <input type="text" value={addUserData.industry_position} onChange={e => setAddUserData({...addUserData, industry_position: e.target.value})}
                      placeholder="e.g., Manager"
                      style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border-dark)', background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', color: 'var(--text)', outline: 'none', caretColor: 'var(--accent)', cursor: 'text', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} 
                      onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-dark)'}
                    />
                  </div>
                </div>

                {addUserError && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', padding: '10px 14px', borderRadius: 6 }}>
                    <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>{addUserError}</p>
                  </motion.div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setIsAddUserOpen(false)} disabled={addUserLoading} 
                    style={{ flex: 1, padding: '14px', borderRadius: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem', fontWeight: 600, cursor: addUserLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={addUserLoading} 
                    style={{ flex: 2, padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: addUserLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px var(--accent-glow)', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px var(--accent-glow)' }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 20px var(--accent-glow)' }}
                  >
                    {addUserLoading ? 'Creating Account...' : 'Create Account'}
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
            style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(3, 7, 18, 0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setLimitErrorPopup(false)}
          >
            <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{ 
                position: 'relative',
                background: 'var(--bg)', 
                border: '1px solid rgba(239, 68, 68, 0.3)', 
                padding: '3rem', 
                width: '90%', 
                maxWidth: 420, 
                textAlign: 'center', 
                borderRadius: 28,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                overflow: 'hidden'
              }}
            >
              {/* Premium Red Glow */}
              <div style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', width: 250, height: 150, background: '#ef4444', filter: 'blur(60px)', opacity: 0.15, pointerEvents: 'none' }} />
              
              <div style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.1))', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 25px rgba(239,68,68,0.2)' }}>
                <Shield size={36} strokeWidth={2.5} />
              </div>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Limit Exceeded</h3>
              <p style={{ color: 'var(--muted)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2.5rem', fontWeight: 500 }}>
                You have reached the maximum allowed accounts for this role.
                <br /><br />
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>Please contact Fox Digital</span> to upgrade your plan or increase your limit.
              </p>
              <button 
                className="btn-hover"
                onClick={() => setLimitErrorPopup(false)}
                style={{ width: '100%', padding: '16px', borderRadius: 16, background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', color: '#fff', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(239,68,68,0.4)', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
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
