import React from 'react';
import { Sidebar } from './Sidebar';
import styles from './DashboardLayout.module.css';
import { Outlet } from 'react-router-dom';

export function DashboardLayout({ session }: { session: any }) {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.mainContent}>
        <Outlet />
      </main>
    </div>
  );
}
