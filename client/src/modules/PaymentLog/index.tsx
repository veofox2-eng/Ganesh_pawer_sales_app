import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, TrendingUp, TrendingDown, Clock, Trash2, DollarSign, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import styles from './PaymentLog.module.css';

type PaymentType = 'Income' | 'Expense';
type FrequencyType = 'ONE-TIME' | 'RECURRING';

interface Client {
  id: string;
  name: string;
}

interface Payment {
  id: string;
  client_id: string;
  type: PaymentType;
  payment_frequency: FrequencyType;
  amount: number;
  description?: string;
  due_date?: string;
  is_cleared: boolean;
  cleared_at?: string;
  user_id?: string;
  created_at: string;
  clients?: Client;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export function PaymentLog() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | PaymentType>('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    type: 'Income' as PaymentType,
    payment_frequency: 'ONE-TIME' as FrequencyType,
    amount: '',
    description: '',
    due_date: '',
  });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch user's clients for the dropdown
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('name');
    if (clientData) setClients(clientData);

    // Fetch payments via user_id
    const { data: paymentData } = await supabase
      .from('payments')
      .select('*, clients(id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (paymentData) setPayments(paymentData);

    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('payments')
      .insert({
        client_id: form.client_id || null,
        type: form.type,
        payment_frequency: form.payment_frequency,
        amount: parseFloat(form.amount),
        description: form.description || null,
        due_date: form.due_date || null,
        is_cleared: false,
        user_id: user.id,
      })
      .select('*, clients(id, name)')
      .single();
    if (!error && data) { setPayments(prev => [data, ...prev]); setShowModal(false); resetForm(); }
    setSaving(false);
  }

  async function toggleCleared(p: Payment) {
    const now = new Date().toISOString();
    await supabase.from('payments').update({
      is_cleared: !p.is_cleared,
      cleared_at: !p.is_cleared ? now : null,
    }).eq('id', p.id);
    setPayments(prev => prev.map(x => x.id === p.id ? { ...x, is_cleared: !p.is_cleared, cleared_at: !p.is_cleared ? now : undefined } : x));
  }

  async function deletePayment(id: string) {
    await supabase.from('payments').delete().eq('id', id);
    setPayments(prev => prev.filter(p => p.id !== id));
  }

  function resetForm() {
    setForm({ client_id: '', type: 'Income', payment_frequency: 'ONE-TIME', amount: '', description: '', due_date: '' });
  }

  const filtered = filter === 'all' ? payments : payments.filter(p => p.type === filter);
  const totalIncome = payments.filter(p => p.type === 'Income').reduce((s, p) => s + p.amount, 0);
  const totalExpense = payments.filter(p => p.type === 'Expense').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => !p.is_cleared && p.type === 'Income').reduce((s, p) => s + p.amount, 0);

  const getClientName = (p: Payment) => p.clients?.name || 'Unknown Client';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Payment <span>Tracker</span></h1>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        {[
          { label: 'Total Income', value: formatCurrency(totalIncome), cls: styles.incomeValue, Icon: TrendingUp },
          { label: 'Total Expenses', value: formatCurrency(totalExpense), cls: styles.expenseValue, Icon: TrendingDown },
          { label: 'Pending Collection', value: formatCurrency(totalPending), cls: styles.pendingValue, Icon: Clock },
        ].map(({ label, value, cls, Icon }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={styles.summaryCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className={styles.summaryLabel}>{label}</span>
              <Icon size={18} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className={`${styles.summaryValue} ${cls}`}>{value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        {(['all', 'Income', 'Expense'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}>
            {f === 'all' ? 'All' : f === 'Income' ? '↑ Income' : '↓ Expense'}
          </button>
        ))}
      </div>

      {/* Payment List */}
      <div className={styles.paymentList}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.paymentCard} style={{ opacity: 0.3, height: 72 }} />
          ))
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <DollarSign size={56} style={{ opacity: 0.25, display: 'block', margin: '0 auto 1rem' }} />
            <p style={{ fontWeight: 600 }}>No payments found</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.4rem' }}>Start tracking your income and expenses.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ delay: i * 0.04 }}
                className={styles.paymentCard}
              >
                <div className={`${styles.paymentIcon} ${p.type === 'Income' ? styles.incomeIcon : styles.expenseIcon}`}>
                  {p.type === 'Income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                </div>
                <div className={styles.paymentInfo}>
                  <div className={styles.paymentClient}>{getClientName(p)}</div>
                  <div className={styles.paymentMeta}>
                    {p.description && <span className={styles.paymentNote}>{p.description}</span>}
                    <span className={styles.paymentType}>
                      {p.payment_frequency === 'ONE-TIME' ? 'One-time' : 'Recurring'}
                    </span>
                    <span className={styles.paymentDate}>
                      {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className={styles.paymentRight}>
                  <div className={`${styles.paymentAmount} ${p.type === 'Income' ? styles.incomeAmount : styles.expenseAmount}`}>
                    {p.type === 'Income' ? '+' : '-'}{formatCurrency(p.amount)}
                  </div>
                  {!p.is_cleared ? (
                    <div className={styles.pendingLabel}><AlertCircle size={11} /> Pending</div>
                  ) : (
                    <div className={styles.paidLabel}>✓ Cleared</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginLeft: '0.5rem' }}>
                  <button
                    onClick={() => toggleCleared(p)}
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', color: p.is_cleared ? 'var(--warning)' : 'var(--success)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {p.is_cleared ? 'Unclear' : 'Mark Cleared'}
                  </button>
                  <button className={styles.deleteBtn} onClick={() => deletePayment(p.id)}><Trash2 size={14} /></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add Payment Modal */}
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
                <span className={styles.modalTitle}>Add Payment Entry</span>
                <button className={styles.closeBtn} onClick={() => setShowModal(false)}><X size={18} /></button>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Payment Direction</label>
                  <div className={styles.typeToggle}>
                    <button type="button" onClick={() => setForm({ ...form, type: 'Income' })}
                      className={`${styles.typeBtn} ${styles.typeIncome} ${form.type === 'Income' ? styles.typeActive : ''}`}>
                      ↑ Income (Client Pays You)
                    </button>
                    <button type="button" onClick={() => setForm({ ...form, type: 'Expense' })}
                      className={`${styles.typeBtn} ${styles.typeExpense} ${form.type === 'Expense' ? styles.typeActive : ''}`}>
                      ↓ Expense (You Pay Out)
                    </button>
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Client</label>
                    <select className={styles.formSelect} value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                      <option value="">No specific client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Amount (₹) *</label>
                    <input className={styles.formInput} type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Frequency</label>
                    <select className={styles.formSelect} value={form.payment_frequency} onChange={e => setForm({ ...form, payment_frequency: e.target.value as FrequencyType })}>
                      <option value="ONE-TIME">One-time</option>
                      <option value="RECURRING">Recurring</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Due Date</label>
                    <input className={styles.formInput} type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Description</label>
                  <textarea className={styles.formTextarea} placeholder="Optional details..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !form.amount}>
                  {saving ? 'Saving...' : 'Add Entry'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
