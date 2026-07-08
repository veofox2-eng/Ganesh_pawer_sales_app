import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, CheckCircle, RotateCcw, Calendar, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import styles from './TaskBoard.module.css';

type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

interface Task {
  id: string;
  title: string;
  priority: Priority;
  due_date?: string;
  is_completed: boolean;
  completed_at?: string;
  associated_client_id?: string;
  user_id?: string;
  created_at: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  Low: styles.taskCardLow,
  Medium: styles.taskCardMedium,
  High: styles.taskCardHigh,
  Critical: styles.taskCardHigh,
};

const BADGE_STYLES: Record<string, string> = {
  Low: styles.badgeLow,
  Medium: styles.badgeMedium,
  High: styles.badgeHigh,
  Critical: styles.badgeHigh,
};

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Priority>('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', priority: 'Medium' as Priority, due_date: '' });

  useEffect(() => { fetchTasks(); }, []);

  async function fetchTasks() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setTasks(data);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: form.title,
        priority: form.priority,
        due_date: form.due_date || null,
        is_completed: false,
        user_id: user.id,
      })
      .select()
      .single();
    if (!error && data) { setTasks(prev => [data, ...prev]); setShowModal(false); resetForm(); }
    setSaving(false);
  }

  async function toggleDone(task: Task) {
    const now = new Date().toISOString();
    await supabase.from('tasks').update({
      is_completed: !task.is_completed,
      completed_at: !task.is_completed ? now : null,
    }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? {
      ...t,
      is_completed: !t.is_completed,
      completed_at: !t.is_completed ? now : undefined,
    } : t));
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function resetForm() { setForm({ title: '', priority: 'Medium', due_date: '' }); }

  function isOverdue(task: Task) {
    return !task.is_completed && task.due_date && new Date(task.due_date) < new Date();
  }

  const columns: { label: string; priority: Priority; dotClass: string }[] = [
    { label: 'High / Critical', priority: 'High', dotClass: styles.dotHigh },
    { label: 'Medium Priority', priority: 'Medium', dotClass: styles.dotMedium },
    { label: 'Low Priority', priority: 'Low', dotClass: styles.dotLow },
  ];

  const TABS = [
    { key: 'all', label: 'All', dotClass: styles.dotAll },
    { key: 'High', label: 'High', dotClass: styles.dotHigh },
    { key: 'Medium', label: 'Medium', dotClass: styles.dotMedium },
    { key: 'Low', label: 'Low', dotClass: styles.dotLow },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Task <span>Board</span></h1>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Task
        </button>
      </div>

      <div className={styles.priorityTabs}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key as any)}
            className={`${styles.tabBtn} ${filter === t.key ? styles.tabBtnActive : ''}`}>
            <div className={`${styles.priorityDot} ${t.dotClass}`} />
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tasksLayout}>
        {columns.map(col => {
          const colTasks = tasks.filter(t =>
            (col.priority === 'High' ? (t.priority === 'High' || t.priority === 'Critical') : t.priority === col.priority)
            && (filter === 'all' || (filter === 'High' ? (t.priority === 'High' || t.priority === 'Critical') : t.priority === filter))
          );
          return (
            <div key={col.priority}>
              <div className={styles.columnHeader}>
                <div className={`${styles.priorityDot} ${col.dotClass}`} />
                {col.label}
                <span className={styles.columnCount}>{colTasks.length}</span>
              </div>
              <AnimatePresence>
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className={styles.taskCard} style={{ opacity: 0.3, height: 80 }} />
                  ))
                ) : colTasks.length === 0 ? (
                  <div className={styles.emptyColumn}>No tasks yet</div>
                ) : (
                  colTasks.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.04 }}
                      className={`${styles.taskCard} ${PRIORITY_STYLES[task.priority]} ${task.is_completed ? styles.taskCardDone : ''}`}
                    >
                      <div className={`${styles.taskTitle} ${task.is_completed ? styles.taskTitleDone : ''}`}>
                        {task.title}
                      </div>
                      <div className={styles.taskMeta}>
                        <span className={`${styles.priorityBadge} ${BADGE_STYLES[task.priority]}`}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className={`${styles.taskDueDate} ${isOverdue(task) ? styles.taskDueDateOverdue : ''}`}>
                            <Calendar size={11} />
                            {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {isOverdue(task) && ' · Overdue'}
                          </span>
                        )}
                      </div>
                      <div className={styles.taskActions}>
                        <button
                          className={`${styles.taskActionBtn} ${task.is_completed ? styles.undoneBtn : styles.doneBtn}`}
                          onClick={() => toggleDone(task)}
                        >
                          {task.is_completed
                            ? <><RotateCcw size={12} /> Undo</>
                            : <><CheckCircle size={12} /> Done</>}
                        </button>
                        <button
                          className={styles.taskActionBtn}
                          style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.15)' }}
                          onClick={() => deleteTask(task.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={styles.modalOverlay} onClick={() => setShowModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className={styles.modal} onClick={e => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <span className={styles.modalTitle}>Add New Task</span>
                <button className={styles.closeBtn} onClick={() => setShowModal(false)}><X size={18} /></button>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Task Title *</label>
                  <input className={styles.formInput} placeholder="What needs to be done?" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Priority</label>
                    <select className={styles.formSelect} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}>
                      <option value="High">🔴 High</option>
                      <option value="Critical">🚨 Critical</option>
                      <option value="Medium">🟡 Medium</option>
                      <option value="Low">🟢 Low</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Due Date</label>
                    <input className={styles.formInput} type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !form.title.trim()}>
                  {saving ? 'Saving...' : 'Add Task'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
