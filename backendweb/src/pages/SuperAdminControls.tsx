import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Shield, Search, User, Trash2, CheckCircle, Eye, EyeOff, KeyRound } from 'lucide-react';

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

export default function SuperAdminControls() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');

  // Delete/Approve Modals
  const [actionData, setActionData] = useState<{ id: string, name: string, type: 'DELETE' | 'APPROVE' } | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const selectedProfile = useMemo(() => profiles.find(p => p.id === selectedProfileId), [profiles, selectedProfileId]);

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
      const matchSearch = (p.username || p.full_name || p.feature_flags?.email || '').toLowerCase().includes(searchQuery.toLowerCase());
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

    // Optimistic UI update
    setProfiles(prev => prev.map(p => p.id === selectedProfile.id ? { ...p, feature_flags: updated } : p));

    const { error } = await supabase.from('profiles').update({ feature_flags: updated }).eq('id', selectedProfile.id);
    if (error) {
      alert("Failed to save feature flag: " + error.message);
      fetchProfiles(); // rollback
    }
  }

  const renderToggle = (category: string, key: string, label: string) => {
    if (!selectedProfile) return null;
    const features = selectedProfile.feature_flags || DEFAULT_FEATURES;
    const catObj = features[category] || (DEFAULT_FEATURES as any)[category];
    const isEnabled = catObj[key] !== false; // true if missing or true

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
      const { error } = await supabase.from('profiles').update({ approval_status: 'Approved' }).eq('id', actionData.id);
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
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const res = await fetch('https://ganesh-backend-3j1t.onrender.com/api/delete-employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ employeeId: actionData.id, adminPassword })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed to delete user');
        
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

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'transparent', backgroundImage: 'linear-gradient(to right, var(--text), var(--accent))', WebkitBackgroundClip: 'text', letterSpacing: '-0.04em', marginBottom: 6 }}>
            Super Admin Controls
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 500 }}>
            Manage user roles, approvals, and feature visibility.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
        {/* LEFT PANE: Users List */}
        <div style={{
          width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid var(--border)', borderRadius: 20, padding: '1.25rem', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
              <input 
                type="text" placeholder="Search user..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <select 
              value={filterRole} onChange={e => setFilterRole(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="ADMIN">Admin</option>
              <option value="SALES">Sales</option>
              <option value="FIELD">Field</option>
            </select>
          </div>

          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
            {loading ? (
              <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 20 }}>Loading...</div>
            ) : filteredProfiles.length === 0 ? (
              <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 20 }}>No users found.</div>
            ) : (
              filteredProfiles.map(p => {
                const name = p.username || p.full_name || p.feature_flags?.email || 'Unknown User';
                const isSelected = selectedProfileId === p.id;
                const isPending = p.approval_status === 'Pending';
                
                return (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    style={{
                      padding: '12px', borderRadius: 12, cursor: 'pointer',
                      background: isSelected ? 'rgba(99,102,241,0.1)' : 'var(--bg2)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ background: isSelected ? 'var(--accent)' : 'var(--border)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={16} color={isSelected ? '#fff' : 'var(--muted)'} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{name}</div>
                        <div style={{ fontSize: '0.75rem', color: isPending ? '#f59e0b' : 'var(--muted)', fontWeight: isPending ? 700 : 500 }}>
                          {p.role} {isPending && ' • PENDING'}
                        </div>
                      </div>
                    </div>
                    {isPending && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={(e) => { e.stopPropagation(); setActionData({ id: p.id, name, type: 'APPROVE' }); }} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: 6, borderRadius: 8, cursor: 'pointer', color: '#10b981' }} title="Approve User">
                          <CheckCircle size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setActionData({ id: p.id, name, type: 'DELETE' }); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: 6, borderRadius: 8, cursor: 'pointer', color: '#ef4444' }} title="Delete User">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Feature Toggles */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}>
          {!selectedProfile ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', gap: 12 }}>
              <Shield size={48} opacity={0.2} />
              <p>Select a user to manage their features.</p>
            </div>
          ) : (
            <>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)' }}>
                  {selectedProfile.username || selectedProfile.full_name || selectedProfile.feature_flags?.email || 'Unknown User'}
                </h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4 }}>
                  {selectedProfile.role} Features
                </p>
              </div>

              <div className="custom-scrollbar" style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Dashboards & Main Screens</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                    {selectedProfile.role?.includes('Admin') ? (
                      <>
                        {renderToggle('dashboards', 'admin_sales', 'Sales Team Monitoring')}
                        {renderToggle('dashboards', 'admin_field', 'Field Team Monitoring')}
                        {renderToggle('dashboards', 'admin_approvals', 'Approvals Dashboard')}
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
                  <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Client & Lead Actions</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                    {renderToggle('actions', 'dialer', 'Dialer & Calling')}
                    {renderToggle('actions', 'whatsapp', 'Send WhatsApp Messages')}
                    {renderToggle('actions', 'upload_files', 'Upload Files & Documents')}
                    {renderToggle('actions', 'voice_record', 'Voice Record in Notes')}
                    {renderToggle('actions', 'edit_profile', 'Edit Client Profile')}
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Background Services</h3>
                  <div style={{ background: 'var(--bg2)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                    {renderToggle('background', 'auto_call_record', 'Automatic Call Recording')}
                    {renderToggle('background', 'live_location', 'Live Location Tracking')}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Global Features</h3>
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
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setActionData(null)}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--surface)', border: `1px solid ${actionData.type === 'DELETE' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 20, padding: '2rem', width: '90%', maxWidth: 400, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                    <KeyRound size={14} /> Admin Verification
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Enter Admin Password"
                      style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none', transition: 'all 0.2s' }}
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
                <button onClick={() => setActionData(null)} disabled={actionLoading} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.95rem', fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer' }}>
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

    </motion.div>
  );
}
