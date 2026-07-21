import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Users, PhoneCall, MessageCircle, User, ArrowLeft, CheckCircle, Trash2, XCircle, Search, Play, Pause, FileText, Paperclip, Download, X, ChevronDown, MapPin, Mic, Map, UserPlus, Lock, Eye, EyeOff } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';

const RAW_COLORS = ['#f59e0b', '#10b981', '#ef4444', '#64748b']; // Follow-up, Converted, Lost, Deleted

const formatDateDDMMYYYY = (dateObj: Date) => {
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear();
  return `${d}-${m}-${y}`;
};

const formatDateTimeDDMMYYYY = (dateObj: Date) => {
  const dateStr = formatDateDDMMYYYY(dateObj);
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
};

function haversine(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371;
  const dLa = (la2 - la1) * Math.PI / 180;
  const dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function FieldEmployeesDashboard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPerformancePopup, setShowPerformancePopup] = useState(false);
  const [otherDetailPopup, setOtherDetailPopup] = useState<'tasks' | 'leads' | 'calls' | null>(null);
  const [distanceView, setDistanceView] = useState<'leaderboard' | 'history'>('history');
  const [distanceFilter, setDistanceFilter] = useState<'1W' | '1M' | '6M' | '1Y'>('1W');
  const [selectedApplicant, setSelectedApplicant] = useState<any | null>(null);
  const [showAddEmployeePopup, setShowAddEmployeePopup] = useState(false);
  const [addEmpData, setAddEmpData] = useState({ username: '', email: '', password: '', confirmPassword: '', role: 'Field' });
  const [addEmpLoading, setAddEmpLoading] = useState(false);
  const [addEmpError, setAddEmpError] = useState('');

  const [deleteEmployeeData, setDeleteEmployeeData] = useState<{ id: string, name: string } | null>(null);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [hoveredChartSlice, setHoveredChartSlice] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dashboardScrollPos = useRef<number>(0);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (selectedClientId) {
      scrollRef.current.scrollTop = 0;
    } else {
      scrollRef.current.scrollTop = dashboardScrollPos.current;
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      dashboardScrollPos.current = 0;
    }
  }, [selectedEmpId]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch sales profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, role')
          .in('role', ['field', 'Field']);

        if (!profiles || profiles.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch clients
        const { data: clients } = await supabase
          .from('clients')
          .select('*')
          .in('user_id', profiles.map(p => p.id));

        // Fetch interactions
        const clientIds = clients?.map(c => c.id) || [];
        let interactions: any[] = [];

        // Split into chunks if there are too many clients (supabase URL limit)
        if (clientIds.length > 0) {
          const chunkSize = 150;
          for (let i = 0; i < clientIds.length; i += chunkSize) {
            const chunk = clientIds.slice(i, i + chunkSize);
            const { data: interactionData } = await supabase
              .from('interactions')
              .select('id, user_id, client_id, type, created_at, content, media_url')
              .in('client_id', chunk)
              .in('type', ['CALL_RECORDING', 'CALL_MADE', 'WHATSAPP_CONTACT', 'NOTE_ADDED', 'ATTACHMENT_ADDED', 'VOICE_NOTE', 'PINNED_LOCATION']);

            if (interactionData) interactions = [...interactions, ...interactionData];
          }
        }

        // Fetch Other Call Records (not assigned to client) AND all Travel Plans / unassigned Pins
        const { data: otherInteractions } = await supabase
          .from('interactions')
          .select('id, user_id, client_id, type, created_at, content, media_url')
          .is('client_id', null)
          .in('user_id', profiles.map(p => p.id));

        const travelPlansAndUnassigned = otherInteractions || [];
        interactions = [...interactions, ...travelPlansAndUnassigned];

        // Fetch Tasks
        const { data: allTasks } = await supabase
          .from('tasks')
          .select('id, user_id, client_id, title, description, is_completed, priority, created_at')
          .in('user_id', profiles.map(p => p.id));

        // Fetch Lead Projects
        const { data: allLeadProjects } = await supabase
          .from('lead_projects')
          .select('id, created_by, project_name, created_at')
          .in('created_by', profiles.map(p => p.id));

        const leadProjectIds = allLeadProjects?.map(p => p.id) || [];
        const { data: allLeadApplicants } = leadProjectIds.length > 0
          ? await supabase.from('lead_applicants').select('id, project_id, name, phone, purpose, custom_responses, created_at').in('project_id', leadProjectIds)
          : { data: [] };

        const { data: otherCalls } = await supabase
          .from('interactions')
          .select('id, user_id, type, created_at, content, media_url')
          .is('client_id', null)
          .in('type', ['CALL_RECORDING', 'VOICE_NOTE'])
          .in('user_id', profiles.map(p => p.id));

        // Fetch Today's Locations for distance calculation
        const todayStr = new Date();
        todayStr.setHours(0, 0, 0, 0);
        const { data: todayLocations } = await supabase
          .from('employee_locations')
          .select('*')
          .in('user_id', profiles.map(p => p.id))
          .gte('updated_at', todayStr.toISOString())
          .order('updated_at', { ascending: true });

        // Fetch Historical Distance
        const { data: distanceHistory } = await supabase
          .from('daily_employee_distance')
          .select('*')
          .in('user_id', profiles.map(p => p.id))
          .order('date', { ascending: false });

        // Process Data
        const empData = profiles.map(emp => {
          const empClients = clients?.filter(c => c.user_id === emp.id) || [];

          let followUp = 0, converted = 0, lost = 0, deleted = 0;

          empClients.forEach(c => {
            if (c.is_deleted) deleted++;
            else if (['Converted', 'Closed'].includes(c.status)) converted++;
            else if (['Lost', 'Not Interested'].includes(c.status)) lost++;
            else followUp++;
          });

          const empClientIds = empClients.map(c => c.id);
          const empInteractions = interactions.filter(i => empClientIds.includes(i.client_id));

          const callCount = empInteractions.filter(i => i.type === 'CALL_RECORDING' || i.type === 'CALL_MADE').length;
          const whatsappCount = empInteractions.filter(i => i.type === 'WHATSAPP_CONTACT').length;
          const noteCount = empInteractions.filter(i => i.type === 'NOTE_ADDED').length;
          const attachmentCount = empInteractions.filter(i => i.type === 'ATTACHMENT_ADDED').length;

          // Calculate Distance for today matching the mobile app implementation
          let totalDistanceKm = 0;
          const userLocs = todayLocations?.filter(loc => loc.user_id === emp.id) || [];
          if (userLocs.length > 1) {
            for (let i = 1; i < userLocs.length; i++) {
              totalDistanceKm += haversine(
                Number(userLocs[i - 1].latitude), Number(userLocs[i - 1].longitude),
                Number(userLocs[i].latitude), Number(userLocs[i].longitude)
              );
            }
          }
          const kmVal = Math.round(totalDistanceKm * 10) / 10;

          // Attach interaction counts to each client for the table
          const mappedClients = empClients.map(c => {
            const cInteractions = empInteractions.filter(i => i.client_id === c.id);
            return {
              ...c,
              callCount: cInteractions.filter(i => i.type === 'CALL_RECORDING' || i.type === 'CALL_MADE').length,
              whatsappCount: cInteractions.filter(i => i.type === 'WHATSAPP_CONTACT').length,
              noteCount: cInteractions.filter(i => i.type === 'NOTE_ADDED').length,
              attachmentCount: cInteractions.filter(i => i.type === 'ATTACHMENT_ADDED').length,
              voiceNoteCount: cInteractions.filter(i => i.type === 'VOICE_NOTE').length,
              pinCount: cInteractions.filter(i => i.type === 'PINNED_LOCATION').length,
              cInteractions
            };
          });

          const empTasks = (allTasks?.filter(t => t.user_id === emp.id) || []).map(t => {
            const tClient = clients?.find(c => c.id === t.client_id);
            return { ...t, client_name: tClient ? tClient.name : null };
          }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          const empLeadProjects = (allLeadProjects?.filter(l => l.created_by === emp.id) || []).map(lp => ({
            ...lp,
            applicants: allLeadApplicants?.filter(a => a.project_id === lp.id) || []
          })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          const empOtherCalls = (otherCalls?.filter(i => i.user_id === emp.id) || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          return {
            ...emp,
            distanceHistory: distanceHistory?.filter(d => d.user_id === emp.id) || [],
            clients: mappedClients.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
            others: {
              tasks: empTasks,
              leadProjects: empLeadProjects,
              otherCalls: empOtherCalls
            },
            stats: {
              total: empClients.length,
              followUp, converted, lost, deleted,
              callCount, whatsappCount, noteCount, attachmentCount,
              voiceNotes: empInteractions.filter(i => i.type === 'VOICE_NOTE').length,
              pins: interactions.filter(i => i.user_id === emp.id && i.type === 'PINNED_LOCATION').length,
              distanceKm: kmVal,
              tasksCount: allTasks?.filter(t => t.user_id === emp.id).length || 0,
              leadProjectsCount: allLeadProjects?.filter(l => l.created_by === emp.id).length || 0,
              otherCallsCount: otherCalls?.filter(i => i.user_id === emp.id).length || 0
            }
          };
        });

        setEmployees(empData.sort((a, b) => (a.username || (a as any).feature_flags?.email || 'Pending Name').localeCompare(b.username || (b as any).feature_flags?.email || 'Pending Name')));
      } catch (err) {
        console.error("Error fetching sales data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const selectedEmp = useMemo(() => employees.find(e => e.id === selectedEmpId), [employees, selectedEmpId]);
  const selectedClient = useMemo(() => selectedEmp?.clients?.find((c: any) => c.id === selectedClientId), [selectedEmp, selectedClientId]);

  const filteredClients = useMemo(() => {
    if (!selectedEmp) return [];
    return selectedEmp.clients.filter((client: any) => {
      if (filterStatus === 'ALL') return true;
      if (filterStatus === 'Deleted') return client.is_deleted;
      if (client.is_deleted) return false;

      if (filterStatus === 'CALLS') return client.callCount > 0;
      if (filterStatus === 'WHATSAPP') return client.whatsappCount > 0;
      if (filterStatus === 'NOTES') return client.noteCount > 0;
      if (filterStatus === 'ATTACHMENTS') return client.attachmentCount > 0;

      const clientStatus = client.status || 'Follow-up';
      if (filterStatus === 'Converted') return ['Converted', 'Closed'].includes(clientStatus);
      if (filterStatus === 'Lost') return ['Lost', 'Not Interested'].includes(clientStatus);
      if (filterStatus === 'Follow-up') return ['Follow-up', 'Cold'].includes(clientStatus);
      return false;
    });
  }, [selectedEmp, filterStatus]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    return employees.filter(emp => {
      const empName = emp.username || emp.feature_flags?.email || 'Pending Name';
      return empName.toLowerCase().startsWith(searchQuery.toLowerCase());
    });
  }, [employees, searchQuery]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ height: '100%', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}
      >
        <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Glowing background orb */}
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: 'var(--accent)', filter: 'blur(20px)' }}
          />
          {/* Outer rotating ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            style={{ position: 'absolute', width: 56, height: 56, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'var(--accent)', borderRightColor: 'var(--accent)' }}
          />
          {/* Inner counter-rotating ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            style={{ position: 'absolute', width: 36, height: 36, borderRadius: '50%', border: '3px solid transparent', borderBottomColor: 'var(--text)', borderLeftColor: 'var(--text)' }}
          />
        </div>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1.05rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
        >
          Loading Data...
        </motion.div>
      </motion.div>
    );
  }

  const handleDownloadPDF = async () => {
    if (!selectedEmp) return;

    // Performance calculation (Net Score: Converted - Lost)
    const activeClients = selectedEmp.stats.converted + selectedEmp.stats.followUp + selectedEmp.stats.lost;
    const rawScore = activeClients > 0 ? ((selectedEmp.stats.converted - selectedEmp.stats.lost) / activeClients) * 100 : 0;
    const performancePct = rawScore < 0 && rawScore > -1 ? -1 : Math.round(rawScore);

    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Add Title
    doc.setFontSize(22);
    doc.setTextColor('#111827');
    doc.text(`Performance Report: ${selectedEmp.username || selectedEmp.feature_flags?.email || 'Pending'}`, 40, 40);

    // Add Subtitle/Date
    doc.setFontSize(10);
    doc.setTextColor('#6b7280');
    doc.text(`Generated on: ${formatDateDDMMYYYY(new Date())}`, 40, 60);

    // Big Bold Performance Score & Distance
    doc.setFontSize(16);
    doc.setTextColor('#1f2937');
    doc.setFont('helvetica', 'bold');
    doc.text(`Overall Performance Score: ${performancePct}%`, 40, 90);

    doc.setFontSize(14);
    doc.setTextColor('#6366f1');
    doc.text(`Total Distance Travelled: ${selectedEmp.stats.distanceKm} km`, 40, 110);

    let currentY = 140;

    // Capture Pie Chart
    if (scrollRef.current) {
      const pieChartElement = document.getElementById('pie-chart-container');
      if (pieChartElement) {
        try {
          const canvas = await html2canvas(pieChartElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
              const el = clonedDoc.getElementById('pie-chart-container');
              if (el) {
                el.style.setProperty('--text', '#111827');
                el.style.setProperty('--muted', '#6b7280');
              }
            }
          });
          const imgData = canvas.toDataURL('image/png');

          // Calculate dimensions to fit nicely
          const imgWidth = 400;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // Center the image
          const xOffset = (pageWidth - imgWidth) / 2;
          doc.addImage(imgData, 'PNG', xOffset, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 40;
        } catch (err) {
          console.error('Failed to capture pie chart:', err);
        }
      }
    }

    // Add Table
    const tableData = [
      ['Total Clients', selectedEmp.stats.total.toString()],
      ['Follow-up', selectedEmp.stats.followUp.toString()],
      ['Converted', selectedEmp.stats.converted.toString()],
      ['Lost', selectedEmp.stats.lost.toString()],
      ['Deleted', selectedEmp.stats.deleted.toString()],
      ['Total Calls', selectedEmp.stats.callCount.toString()],
      ['WhatsApp', selectedEmp.stats.whatsappCount.toString()],
      ['Notes Added', selectedEmp.stats.noteCount.toString()],
      ['Attachments', selectedEmp.stats.attachmentCount.toString()],
      ['Voice Notes', selectedEmp.stats.voiceNotes.toString()],
      ['Location Pins', selectedEmp.stats.pins.toString()],
      ['Distance Travelled', `${selectedEmp.stats.distanceKm} km`]
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Value']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 10, cellPadding: 6 },
      columnStyles: { 0: { fontStyle: 'bold' } },
      margin: { left: 40, right: 40 }
    });

    let nextY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 30 : currentY + 40;

    // Table 2: Calls Per Client
    const callsTableData = selectedEmp.clients
      .map((c: any) => [c.name || 'Unnamed Client', c.callCount.toString()]);

    if (callsTableData.length > 0) {
      if (nextY + 150 > pageHeight) {
        doc.addPage();
        nextY = 40;
      }

      doc.setFontSize(14);
      doc.setTextColor('#1f2937');
      doc.text(`Calls By Employee (${selectedEmp.username})`, 40, nextY);

      autoTable(doc, {
        startY: nextY + 15,
        head: [['Client Name', 'Total Calls']],
        body: callsTableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 10, cellPadding: 6 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: 40, right: 40 }
      });
      nextY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 30 : nextY + 40;
    }

    // Table 3: WhatsApp Per Client
    const whatsappTableData = selectedEmp.clients
      .map((c: any) => [c.name || 'Unnamed Client', c.whatsappCount.toString()]);

    if (whatsappTableData.length > 0) {
      if (nextY + 150 > pageHeight) {
        doc.addPage();
        nextY = 40;
      }

      doc.setFontSize(14);
      doc.setTextColor('#1f2937');
      doc.text(`WhatsApp By Employee (${selectedEmp.username})`, 40, nextY);

      autoTable(doc, {
        startY: nextY + 15,
        head: [['Client Name', 'WhatsApp Messages']],
        body: whatsappTableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 10, cellPadding: 6 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: 40, right: 40 }
      });
    }

    // Save
    doc.save(`${selectedEmp.username || 'Employee'}_Performance_Report.pdf`);
  };

  const handleAddEmployee = async () => {
    setAddEmpError('');
    if (!addEmpData.email || !addEmpData.password || !addEmpData.role) {
      setAddEmpError('Please fill all fields');
      return;
    }
    if (addEmpData.password !== addEmpData.confirmPassword) {
      setAddEmpError('Passwords do not match');
      return;
    }

    setAddEmpLoading(true);
    try {
      const response = await fetch('http://localhost:5002/api/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: addEmpData.username || undefined,
          email: addEmpData.email,
          password: addEmpData.password,
          role: addEmpData.role
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create employee');

      alert('Employee created successfully!');
      setShowAddEmployeePopup(false);
      setAddEmpData({ username: '', email: '', password: '', confirmPassword: '', role: 'Field' });
      window.location.reload();
    } catch (err: any) {
      setAddEmpError(err.message || 'Something went wrong');
    } finally {
      setAddEmpLoading(false);
    }
  };

  const handleDeleteEmployeeConfirm = async () => {
    if (!deleteEmployeeData || !deleteAdminPassword) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const response = await fetch('http://localhost:5002/api/delete-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: deleteEmployeeData.id,
          admin_password: deleteAdminPassword
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete employee');

      alert('Employee and all their records deleted successfully!');
      setDeleteEmployeeData(null);
      setDeleteAdminPassword('');
      if (selectedEmpId === deleteEmployeeData.id) setSelectedEmpId(null);
      window.location.reload();
    } catch (err: any) {
      setDeleteError(err.message || 'Something went wrong');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
      {/* LEFT SIDEBAR: Employee List */}
      <motion.div
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        style={{ width: 320, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}
      >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="var(--accent)" />
              Field Roster
            </h2>
          </div>          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {filteredEmployees.map(emp => (
            <motion.div
              key={emp.id}
              onClick={() => { setSelectedEmpId(emp.id); setSelectedClientId(null); setFilterStatus('ALL'); }}
              whileHover={{
                boxShadow: '0 0 15px rgba(99,102,241,0.4)',
                borderColor: 'var(--accent)',
                scale: 1.02
              }}
              style={{
                padding: '1rem', borderRadius: 12, marginBottom: '0.5rem', cursor: 'pointer',
                background: selectedEmpId === emp.id ? 'var(--accent)' : 'var(--bg)',
                color: selectedEmpId === emp.id ? '#fff' : 'var(--text)',
                border: selectedEmpId === emp.id ? '1px solid var(--accent)' : '1px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 2 }}>{emp.username || emp.feature_flags?.email || 'Pending Name'}</div>
                  <div style={{ fontSize: '0.75rem', opacity: selectedEmpId === emp.id ? 0.9 : 0.6 }}>
                    {emp.stats.total} Clients • {emp.stats.callCount} Calls
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {filteredEmployees.length === 0 && <p style={{ padding: '1rem', color: 'var(--muted)', textAlign: 'center', fontSize: '0.85rem' }}>No matching employees.</p>}
        </div>
      </motion.div>

      {/* RIGHT SIDE: Detail View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}
      >
        {!selectedEmp ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--muted)', gap: 12 }}>
            <User size={48} opacity={0.2} />
            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Select an employee to view their report</p>
          </div>
        ) : (
          <div ref={scrollRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

            {/* Employee Header */}
            <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to right, rgba(99,102,241,0.05), transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, var(--accent), #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem', fontWeight: 700, boxShadow: '0 8px 20px rgba(99,102,241,0.3)' }}>
                    {(selectedEmp.username || selectedEmp.feature_flags?.email || 'P').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{selectedEmp.username || selectedEmp.feature_flags?.email || 'Pending Name'}</h1>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 500 }}>Performance analytics and client portfolio</p>
                  </div>
                </div>
                {!selectedClient && (
                  <button
                    onClick={handleDownloadPDF}
                    className="btn-hover"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', padding: '0.75rem 1.25rem', borderRadius: 12, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}
                  >
                    <Download size={18} />
                    Download Report
                  </button>
                )}
              </div>
            </div>

            {selectedClient ? (
              /* --- CLIENT LEVEL REPORT --- */
              <div style={{ padding: '2.5rem' }}>
                <button
                  onClick={() => setSelectedClientId(null)}
                  style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 600, transition: 'opacity 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <ArrowLeft size={16} /> Back to {selectedEmp.username}'s Portfolio
                </button>

                {/* Client Profile Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      {selectedClient.name}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        background: selectedClient.is_deleted ? 'rgba(100,116,139,0.1)' :
                          ['Converted', 'Closed'].includes(selectedClient.status) ? 'rgba(16,185,129,0.1)' :
                            ['Lost', 'Not Interested'].includes(selectedClient.status) ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        color: selectedClient.is_deleted ? '#64748b' :
                          ['Converted', 'Closed'].includes(selectedClient.status) ? '#10b981' :
                            ['Lost', 'Not Interested'].includes(selectedClient.status) ? '#ef4444' : '#f59e0b'
                      }}>
                        {selectedClient.is_deleted ? 'Deleted' : (selectedClient.status || 'Follow-up')}
                      </span>
                      {selectedClient.phone && (
                        <span style={{ color: 'var(--muted)', fontSize: '1rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <PhoneCall size={16} /> {selectedClient.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Miniature Stats for Client */}
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Calls</span>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>{selectedClient.callCount}</span>
                    </div>
                    <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>WhatsApp</span>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>{selectedClient.whatsappCount}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))', borderRadius: 24, border: '1px solid var(--border)', padding: '2.5rem' }}>
                  <h3 style={{ margin: '0 0 2rem 0', fontSize: '1.25rem', color: 'var(--text)', fontWeight: 700 }}>
                    {filterStatus === 'CALLS' ? 'Call Timeline' :
                      filterStatus === 'WHATSAPP' ? 'WhatsApp Timeline' :
                        filterStatus === 'NOTES' ? 'Notes Timeline' :
                          filterStatus === 'ATTACHMENTS' ? 'Attachments Timeline' :
                            filterStatus === 'VOICE_NOTES' ? 'Voice Notes Timeline' :
                              filterStatus === 'PINS' ? 'Location Pins Timeline' : 'Interaction Timeline'}
                  </h3>
                  {(() => {
                    const timelineInteractions = selectedClient.cInteractions.filter((i: any) => {
                      if (filterStatus === 'CALLS') return i.type === 'CALL_RECORDING';
                      if (filterStatus === 'WHATSAPP') return i.type === 'WHATSAPP_CONTACT';
                      if (filterStatus === 'NOTES') return i.type === 'NOTE_ADDED';
                      if (filterStatus === 'ATTACHMENTS') return i.type === 'ATTACHMENT_ADDED';
                      if (filterStatus === 'VOICE_NOTES') return i.type === 'VOICE_NOTE';
                      if (filterStatus === 'PINS') return i.type === 'PINNED_LOCATION';
                      return true; // ALL or other statuses show everything
                    }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                    if (timelineInteractions.length === 0) {
                      return (
                        <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg)', borderRadius: 16, border: '1px dashed var(--border)' }}>
                          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem' }}>No interactions found for this filter.</p>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', paddingLeft: '1rem' }}>
                        {/* Vertical Line */}
                        <div style={{ position: 'absolute', left: '1.9rem', top: '1rem', bottom: '1rem', width: 2, background: 'var(--border)', zIndex: 0 }} />

                        {timelineInteractions.map((i: any) => (
                          <div key={i.id} style={{ display: 'flex', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: i.type === 'WHATSAPP_CONTACT' ? 'linear-gradient(135deg, #25D366, #128C7E)' :
                                i.type === 'NOTE_ADDED' ? 'linear-gradient(135deg, #eab308, #ca8a04)' :
                                  i.type === 'ATTACHMENT_ADDED' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' :
                                    i.type === 'VOICE_NOTE' ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' :
                                      i.type === 'PINNED_LOCATION' ? 'linear-gradient(135deg, #f43f5e, #be123c)' :
                                        'linear-gradient(135deg, var(--accent), #818cf8)',
                              color: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', border: '4px solid var(--surface)'
                            }}>
                              {i.type === 'WHATSAPP_CONTACT' ? <MessageCircle size={14} /> :
                                i.type === 'NOTE_ADDED' ? <FileText size={14} /> :
                                  i.type === 'ATTACHMENT_ADDED' ? <Paperclip size={14} /> :
                                    i.type === 'VOICE_NOTE' ? <Mic size={14} /> :
                                      i.type === 'PINNED_LOCATION' ? <MapPin size={14} /> :
                                        <PhoneCall size={14} />}
                            </div>
                            <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                                  {i.type === 'WHATSAPP_CONTACT' ? 'WhatsApp Message' :
                                    i.type === 'NOTE_ADDED' ? 'Note Added' :
                                      i.type === 'ATTACHMENT_ADDED' ? 'Attachment Uploaded' :
                                        i.type === 'VOICE_NOTE' ? 'Voice Note Recorded' :
                                          i.type === 'PINNED_LOCATION' ? 'Location Pinned' :
                                            i.type === 'CALL_MADE' ? 'Call Made' :
                                              'Call Logged'}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500 }}>
                                  {formatDateTimeDDMMYYYY(new Date(i.created_at))}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)', opacity: 0.85, lineHeight: 1.5 }}>
                                {i.content || (
                                  i.type === 'WHATSAPP_CONTACT' ? 'WhatsApp interaction logged automatically.' :
                                    i.type === 'NOTE_ADDED' ? 'Empty note.' :
                                      i.type === 'ATTACHMENT_ADDED' ? 'File attached.' :
                                        i.type === 'VOICE_NOTE' ? 'Voice note recorded.' :
                                          i.type === 'PINNED_LOCATION' ? 'Location pinned.' :
                                            i.type === 'CALL_MADE' ? 'Manual call logged.' :
                                              'Call recording uploaded automatically.'
                                )}
                              </p>
                              {i.type === 'CALL_RECORDING' && i.media_url && i.media_url !== 'DELETED' && (
                                <div style={{ marginTop: '1rem' }}>
                                  <CustomAudioPlayer src={i.media_url} />
                                </div>
                              )}
                              {i.type === 'VOICE_NOTE' && i.media_url && i.media_url !== 'DELETED' && (
                                <div style={{ marginTop: '1rem' }}>
                                  <CustomAudioPlayer src={i.media_url} />
                                </div>
                              )}
                              {i.type === 'ATTACHMENT_ADDED' && i.media_url && (
                                <div style={{ marginTop: '1rem' }}>
                                  <a href={i.media_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, color: 'var(--text)', textDecoration: 'none', fontSize: '0.8rem', border: '1px solid var(--border)' }}>
                                    <Paperclip size={14} /> View File Attachment
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* --- EMPLOYEE LEVEL REPORT --- */
              <div style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', flexWrap: 'wrap' }}>

                  {/* Pie Chart */}
                  <div style={{ flex: '1 1 350px', background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 24, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', alignSelf: 'flex-start', fontSize: '1.1rem', color: 'var(--text)', fontWeight: 700 }}>Conversion Breakdown</h3>
                    {selectedEmp.stats.total === 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>No clients to display.</p>
                      </div>
                    ) : (
                      <div id="pie-chart-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem' }}>
                        <svg width="0" height="0">
                          <defs>
                            <linearGradient id="colorFollowUp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" /><stop offset="95%" stopColor="#fbbf24" /></linearGradient>
                            <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" /><stop offset="95%" stopColor="#34d399" /></linearGradient>
                            <linearGradient id="colorLost" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" /><stop offset="95%" stopColor="#f87171" /></linearGradient>
                            <linearGradient id="colorDeleted" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#64748b" /><stop offset="95%" stopColor="#94a3b8" /></linearGradient>
                          </defs>
                        </svg>
                        <div style={{ width: '100%', height: 240, position: 'relative' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart style={{ outline: 'none' }}>
                              <Pie
                                data={[
                                  { name: 'Follow-up', value: selectedEmp.stats.followUp },
                                  { name: 'Converted', value: selectedEmp.stats.converted },
                                  { name: 'Lost', value: selectedEmp.stats.lost },
                                  { name: 'Deleted', value: selectedEmp.stats.deleted },
                                ].filter(d => d.value > 0)}
                                cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none"
                                isAnimationActive={false}
                                style={{ outline: 'none' }}
                              >
                                {[
                                  { name: 'Follow-up', color: '#f59e0b', value: selectedEmp.stats.followUp },
                                  { name: 'Converted', color: '#10b981', value: selectedEmp.stats.converted },
                                  { name: 'Lost', color: '#ef4444', value: selectedEmp.stats.lost },
                                  { name: 'Deleted', color: '#64748b', value: selectedEmp.stats.deleted }
                                ].filter(d => d.value > 0).map((entry, index) => {
                                  const isDimmed = hoveredChartSlice !== null && hoveredChartSlice !== entry.name;
                                  return (
                                    <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.1))', outline: 'none', opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.2s ease' }} />
                                  );
                                })}
                              </Pie>
                              <RechartsTooltip contentStyle={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid var(--border)', borderRadius: 12, color: '#1f2937', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', outline: 'none' }} itemStyle={{ color: '#1f2937', fontWeight: 600 }} />
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Center Text */}
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 0 }}>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{selectedEmp.stats.total}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4, fontWeight: 600 }}>Clients</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.5rem' }}>
                          <LegendItem color={RAW_COLORS[0]} label={`Follow-up (${selectedEmp.stats.followUp})`} onMouseEnter={() => setHoveredChartSlice('Follow-up')} onMouseLeave={() => setHoveredChartSlice(null)} />
                          <LegendItem color={RAW_COLORS[1]} label={`Converted (${selectedEmp.stats.converted})`} onMouseEnter={() => setHoveredChartSlice('Converted')} onMouseLeave={() => setHoveredChartSlice(null)} />
                          <LegendItem color={RAW_COLORS[2]} label={`Lost (${selectedEmp.stats.lost})`} onMouseEnter={() => setHoveredChartSlice('Lost')} onMouseLeave={() => setHoveredChartSlice(null)} />
                          <LegendItem color={RAW_COLORS[3]} label={`Deleted (${selectedEmp.stats.deleted})`} onMouseEnter={() => setHoveredChartSlice('Deleted')} onMouseLeave={() => setHoveredChartSlice(null)} />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setShowPerformancePopup(true)}
                      className="btn-hover"
                      style={{ marginTop: '2rem', padding: '0.85rem 1.5rem', background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', width: '100%' }}
                    >
                      View Performance Summary
                    </button>
                  </div>

                  {/* Summary Stats Grid */}
                  <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Status Stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Details</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '1rem' }}>
                        <StatCard title="All Clients" value={selectedEmp.stats.total.toString()} icon={<Users size={16} />} highlight={filterStatus === 'ALL'} isActive={filterStatus === 'ALL'} onClick={() => setFilterStatus('ALL')} />
                        <StatCard title="Follow-up" value={selectedEmp.stats.followUp.toString()} icon={<PhoneCall size={16} />} highlight={filterStatus === 'Follow-up'} isActive={filterStatus === 'Follow-up'} onClick={() => setFilterStatus('Follow-up')} />
                        <StatCard title="Converted" value={selectedEmp.stats.converted.toString()} icon={<CheckCircle size={16} />} highlight={filterStatus === 'Converted'} isActive={filterStatus === 'Converted'} onClick={() => setFilterStatus('Converted')} />
                        <StatCard title="Lost" value={selectedEmp.stats.lost.toString()} icon={<XCircle size={16} />} highlight={filterStatus === 'Lost'} isActive={filterStatus === 'Lost'} onClick={() => setFilterStatus('Lost')} />
                        <StatCard title="Deleted" value={selectedEmp.stats.deleted.toString()} icon={<Trash2 size={16} />} highlight={filterStatus === 'Deleted'} isActive={filterStatus === 'Deleted'} onClick={() => setFilterStatus('Deleted')} />
                      </div>
                    </div>

                    {/* Interaction Stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h4 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conversation Details</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '1rem' }}>
                        <StatCard title="Total Calls" value={selectedEmp.stats.callCount.toString()} icon={<PhoneCall size={16} />} highlight={filterStatus === 'CALLS'} isActive={filterStatus === 'CALLS'} onClick={() => setFilterStatus('CALLS')} />
                        <StatCard title="WhatsApp" value={selectedEmp.stats.whatsappCount.toString()} icon={<MessageCircle size={16} />} highlight={filterStatus === 'WHATSAPP'} isActive={filterStatus === 'WHATSAPP'} onClick={() => setFilterStatus('WHATSAPP')} />
                        <StatCard title="Notes Added" value={selectedEmp.stats.noteCount.toString()} icon={<FileText size={16} />} highlight={filterStatus === 'NOTES'} isActive={filterStatus === 'NOTES'} onClick={() => setFilterStatus('NOTES')} />
                        <StatCard title="Attachments" value={selectedEmp.stats.attachmentCount.toString()} icon={<Paperclip size={16} />} highlight={filterStatus === 'ATTACHMENTS'} isActive={filterStatus === 'ATTACHMENTS'} onClick={() => setFilterStatus('ATTACHMENTS')} />
                        <StatCard title="Voice Notes" value={selectedEmp.stats.voiceNotes.toString()} icon={<Mic size={16} />} highlight={filterStatus === 'VOICE_NOTES'} isActive={filterStatus === 'VOICE_NOTES'} onClick={() => setFilterStatus('VOICE_NOTES')} />
                        <StatCard title="Location Pins" value={selectedEmp.stats.pins.toString()} icon={<MapPin size={16} />} highlight={filterStatus === 'PINS'} isActive={filterStatus === 'PINS'} onClick={() => setFilterStatus('PINS')} />
                        <StatCard title="KM Today" value={selectedEmp.stats.distanceKm + " km"} icon={<Map size={16} />} highlight={filterStatus === 'DISTANCE'} isActive={filterStatus === 'DISTANCE'} onClick={() => setFilterStatus('DISTANCE')} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dynamic Table Section */}
                {filterStatus === 'DISTANCE' ? (
                  <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))', borderRadius: 24, border: '1px solid var(--border)', padding: '2rem', boxShadow: '0 8px 30px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)', fontWeight: 700 }}>Travel Distance Data</h3>
                      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg)', padding: '0.25rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                        <button onClick={() => setDistanceView('leaderboard')} style={{ padding: '0.5rem 1rem', background: distanceView === 'leaderboard' ? 'var(--accent)' : 'transparent', color: distanceView === 'leaderboard' ? '#fff' : 'var(--muted)', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s' }}>Leaderboard (Today)</button>
                        <button onClick={() => setDistanceView('history')} style={{ padding: '0.5rem 1rem', background: distanceView === 'history' ? 'var(--accent)' : 'transparent', color: distanceView === 'history' ? '#fff' : 'var(--muted)', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s' }}>Historical Data</button>
                      </div>
                    </div>

                    {distanceView === 'leaderboard' ? (
                      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                            <tr>
                              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--muted)' }}>Rank</th>
                              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--muted)' }}>Employee Name</th>
                              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--muted)' }}>Distance Travelled</th>
                              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--muted)' }}>Clients Handled</th>
                              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--muted)' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employees.slice().sort((a, b) => b.stats.distanceKm - a.stats.distanceKm).map((emp: any, i: number) => (
                              <tr key={emp.id} style={{ borderBottom: i === employees.length - 1 ? 'none' : '1px solid var(--border)', background: 'var(--surface)' }}>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text)', fontWeight: 700 }}>#{i + 1}</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: emp.id === selectedEmpId ? 'var(--accent)' : 'var(--text)' }}>
                                  {emp.username} {emp.id === selectedEmpId && '(Selected)'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: emp.stats.distanceKm > 0 ? '#10b981' : 'var(--muted)' }}>
                                  {emp.stats.distanceKm} km
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text)' }}>{emp.stats.total}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <button
                                    onClick={() => setSelectedEmpId(emp.id)}
                                    style={{ background: emp.id === selectedEmpId ? 'rgba(99,102,241,0.1)' : 'var(--accent)', color: emp.id === selectedEmpId ? 'var(--accent)' : '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    {emp.id === selectedEmpId ? 'Viewing' : 'View Profile'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {['1W', '1M', '6M', '1Y'].map(f => (
                            <button key={f} onClick={() => setDistanceFilter(f as any)} style={{ padding: '0.4rem 0.8rem', background: distanceFilter === f ? 'rgba(99,102,241,0.1)' : 'transparent', color: distanceFilter === f ? 'var(--accent)' : 'var(--muted)', border: distanceFilter === f ? '1px solid rgba(99,102,241,0.2)' : '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', transition: 'all 0.2s' }}>
                              {f === '1W' ? 'Last 1 Week' : f === '1M' ? 'Last 1 Month' : f === '6M' ? 'Last 6 Months' : '1 Year'}
                            </button>
                          ))}
                        </div>

                        {(() => {
                          const now = new Date();
                          const cutoff = new Date();
                          if (distanceFilter === '1W') cutoff.setDate(now.getDate() - 7);
                          if (distanceFilter === '1M') cutoff.setMonth(now.getMonth() - 1);
                          if (distanceFilter === '6M') cutoff.setMonth(now.getMonth() - 6);
                          if (distanceFilter === '1Y') cutoff.setFullYear(now.getFullYear() - 1);

                          const filteredHistory = selectedEmp.distanceHistory.filter((h: any) => new Date(h.date) >= cutoff);
                          const totalKm = filteredHistory.reduce((sum: number, h: any) => sum + Number(h.distance_km), 0);

                          return (
                            <>
                              <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', maxHeight: 350, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                  <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--muted)' }}>Date</th>
                                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--muted)' }}>Distance Travelled</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredHistory.length > 0 ? filteredHistory.map((h: any, i: number) => (
                                      <tr key={h.id} style={{ borderBottom: i === filteredHistory.length - 1 ? 'none' : '1px solid var(--border)', background: 'var(--surface)' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text)' }}>{formatDateDDMMYYYY(new Date(h.date))}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#10b981' }}>{h.distance_km} km</td>
                                      </tr>
                                    )) : (
                                      <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No historical distance data found for this period.</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '0.5rem', gap: '0.75rem' }}>
                                <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Total in period:</span>
                                <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: '1.25rem' }}>{Math.round(totalKm * 10) / 10} <span style={{ fontSize: '1rem', color: 'var(--muted)' }}>km</span></span>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))', borderRadius: 24, border: '1px solid var(--border)', padding: '2rem', boxShadow: '0 8px 30px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: 'var(--text)', fontWeight: 700 }}>Client Portfolio</h3>
                    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                        <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                          <tr>
                            <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Client Name</th>
                            <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Calls</th>
                            <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>WhatsApp</th>
                            <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Notes</th>
                            <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Attachments</th>
                            <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Voice</th>
                            <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Pins</th>
                            <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredClients.length === 0 ? (
                            <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No clients found for this filter.</td></tr>
                          ) : filteredClients.map((client: any, i: number) => (
                            <tr key={client.id} style={{ borderBottom: i === selectedEmp.clients.length - 1 ? 'none' : '1px solid var(--border)', background: 'var(--surface)' }}>
                              <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                <span
                                  onClick={() => {
                                    if (scrollRef.current) dashboardScrollPos.current = scrollRef.current.scrollTop;
                                    setSelectedClientId(client.id);
                                  }}
                                  style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'none' }}
                                  onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {client.name || 'Unnamed Client'}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                <span style={{
                                  padding: '4px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                                  background: client.is_deleted ? 'rgba(100,116,139,0.1)' :
                                    ['Converted', 'Closed'].includes(client.status) ? 'rgba(16,185,129,0.1)' :
                                      ['Lost', 'Not Interested'].includes(client.status) ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                  color: client.is_deleted ? '#64748b' :
                                    ['Converted', 'Closed'].includes(client.status) ? '#10b981' :
                                      ['Lost', 'Not Interested'].includes(client.status) ? '#ef4444' : '#f59e0b'
                                }}>
                                  {client.is_deleted ? 'Deleted' : (client.status || 'Follow-up')}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.callCount}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.whatsappCount}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.noteCount}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.attachmentCount}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.voiceNoteCount || 0}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center' }}>{client.pinCount || 0}</td>
                              <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                <button
                                  onClick={() => {
                                    if (scrollRef.current) dashboardScrollPos.current = scrollRef.current.scrollTop;
                                    setSelectedClientId(client.id);
                                  }}
                                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  View Report
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Others Section */}
                <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.01))', borderRadius: 24, border: '1px solid var(--border)', padding: '2rem', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', marginTop: '2rem' }}>
                  <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: 'var(--text)', fontWeight: 700 }}>Other Activities</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <StatCard
                      title="Lead Sheets Created"
                      value={selectedEmp.stats.leadProjectsCount.toString()}
                      icon={<FileText size={20} />}
                      onClick={() => setOtherDetailPopup('leads')}
                    />
                    <StatCard
                      title="Tasks Created"
                      value={selectedEmp.stats.tasksCount.toString()}
                      icon={<CheckCircle size={20} />}
                      onClick={() => setOtherDetailPopup('tasks')}
                    />
                    <StatCard
                      title="Other Call Records"
                      value={selectedEmp.stats.otherCallsCount.toString()}
                      icon={<PhoneCall size={20} />}
                      onClick={() => setOtherDetailPopup('calls')}
                    />
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </motion.div>

      {/* Performance Summary Popup */}
      {showPerformancePopup && selectedEmp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, padding: '2.5rem', width: '90%', maxWidth: 450, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative' }}>
            <button
              onClick={() => setShowPerformancePopup(false)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
            >
              <XCircle size={24} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>Overall Performance</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Total Clients</span>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>{selectedEmp.stats.total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Follow-up</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{selectedEmp.stats.followUp}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Converted</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{selectedEmp.stats.converted}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Lost</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{selectedEmp.stats.lost}</span>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))', borderRadius: 16, padding: '1.5rem', textAlign: 'center', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Performance Score</div>
              <div style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                {(() => {
                  const active = selectedEmp.stats.converted + selectedEmp.stats.followUp + selectedEmp.stats.lost;
                  const rawScore = active > 0 ? ((selectedEmp.stats.converted - selectedEmp.stats.lost) / active) * 100 : 0;
                  const score = rawScore < 0 && rawScore > -1 ? -1 : Math.round(rawScore);
                  return <span style={{ color: score < 0 ? '#ef4444' : 'var(--accent)' }}>{score}</span>;
                })()}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Popup */}
      {showAddEmployeePopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, padding: '2.5rem', width: '90%', maxWidth: 450, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative' }}>
            <button
              onClick={() => setShowAddEmployeePopup(false)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
            >
              <XCircle size={24} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={24} color="var(--accent)" />
              Add Employee
            </h2>

            {addEmpError && <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 500 }}>{addEmpError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}>Employee Name</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 1rem' }}>
                  <User size={16} color="var(--muted)" />
                  <input type="text" placeholder="John Doe" value={addEmpData.username} onChange={e => setAddEmpData({ ...addEmpData, username: e.target.value })} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem', color: 'var(--text)', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}>Email Address</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 1rem' }}>
                  <User size={16} color="var(--muted)" />
                  <input type="email" placeholder="employee@company.com" value={addEmpData.email} onChange={e => setAddEmpData({ ...addEmpData, email: e.target.value })} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem', color: 'var(--text)', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}>Password</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 1rem' }}>
                  <Lock size={16} color="var(--muted)" />
                  <input type="password" placeholder="••••••••" value={addEmpData.password} onChange={e => setAddEmpData({ ...addEmpData, password: e.target.value })} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem', color: 'var(--text)', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}>Recheck Password</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 1rem' }}>
                  <Lock size={16} color="var(--muted)" />
                  <input type="password" placeholder="••••••••" value={addEmpData.confirmPassword} onChange={e => setAddEmpData({ ...addEmpData, confirmPassword: e.target.value })} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem', color: 'var(--text)', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}>Industry Position (e.g., GM, Manager)</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 1rem' }}>
                  <User size={16} color="var(--muted)" />
                  <input type="text" placeholder="Field Executive" value={addEmpData.industry_position} onChange={e => setAddEmpData({ ...addEmpData, industry_position: e.target.value })} style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem', color: 'var(--text)', outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}>User Role</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'var(--bg)', border: `1px solid ${addEmpData.role === 'Sales' ? 'var(--accent)' : 'var(--border)'}`, padding: '0.75rem', borderRadius: 12 }}>
                    <input type="radio" name="empRole" checked={addEmpData.role === 'Sales'} onChange={() => setAddEmpData({ ...addEmpData, role: 'Sales' })} style={{ accentColor: 'var(--accent)' }} />
                    <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 500 }}>Sales Employee</span>
                  </label>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'var(--bg)', border: `1px solid ${addEmpData.role === 'Field' ? 'var(--accent)' : 'var(--border)'}`, padding: '0.75rem', borderRadius: 12 }}>
                    <input type="radio" name="empRole" checked={addEmpData.role === 'Field'} onChange={() => setAddEmpData({ ...addEmpData, role: 'Field' })} style={{ accentColor: 'var(--accent)' }} />
                    <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 500 }}>Field Employee</span>
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={handleAddEmployee}
              disabled={addEmpLoading}
              className="btn-hover"
              style={{ marginTop: '2rem', padding: '1rem', width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '1rem', cursor: addEmpLoading ? 'not-allowed' : 'pointer', opacity: addEmpLoading ? 0.7 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}
            >
              {addEmpLoading ? 'Creating...' : 'Create Employee Account'}
            </button>
          </div>
        </div>
      )}

      {/* Others Detail Popup */}
      {otherDetailPopup && selectedEmp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 24, padding: '2rem', width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
            <style>{`
              details > summary .chevron-icon { transition: transform 0.3s ease; }
              details[open] > summary .chevron-icon { transform: rotate(180deg); }
            `}</style>
            <button
              onClick={() => setOtherDetailPopup(null)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg)'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--surface)'; }}
            >
              <X size={20} />
            </button>

            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>
                {otherDetailPopup === 'leads' && 'Lead Sheets Created'}
                {otherDetailPopup === 'tasks' && 'Tasks Created'}
                {otherDetailPopup === 'calls' && 'Other Call Records'}
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Activity log for {selectedEmp.username || selectedEmp.feature_flags?.email || 'N/A'}</p>
            </div>

            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--muted)' }}>
                      {otherDetailPopup === 'leads' ? 'Project Name' : otherDetailPopup === 'tasks' ? 'Task Title' : 'Record Date'}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--muted)' }}>
                      {otherDetailPopup === 'leads' ? 'Created At' : otherDetailPopup === 'tasks' ? 'Status' : 'Details'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {otherDetailPopup === 'leads' && selectedEmp.others.leadProjects.length === 0 && (
                    <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No lead sheets created</td></tr>
                  )}
                  {otherDetailPopup === 'tasks' && selectedEmp.others.tasks.length === 0 && (
                    <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No tasks created</td></tr>
                  )}
                  {otherDetailPopup === 'calls' && selectedEmp.others.otherCalls.length === 0 && (
                    <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No other call records</td></tr>
                  )}

                  {otherDetailPopup === 'leads' && selectedEmp.others.leadProjects.map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={2} style={{ padding: 0 }}>
                        <details style={{ width: '100%' }} className="interactive-row">
                          <summary style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', cursor: 'pointer', outline: 'none', listStyle: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{item.project_name}</span>
                              <ChevronDown className="chevron-icon" size={16} style={{ color: 'var(--muted)', opacity: 0.7 }} />
                            </div>
                            <span style={{ color: 'var(--muted)' }}>{formatDateTimeDDMMYYYY(new Date(item.created_at))}</span>
                          </summary>
                          <div style={{ padding: '0 1rem 1rem 1rem' }}>
                            {item.applicants && item.applicants.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 12 }}>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Applicants ({item.applicants.length})</h4>
                                {item.applicants.map((a: any) => (
                                  <div
                                    key={a.id}
                                    onClick={() => setSelectedApplicant(a)}
                                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                                    style={{ fontSize: '0.85rem', padding: '0.75rem', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
                                  >
                                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{a.name}</div>
                                    <div style={{ color: 'var(--muted)', display: 'flex', gap: '1rem' }}>
                                      <span>{a.phone}</span>
                                      <span>{formatDateTimeDDMMYYYY(new Date(a.created_at))}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>No applicants yet</div>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}

                  {otherDetailPopup === 'tasks' && selectedEmp.others.tasks.map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={2} style={{ padding: 0 }}>
                        <details style={{ width: '100%' }} className="interactive-row">
                          <summary style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', cursor: 'pointer', outline: 'none', listStyle: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{item.title}</span>
                              <ChevronDown className="chevron-icon" size={16} style={{ color: 'var(--muted)', opacity: 0.7 }} />
                            </div>
                            <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: item.is_completed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: item.is_completed ? '#10b981' : '#f59e0b' }}>
                              {item.is_completed ? 'Completed' : 'Pending'}
                            </span>
                          </summary>
                          <div style={{ padding: '0 1rem 1rem 1rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text)', background: 'var(--surface)', padding: '1rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                              {item.priority && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <strong style={{ color: 'var(--muted)' }}>Priority:</strong> <span style={{ color: item.priority === 'High' ? '#ef4444' : item.priority === 'Medium' ? '#f59e0b' : '#3b82f6' }}>{item.priority}</span>
                                </div>
                              )}
                              <div style={{ marginBottom: item.client_name ? '0.75rem' : 0, lineHeight: 1.5 }}>
                                <strong style={{ color: 'var(--muted)' }}>Description:</strong><br />{item.description || 'No description provided.'}
                              </div>
                              {item.client_name && (
                                <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                                  <strong style={{ color: 'var(--muted)' }}>Client:</strong> {item.client_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}

                  {otherDetailPopup === 'calls' && selectedEmp.others.otherCalls.map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', color: 'var(--text)', fontWeight: 500 }}>{formatDateTimeDDMMYYYY(new Date(item.created_at))}</td>
                      <td style={{ padding: '1rem' }}>
                        {!item.media_url || item.media_url === 'DELETED' ? (
                          <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            Deleted by admin
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: 'var(--muted)' }}>Audio Recording</span>
                            <CustomAudioPlayer src={item.media_url} />
                            <a
                              href={item.media_url}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)',
                                color: 'var(--text)', cursor: 'pointer', transition: 'all 0.2s', marginLeft: '0.5rem'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--accent)'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text)'; }}
                              title="Download Audio"
                            >
                              <Download size={16} />
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Selected Applicant Detail Popup */}
      {selectedApplicant && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 24, padding: '2rem', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
            <button
              onClick={() => setSelectedApplicant(null)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg)'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--surface)'; }}
            >
              <X size={20} />
            </button>

            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>{selectedApplicant.name}</h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Applied on {formatDateTimeDDMMYYYY(new Date(selectedApplicant.created_at))}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Contact Number</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text)' }}>{selectedApplicant.phone}</div>
              </div>

              {selectedApplicant.purpose && (
                <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Purpose</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text)' }}>{selectedApplicant.purpose}</div>
                </div>
              )}

              {selectedApplicant.custom_responses && Object.keys(selectedApplicant.custom_responses).length > 0 && (
                <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Form Responses</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {Object.entries(selectedApplicant.custom_responses).map(([key, value]) => (
                      <div key={key}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', marginBottom: '0.1rem' }}>{key}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Employee Confirmation Popup */}
      {deleteEmployeeData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '2.5rem', width: '100%', maxWidth: 450, border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.35rem', color: '#ef4444', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={24} /> Delete Employee
              </h3>
              <button onClick={() => setDeleteEmployeeData(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '1.5rem' }}>
              <p style={{ margin: 0, color: '#ef4444', fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.5 }}>
                WARNING: You are about to completely delete <span style={{ fontWeight: 800 }}>{deleteEmployeeData.name}</span>.
                This will permanently erase their account and ALL associated clients and interaction records from the database. This action cannot be undone.
              </p>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}>Confirm Admin Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showDeletePassword ? "text" : "password"}
                  value={deleteAdminPassword}
                  onChange={(e) => setDeleteAdminPassword(e.target.value)}
                  placeholder="Enter your dashboard password..."
                  style={{ width: '100%', padding: '0.85rem 3rem 0.85rem 2.5rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--muted)' }}
                >
                  {showDeletePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {deleteError && (
              <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem', textAlign: 'center' }}>
                {deleteError}
              </div>
            )}

            <button
              onClick={handleDeleteEmployeeConfirm}
              disabled={deleteLoading || !deleteAdminPassword}
              style={{ width: '100%', padding: '1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: (deleteLoading || !deleteAdminPassword) ? 'not-allowed' : 'pointer', opacity: (deleteLoading || !deleteAdminPassword) ? 0.7 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              {deleteLoading ? 'Deleting...' : 'Permanently Delete Employee'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label, onMouseEnter, onMouseLeave }: { color: string, label: string, onMouseEnter?: () => void, onMouseLeave?: () => void }) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 500, color: 'var(--text)', cursor: 'default', transition: 'opacity 0.2s ease' }}
    >
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
      {label}
    </div>
  );
}

function StatCard({ title, value, icon, highlight = false, onClick, isActive = false }: any) {
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2, boxShadow: highlight ? '0 10px 20px rgba(59, 130, 246, 0.2)' : '0 8px 16px rgba(0,0,0,0.05)' }}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative', overflow: 'hidden',
        background: highlight ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--surface)',
        border: isActive ? `1px solid var(--accent)` : '1px solid var(--border)',
        borderRadius: 12,
        padding: '0.85rem 1rem',
        display: 'flex', flexDirection: 'column', gap: '0.4rem',
        color: highlight ? '#fff' : 'var(--text)',
        boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 2px 6px rgba(0,0,0,0.02)',
        backdropFilter: 'blur(12px)',
        flex: 1,
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: highlight ? 1 : 0.7, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: highlight ? 'rgba(255,255,255,0.2)' : 'var(--bg2)', color: highlight ? '#fff' : 'var(--accent)' }}>
          <span style={{ transform: 'scale(0.75)' }}>{icon}</span>
        </div>
        <span style={{ lineHeight: 1.2 }}>{title}</span>
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '0.15rem' }}>
        {value}
      </div>
    </motion.div>
  );
}

function CustomAudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onEnded = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, []);

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      audioRef.current?.play();
      setPlaying(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '1rem',
      background: 'linear-gradient(145deg, var(--surface), rgba(255,255,255,0.02))',
      border: '1px solid var(--border)',
      borderRadius: 100,
      padding: '6px 16px 6px 6px',
      minWidth: 260,
      maxWidth: 320,
      boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
    }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />
      <button
        onClick={toggle}
        style={{
          background: playing ? 'var(--text)' : 'var(--accent)',
          color: playing ? 'var(--bg)' : '#fff',
          border: 'none',
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
          transition: 'all 0.2s ease',
          boxShadow: playing ? 'none' : '0 4px 10px rgba(99,102,241,0.3)'
        }}
      >
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(progress)}
        </span>

        <div
          style={{
            flex: 1,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            position: 'relative',
            touchAction: 'none'
          }}
          onPointerDown={(e) => {
            if (!audioRef.current || duration === 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();

            const updateProgress = (clientX: number) => {
              const val = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
              if (audioRef.current) {
                audioRef.current.currentTime = val * duration;
                setProgress(val * duration);
              }
            };
            updateProgress(e.clientX);

            const handlePointerMove = (moveEvent: React.PointerEvent) => {
              updateProgress(moveEvent.clientX);
            };

            const handlePointerUp = (upEvent: React.PointerEvent) => {
              upEvent.currentTarget.releasePointerCapture(upEvent.pointerId);
              e.currentTarget.removeEventListener('pointermove', handlePointerMove as any);
              e.currentTarget.removeEventListener('pointerup', handlePointerUp as any);
            };

            e.currentTarget.addEventListener('pointermove', handlePointerMove as any);
            e.currentTarget.addEventListener('pointerup', handlePointerUp as any);
          }}
        >
          {/* Track background */}
          <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%`, height: '100%', background: 'var(--accent)', position: 'absolute', left: 0, top: 0, transition: 'width 0.1s linear' }} />
          </div>
          {/* Scrubber thumb */}
          <div style={{
            position: 'absolute',
            left: `${duration > 0 ? (progress / duration) * 100 : 0}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--text)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            transition: 'left 0.1s linear',
            pointerEvents: 'none'
          }} />
        </div>

        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
