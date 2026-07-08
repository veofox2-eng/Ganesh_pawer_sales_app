import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { PhoneCall, CheckSquare, FileText, LogOut, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import styles from './Sidebar.module.css';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/calls', label: 'Call Sheet', icon: PhoneCall },
  { path: '/tasks', label: 'Task List', icon: CheckSquare },
  { path: '/payments', label: 'Payments', icon: FileText },
];

export function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <motion.div 
      initial={{ x: -280 }} 
      animate={{ x: 0 }} 
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={styles.sidebar}
    >
      <div className={styles.logoArea}>
        <div className={styles.logoIcon}>
          <TrendingUp size={24} />
        </div>
        <span className={styles.logoText}>SalesFlow</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                isActive ? `${styles.navItem} ${styles.activeNavItem}` : styles.navItem
              }
            >
              <Icon className={styles.icon} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <button onClick={handleLogout} className={styles.logoutBtn}>
        <LogOut className={styles.icon} />
        Sign Out
      </button>
    </motion.div>
  );
}
