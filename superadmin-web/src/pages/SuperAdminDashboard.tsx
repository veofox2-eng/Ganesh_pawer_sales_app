import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Shield, Activity, Settings, AlertCircle, Database, Check, X, ChevronRight, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_FEATURES = {
  dashboards: {
    client: true, task: true, leads: true, call_logs: true, other_records: true,
    my_status: true, admin_sales: true, admin_field: true, admin_approvals: true,
    map: true, settings: true
  },
  actions: { dialer: true, whatsapp: true, upload_files: true, voice_record: true, edit_profile: true },
  background: { auto_call_record: true, live_location: true }
};

export default function SuperAdminDashboard() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', password: '', role: 'Sales' });
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setProfiles(data);
    setLoading(false);
  };

  const filtered = profiles.filter(p => 
    (p.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.role || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleFeature = async (category: string, key: string, value: boolean) => {
    if (!selectedUser) return;
    
    const currentFeatures = selectedUser.feature_flags || DEFAULT_FEATURES;
    const updated = {
      ...currentFeatures,
      [category]: { ...(currentFeatures[category] || {}), [key]: value }
    };

    if (!updated.dashboards) updated.dashboards = DEFAULT_FEATURES.dashboards;
    if (!updated.actions) updated.actions = DEFAULT_FEATURES.actions;
    if (!updated.background) updated.background = DEFAULT_FEATURES.background;

    setSelectedUser({ ...selectedUser, feature_flags: updated });
    setProfiles(prev => prev.map(p => p.id === selectedUser.id ? { ...p, feature_flags: updated } : p));

    setSaving(true);
    await supabase.from('profiles').update({ feature_flags: updated }).eq('id', selectedUser.id);
    setTimeout(() => setSaving(false), 500);
  };

  const handleAddUser = async () => {
    if (!addForm.email || !addForm.password) return alert('Fill all fields');
    setAddLoading(true);
    try {
      const response = await fetch('http://localhost:5002/api/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addForm.email, password: addForm.password, role: addForm.role })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');
      
      setShowAdd(false);
      setAddForm({ email: '', password: '', role: 'Sales' });
      fetchProfiles();
    } catch (err: any) {
      alert(err.message || 'Something went wrong');
    } finally {
      setAddLoading(false);
    }
  };

  const renderToggle = (category: string, key: string, label: string) => {
    if (!selectedUser) return null;
    const currentFeatures = selectedUser.feature_flags || DEFAULT_FEATURES;
    const catObj = currentFeatures[category] || (DEFAULT_FEATURES as any)[category];
    const isEnabled = catObj[key] !== false; // Default true

    return (
      <motion.div 
        whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.03)' }}
        className="flex items-center justify-between p-4 bg-[var(--bg)] border border-[var(--border-dark)] rounded-2xl transition-all shadow-[0_4px_20px_rgba(0,0,0,0.1)]"
      >
        <span className="font-semibold text-[0.85rem] tracking-wide text-slate-200">{label}</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={isEnabled}
            onChange={(e) => toggleFeature(category, key, e.target.checked)}
          />
          <div className={`w-12 h-6 rounded-full transition-all duration-300 relative border ${isEnabled ? 'bg-gradient-to-r from-blue-500 to-indigo-500 border-indigo-400/30' : 'bg-slate-800 border-slate-700'}`}>
            <motion.div 
              initial={false}
              animate={{ x: isEnabled ? 24 : 2 }}
              className="absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.3)] flex items-center justify-center"
            >
              {isEnabled ? <Check size={12} className="text-indigo-600" /> : <X size={12} className="text-slate-400" />}
            </motion.div>
          </div>
        </label>
      </motion.div>
    );
  };

  return (
    <div className="flex gap-8 h-full relative">
      {/* LEFT COLUMN: Modern Glass Directory */}
      <div className="w-[400px] flex flex-col gap-6 h-full">
        <div className="glass-card p-6 flex flex-col gap-5 border border-[var(--border)] shadow-2xl relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Directory</h2>
              <p className="text-xs text-[var(--muted)] font-medium mt-1 uppercase tracking-widest">{filtered.length} active users</p>
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAdd(true)}
              className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20 hover:bg-white hover:text-indigo-900 transition-colors shadow-lg"
            >
              <UserPlus size={18} />
            </motion.button>
          </div>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-25 group-hover:opacity-40 transition-opacity" />
            <div className="relative bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center px-4 py-3">
              <Search className="text-[var(--muted)] mr-3" size={18} />
              <input 
                type="text" 
                placeholder="Search by name, email or role..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar pb-10">
          <AnimatePresence>
            {loading ? (
              <div className="flex justify-center p-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center p-8 text-[var(--muted)] glass-card">No users found.</div>
            ) : (
              filtered.map(user => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all relative overflow-hidden group ${selectedUser?.id === user.id ? 'bg-gradient-to-br from-[var(--surface)] to-[var(--bg2)] border border-indigo-500/50 shadow-[0_8px_30px_rgba(99,102,241,0.2)]' : 'glass-card border-[var(--border-dark)] hover:border-slate-500/50'}`}
                >
                  {selectedUser?.id === user.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-600" />
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-slate-100 text-[15px]">{user.username || 'Unnamed User'}</div>
                    <div className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest border ${
                      user.role === 'Admin' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                      user.role === 'Field' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {user.role}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--muted)] font-medium flex items-center justify-between">
                    {user.email || 'No email associated'}
                    <ChevronRight size={14} className={`transition-transform ${selectedUser?.id === user.id ? 'translate-x-1 text-indigo-400' : 'opacity-0 group-hover:opacity-100'}`} />
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT COLUMN: Ultra Premium Access Control */}
      <div className="flex-1 glass-card border-[var(--border)] rounded-3xl flex flex-col overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.4)] relative bg-[var(--bg2)]/60">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
        
        {selectedUser ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full z-10">
            <div className="p-8 border-b border-[var(--border-dark)] flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent backdrop-blur-md">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center border border-white/10 shadow-xl">
                  <Shield size={24} className={selectedUser.role === 'Admin' ? 'text-rose-400' : 'text-blue-400'} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">{selectedUser.username || selectedUser.email || 'User Settings'}</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-widest">Live Sync Active</span>
                  </div>
                </div>
              </div>
              <AnimatePresence>
                {saving && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Syncing</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              <Section title="Dashboards & Interfaces" icon={<Database size={20} />} color="text-blue-400" gradient="from-blue-500/20 to-transparent">
                {selectedUser.role.includes('Admin') ? (
                  <>
                    {renderToggle('dashboards', 'admin_sales', 'Sales Team Dashboard')}
                    {renderToggle('dashboards', 'admin_field', 'Field Team Dashboard')}
                    {renderToggle('dashboards', 'admin_approvals', 'Approvals Center')}
                  </>
                ) : selectedUser.role === 'Field' ? (
                  <>
                    {renderToggle('dashboards', 'map', 'Live Field Map')}
                    {renderToggle('dashboards', 'client', 'Client Database')}
                    {renderToggle('dashboards', 'task', 'Interactive Timeline')}
                    {renderToggle('dashboards', 'call_logs', 'Call History')}
                    {renderToggle('dashboards', 'leads', 'Lead Pipeline')}
                  </>
                ) : (
                  <>
                    {renderToggle('dashboards', 'client', 'Client Database')}
                    {renderToggle('dashboards', 'task', 'Interactive Timeline')}
                    {renderToggle('dashboards', 'call_logs', 'Call History')}
                    {renderToggle('dashboards', 'leads', 'Lead Pipeline')}
                  </>
                )}
              </Section>

              <Section title="Permissions & Actions" icon={<Activity size={20} />} color="text-emerald-400" gradient="from-emerald-500/20 to-transparent">
                {renderToggle('actions', 'dialer', 'In-App Calling')}
                {renderToggle('actions', 'whatsapp', 'WhatsApp Integration')}
                {renderToggle('actions', 'upload_files', 'Document Uploading')}
                {renderToggle('actions', 'voice_record', 'Voice Notes')}
                {renderToggle('actions', 'edit_profile', 'Edit Client Data')}
              </Section>

              <Section title="Background Services" icon={<AlertCircle size={20} />} color="text-purple-400" gradient="from-purple-500/20 to-transparent">
                {renderToggle('background', 'auto_call_record', 'Auto Call Recording')}
                {renderToggle('background', 'live_location', 'Background Location')}
              </Section>

              <Section title="System Settings" icon={<Settings size={20} />} color="text-slate-400" gradient="from-slate-500/20 to-transparent">
                {renderToggle('dashboards', 'settings', 'Access Settings Panel')}
              </Section>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-white/5 shadow-2xl mb-6 relative">
                <Shield size={40} className="text-slate-500" />
                <div className="absolute inset-0 border border-indigo-500/20 rounded-3xl animate-ping" style={{ animationDuration: '3s' }} />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight mb-2">Access Control</h3>
              <p className="text-slate-400 font-medium max-w-sm text-center">Select an identity from the directory to configure their active feature flags and permissions.</p>
            </motion.div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-[#0b1121] border border-slate-700 rounded-3xl w-full max-w-md p-8 shadow-[0_0_50px_rgba(59,130,246,0.15)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Provision Identity</h3>
                  <p className="text-sm text-slate-400 mt-1 font-medium">Create a new secure access node.</p>
                </div>
                <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                  <input 
                    type="email" 
                    value={addForm.email}
                    onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="agent@foxhq.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Secure Password</label>
                  <input 
                    type="password" 
                    value={addForm.password}
                    onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Access Level</label>
                  <div className="relative">
                    <select 
                      value={addForm.role}
                      onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white text-sm font-medium focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                    >
                      <option value="Sales">Sales Operative</option>
                      <option value="Field">Field Operative</option>
                      <option value="Admin">Administrator</option>
                    </select>
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none rotate-90" />
                  </div>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleAddUser}
                disabled={addLoading}
                className="w-full mt-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold tracking-wide hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] relative overflow-hidden"
              >
                {addLoading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>PROVISIONING...</span>
                  </div>
                ) : 'DEPLOY IDENTITY'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, icon, color, gradient, children }: any) {
  return (
    <div className="relative">
      <div className={`absolute top-0 left-0 w-1/3 h-px bg-gradient-to-r ${gradient}`} />
      <div className="flex items-center gap-3 mb-5">
        <div className={`p-2 rounded-lg bg-slate-800 border border-slate-700 shadow-sm ${color}`}>{icon}</div>
        <h4 className="font-bold text-slate-100 text-lg tracking-tight">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}
