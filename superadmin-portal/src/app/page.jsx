"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Settings, Server, Users, Activity, Smartphone, Check, X, ShieldAlert, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SuperAdminPortal() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [limits, setLimits] = useState({ max_admin: 0, max_user: 0, max_field: 0 });
  const [appAccess, setAppAccess] = useState({ admin_app_active: false, employee_app_active: false });
  const [stats, setStats] = useState({ admin: 0, user: 0, field: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [configRes, profilesRes] = await Promise.all([
        supabase.from('tenant_config').select('*').eq('id', 1).single(),
        supabase.from('profiles').select('*') // Select all to avoid column-level caching bugs
      ]);

      if (configRes.data) {
        setConfig(configRes.data);
        setLimits({
          max_admin: configRes.data.max_admin || 0,
          max_user: configRes.data.max_user || 0,
          max_field: configRes.data.max_field || 0
        });
        setAppAccess({
          admin_app_active: !!configRes.data.admin_app_active,
          employee_app_active: !!configRes.data.employee_app_active
        });
      }

      if (profilesRes.data) {
        const counts = { admin: 0, user: 0, field: 0 };
        const WEB_ADMIN_IDS = [
          '6e464e84-c626-4041-8c70-b7d533b430a8', // Super Administrator
          '08caf406-b2ef-435f-aa4b-b31189858cda'  // Foxdigital Backend
        ];

        profilesRes.data.forEach(p => {
          if (p.role === 'Admin') {
            if (!WEB_ADMIN_IDS.includes(p.id)) {
              counts.admin++;
            }
          }
          else if (p.role === 'Field') counts.field++;
          else counts.user++; // Sales/User
        });
        setStats(counts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLimits = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenant_config')
        .update({
          max_admin: parseInt(limits.max_admin) || 0,
          max_user: parseInt(limits.max_user) || 0,
          max_field: parseInt(limits.max_field) || 0,
        })
        .eq('id', 1);
      
      if (error) throw error;
      // Show success
    } catch (err) {
      alert('Failed to save limits: ' + err.message);
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  };

  const toggleAppAccess = async (key, val) => {
    const updated = { ...appAccess, [key]: val };
    setAppAccess(updated);
    
    try {
      await supabase.from('tenant_config').update({ [key]: val }).eq('id', 1);
    } catch (err) {
      alert('Failed to toggle app: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#030712]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#030712] text-slate-100 overflow-hidden font-sans">
      {/* GLOBAL EFFECTS */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02]" />
      </div>

      <main className="flex-1 flex flex-col p-8 relative z-10 overflow-y-auto custom-scrollbar max-w-7xl mx-auto w-full">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-10 mt-4">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)] relative">
              <ShieldAlert size={32} className="text-white" />
              <div className="absolute inset-0 rounded-2xl border border-white/20" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white mb-1">Super Administrator</h1>
              <p className="text-slate-400 font-medium text-sm tracking-wide">Global Master Configuration & Tenant Control</p>
            </div>
          </div>


        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LIMITS SECTION */}
          <div className="glass-card rounded-[2rem] p-8 relative overflow-hidden border border-white/10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                  <Server size={24} />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Login Allocations</h2>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handleSaveLimits}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm tracking-wide hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2 shadow-lg"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving</>
                ) : (
                  <>Save Limits</>
                )}
              </motion.button>
            </div>

            <p className="text-slate-400 text-sm mb-8 font-medium">Set the absolute maximum number of permitted employee accounts per role for this tenant.</p>

            <div className="space-y-6">
              <LimitRow 
                role="Administrator" 
                color="text-rose-400" 
                bg="bg-rose-500/10"
                current={stats.admin} 
                limit={limits.max_admin} 
                onChange={v => setLimits({...limits, max_admin: v})} 
              />
              <LimitRow 
                role="Sales Operative" 
                color="text-blue-400" 
                bg="bg-blue-500/10"
                current={stats.user} 
                limit={limits.max_user} 
                onChange={v => setLimits({...limits, max_user: v})} 
              />
              <LimitRow 
                role="Field Operative" 
                color="text-emerald-400" 
                bg="bg-emerald-500/10"
                current={stats.field} 
                limit={limits.max_field} 
                onChange={v => setLimits({...limits, max_field: v})} 
              />
            </div>
          </div>

          {/* MASTER APP TOGGLES SECTION */}
          <div className="glass-card rounded-[2rem] p-8 relative overflow-hidden border border-white/10 flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
            
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                <Cpu size={24} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Master Kill Switches</h2>
            </div>

            <p className="text-slate-400 text-sm mb-8 font-medium">Instantly enable or disable API access globally for mobile app clusters. If disabled, all active sessions for that app type will be rejected.</p>

            <div className="space-y-4">
              <AppToggle 
                title="Admin Mobile App" 
                desc="Grants access to the specialized management application."
                active={appAccess.admin_app_active} 
                onToggle={(val) => toggleAppAccess('admin_app_active', val)} 
              />
              <AppToggle 
                title="Employee Mobile App" 
                desc="Grants access to the main sales and field operative application."
                active={appAccess.employee_app_active} 
                onToggle={(val) => toggleAppAccess('employee_app_active', val)} 
              />
            </div>

            <div className="mt-auto pt-8">
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-4 items-start">
                <Activity className="text-amber-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-amber-500 font-bold text-sm mb-1">Warning</h4>
                  <p className="text-amber-500/80 text-xs font-medium leading-relaxed">Disabling an application kills all active websocket connections and invalidates tokens instantly. Use only during maintenance or security breaches.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function LimitRow({ role, color, bg, current, limit, onChange }) {
  const percentage = limit > 0 ? Math.min(100, (current / limit) * 100) : 100;
  
  const handleDecrement = () => {
    const val = parseInt(limit) || 0;
    if (val > 0) onChange(String(val - 1));
  };

  const handleIncrement = () => {
    const val = parseInt(limit) || 0;
    onChange(String(val + 1));
  };
  
  return (
    <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-700/50">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg ${bg} ${color} font-black uppercase tracking-widest text-[10px] border border-current/20`}>
            {role}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-400 mr-2">Limit:</span>
          
          <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-xl overflow-hidden shadow-inner">
            <button 
              onClick={handleDecrement}
              className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border-r border-slate-800"
            >
              -
            </button>
            <input 
              type="number" 
              value={limit}
              onChange={e => onChange(e.target.value)}
              className="w-12 bg-transparent text-center text-white font-bold focus:outline-none focus:bg-slate-900 py-1.5 transition-colors text-sm"
            />
            <button 
              onClick={handleIncrement}
              className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border-l border-slate-800"
            >
              +
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden relative">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 15 }}
            className={`absolute top-0 left-0 h-full rounded-full ${percentage >= 100 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
          />
        </div>
        <div className="text-xs font-bold w-24 text-right">
          <span className={current > limit ? "text-rose-400" : "text-white"}>{current}</span> 
          <span className="text-slate-500"> / {limit} max</span>
        </div>
      </div>
    </div>
  );
}

function AppToggle({ title, desc, active, onToggle }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      className={`p-5 rounded-2xl border transition-all ${active ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-900/50 border-slate-700/50'}`}
    >
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <div className={`p-3 rounded-xl ${active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
            <Smartphone size={20} />
          </div>
          <div>
            <h4 className={`font-bold text-base mb-1 ${active ? 'text-emerald-400' : 'text-slate-300'}`}>{title}</h4>
            <p className="text-xs text-slate-500 font-medium">{desc}</p>
          </div>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer ml-4">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={active}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <div className={`w-14 h-7 rounded-full transition-all duration-300 relative border ${active ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-slate-800 border-slate-700'}`}>
            <motion.div 
              initial={false}
              animate={{ x: active ? 28 : 2 }}
              className={`absolute top-[2px] w-5 h-5 rounded-full shadow-lg flex items-center justify-center ${active ? 'bg-emerald-400' : 'bg-slate-500'}`}
            >
              {active && <Check size={12} className="text-emerald-950 font-bold" />}
            </motion.div>
          </div>
        </label>
      </div>
    </motion.div>
  );
}
