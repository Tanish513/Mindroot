import { useState, useEffect, useCallback } from 'react';
import { api, onPeersUpdated, onSessionsUpdated } from '../lib/api';
import { Button } from '../components/ui/Button';

export function AdminPortal() {
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  // Filters & Tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'both' | 'admin'>('all');
  const [activeSection, setActiveSection] = useState<'users' | 'sessions' | 'analytics'>('users');

  // Selected User Inspection Modal State
  const [inspectUser, setInspectUser] = useState<any | null>(null);
  const [inspectTab, setInspectTab] = useState<'overview' | 'sessions' | 'transactions' | 'reviews'>('overview');
  const [inspectReviews, setInspectReviews] = useState<any[]>([]);
  const [inspectTransactions, setInspectTransactions] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  // Edit Password Modal States
  const [editingPasswordUser, setEditingPasswordUser] = useState<any | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Delete Confirmation Modal States
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditPassword = (user: any) => {
    setEditingPasswordUser(user);
    setNewPasswordValue('');
  };

  const handleSavePassword = async () => {
    if (!editingPasswordUser || !newPasswordValue.trim()) return;
    setIsUpdatingPassword(true);
    try {
      const res = await api.updateUser(editingPasswordUser.id, { password: newPasswordValue.trim() });
      if (res && res.success !== false) {
        setActionMessage(`Password updated successfully for ${editingPasswordUser.name}!`);
        
        // Update local user state in users list
        setUsers(prev => prev.map(u => u.id === editingPasswordUser.id ? { ...u } : u));
        
        if (inspectUser && inspectUser.id === editingPasswordUser.id) {
          setInspectUser((prev: any) => prev ? { ...prev } : null);
        }
        
        setEditingPasswordUser(null);
        setNewPasswordValue('');
        setTimeout(() => setActionMessage(''), 4000);
      } else {
        alert(res?.error || 'Failed to update password.');
      }
    } catch (err) {
      console.error('Error updating password:', err);
      alert('Failed to update user password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [peers, sessList] = await Promise.all([api.getPeers(), api.getSessions()]);
      setUsers(peers || []);
      setSessions(sessList || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubPeers = onPeersUpdated((p) => {
      if (Array.isArray(p)) setUsers(p);
    });
    const unsubSessions = onSessionsUpdated((s) => {
      if (Array.isArray(s)) setSessions(s);
    });
    return () => {
      unsubPeers();
      unsubSessions();
    };
  }, [loadData]);

  // Open inspection drawer for a user
  const handleInspectUser = async (user: any) => {
    setInspectUser(user);
    setInspectTab('overview');
    setLoadingDetails(true);
    try {
      const [revs, txs] = await Promise.all([
        api.getReviews(user.id),
        api.getTransactions(user.id)
      ]);
      setInspectReviews(revs || []);
      setInspectTransactions(txs || []);
    } catch (err) {
      console.error('Failed to load user inspection details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Trigger Delete User Modal
  const handleDeleteUser = (user: any) => {
    if (user.id === 'user-admin' || user.role === 'admin') {
      alert('Cannot delete the Master System Admin account.');
      return;
    }
    setUserToDelete(user);
  };

  // Confirm Delete User API
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteUser(userToDelete.id);
      if (res && res.success !== false) {
        setActionMessage(`User "${userToDelete.name}" permanently removed from the platform.`);
        if (inspectUser && inspectUser.id === userToDelete.id) {
          setInspectUser(null);
        }
        setUserToDelete(null);
        loadData();
        setTimeout(() => setActionMessage(''), 4000);
      } else {
        alert(res?.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Trigger Delete Session Modal
  const handleDeleteSession = (session: any) => {
    setSessionToDelete(session);
  };

  // Confirm Delete Session API
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteSession(sessionToDelete.id);
      if (res && res.success !== false) {
        setActionMessage(`Session "${sessionToDelete.title}" removed successfully.`);
        setSessionToDelete(null);
        loadData();
        setTimeout(() => setActionMessage(''), 4000);
      } else {
        alert(res?.error || 'Failed to delete session.');
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      alert('Failed to delete session.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered users list
  const filteredUsers = users.filter((u: any) => {
    const matchesSearch = searchQuery === '' || 
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.skillsTaught?.some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.skillsLearned?.some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // KPI Statistics
  const totalStudents = users.filter(u => u.role === 'student' || u.role === 'both').length;
  const totalTeachers = users.filter(u => u.role === 'teacher' || u.role === 'both').length;
  const totalCompletedSessions = sessions.filter(s => s.status === 'completed').length;
  const totalActiveSessions = sessions.filter(s => s.status === 'confirmed' || s.status === 'pending').length;
  const avgTrustScore = users.length ? (users.reduce((sum, u) => sum + (u.trustScore || 5.0), 0) / users.length).toFixed(2) : '5.00';

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 select-none">
      {/* Header Banner */}
      <div className="bg-surface-container-high border border-outline-variant rounded-3xl p-8 text-on-surface shadow-elevation-1 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container text-on-surface border border-outline-variant rounded-full text-xs font-semibold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px] text-primary">admin_panel_settings</span>
              Administrator Portal
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-on-surface">Platform Data & User Management</h1>
            <p className="text-on-surface-variant text-sm font-medium max-w-2xl">
              Inspect student and teacher profiles, manage user IDs & account passwords, monitor active peer sessions, and ensure platform security.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={loadData} variant="secondary" className="bg-surface-container text-on-surface border border-outline-variant hover:bg-surface-container-high">
              <span className="material-symbols-outlined text-lg mr-2">refresh</span>
              Sync Live Data
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-5 rounded-2xl border border-outline-variant shadow-elevation-1 space-y-2 text-on-surface">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Users</span>
            <span className="material-symbols-outlined text-primary">group</span>
          </div>
          <p className="text-3xl font-bold text-on-surface">{users.length}</p>
          <p className="text-xs text-on-surface-variant font-medium">
            <span className="text-on-surface font-semibold">{totalStudents}</span> Students • <span className="text-on-surface font-semibold">{totalTeachers}</span> Teachers
          </p>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-outline-variant shadow-elevation-1 space-y-2 text-on-surface">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Peer Sessions</span>
            <span className="material-symbols-outlined text-primary">video_camera_front</span>
          </div>
          <p className="text-3xl font-bold text-on-surface">{sessions.length}</p>
          <p className="text-xs text-on-surface-variant font-medium">
            <span className="text-on-surface font-semibold">{totalCompletedSessions}</span> Completed • <span className="text-on-surface font-semibold">{totalActiveSessions}</span> Active
          </p>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-outline-variant shadow-elevation-1 space-y-2 text-on-surface">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Razorpay Volume</span>
            <span className="material-symbols-outlined text-primary">payments</span>
          </div>
          <p className="text-3xl font-bold text-on-surface">₹{(totalCompletedSessions * 499 + 14990).toLocaleString('en-IN')}</p>
          <p className="text-xs text-on-surface-variant font-medium">Total Processed Mentoring GMV</p>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-outline-variant shadow-elevation-1 space-y-2 text-on-surface">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Trust Rating</span>
            <span className="material-symbols-outlined text-primary">star</span>
          </div>
          <p className="text-3xl font-bold text-on-surface">{avgTrustScore} / 5.0</p>
          <p className="text-xs text-on-surface-variant font-medium">Platform verified standard</p>
        </div>
      </div>

      {/* Notification Banner */}
      {actionMessage && (
        <div className="bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-2xl p-4 text-xs font-bold flex items-center justify-between shadow-elevation-1 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teaching-emerald text-lg">check_circle</span>
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage('')} className="text-on-teaching-emerald-container hover:opacity-80">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Main Section Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-outline-variant pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSection('users')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-sm transition-all ${
              activeSection === 'users'
                ? 'bg-primary text-on-primary shadow-elevation-1'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-lg align-middle mr-2">manage_accounts</span>
            User Profiles ({users.length})
          </button>

          <button
            onClick={() => setActiveSection('sessions')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-sm transition-all ${
              activeSection === 'sessions'
                ? 'bg-primary text-on-primary shadow-elevation-1'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-lg align-middle mr-2">event_available</span>
            Session Ledger ({sessions.length})
          </button>

          <button
            onClick={() => setActiveSection('analytics')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-sm transition-all ${
              activeSection === 'analytics'
                ? 'bg-primary text-on-primary shadow-elevation-1'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-lg align-middle mr-2">analytics</span>
            System Analytics
          </button>
        </div>

        {activeSection === 'users' && (
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-64">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">search</span>
              <input
                type="text"
                placeholder="Search user, ID or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Role Filter Selector */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface px-3 py-2 outline-none focus:border-primary"
            >
              <option value="all">All Roles</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="both">Both (Dual)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        )}
      </div>

      {/* SECTION 1: USERS TABLE */}
      {activeSection === 'users' && (
        <div className="bg-surface rounded-2xl border border-outline-variant shadow-elevation-1 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-on-surface-variant font-bold animate-pulse">Loading platform profiles...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant font-bold">No user profiles found matching your search.</div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-black uppercase text-on-surface-variant tracking-wider">
                    <th className="py-3.5 px-5">User Profile</th>
                    <th className="py-3.5 px-4">User ID & Password</th>
                    <th className="py-3.5 px-4">Role Perspective</th>
                    <th className="py-3.5 px-4">Trust Score</th>
                    <th className="py-3.5 px-4">Hourly Rate</th>
                    <th className="py-3.5 px-4">Skills Matrix</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-xs font-medium">
                  {filteredUsers.map((u, i) => {
                    return (
                      <tr key={u.id || i} className="hover:bg-surface-container transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <img
                              src={u.avatar || `https://i.pravatar.cc/150?img=${i + 10}`}
                              alt={u.name}
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-outline-variant"
                            />
                            <div>
                              <p className="font-black text-on-surface text-sm">{u.name}</p>
                              <p className="text-[11px] text-on-surface-variant font-medium">{u.email || u.id}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-on-surface">
                              <span className="text-[10px] font-bold uppercase text-on-surface-variant">ID:</span>
                              <span className="font-bold text-on-surface select-all">{u.id}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-on-surface">
                              <span className="text-[10px] font-bold uppercase text-on-surface-variant">PWD:</span>
                              <span className="font-mono text-teaching-emerald font-bold bg-teaching-emerald-container border border-teaching-emerald/20 px-2 py-0.5 rounded text-[11px] select-all">
                                ••••••••
                              </span>
                              <button
                                onClick={() => handleEditPassword(u)}
                                className="text-on-surface-variant hover:text-primary p-0.5 transition-colors hover:scale-110 ml-0.5"
                                title="Edit password for this user"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black capitalize ${
                            u.role === 'admin' ? 'bg-learning-amber-container text-on-learning-amber-container border border-learning-amber/20' :
                            u.role === 'teacher' ? 'bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20' :
                            'bg-primary-container text-on-primary-container border border-primary/20'
                          }`}>
                            <span className="material-symbols-outlined text-[14px]">
                              {u.role === 'admin' ? 'admin_panel_settings' : u.role === 'teacher' ? 'workspace_premium' : u.role === 'both' ? 'swap_horiz' : 'school'}
                            </span>
                            {u.role || 'both'}
                          </span>
                        </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-black text-on-surface">
                          <span className="material-symbols-outlined text-learning-amber text-base">star</span>
                          {typeof u.trustScore === 'number' ? u.trustScore.toFixed(2) : '5.00'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-black text-teaching-emerald text-sm">
                        ₹{u.hourlyRate || 499}/hr
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-xs">
                          {u.skillsTaught?.length > 0 && (
                            <p className="truncate text-[11px] text-on-surface-variant">
                              <span className="font-extrabold text-teaching-emerald">Teaches:</span> {u.skillsTaught.join(', ')}
                            </p>
                          )}
                          {u.skillsLearned?.length > 0 && (
                            <p className="truncate text-[11px] text-on-surface-variant">
                              <span className="font-extrabold text-primary">Learns:</span> {u.skillsLearned.join(', ')}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => handleInspectUser(u)}
                            variant="secondary"
                            className="py-1 px-2.5 text-xs font-extrabold"
                          >
                            <span className="material-symbols-outlined text-sm mr-1">visibility</span>
                            Inspect
                          </Button>
                          {u.role !== 'admin' && u.id !== 'user-admin' && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-lg border border-alert-rose/20 bg-alert-rose-container hover:opacity-80 text-on-alert-rose-container font-bold transition-all shadow-elevation-1"
                              title="Delete user account"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: SESSION LEDGER */}
      {activeSection === 'sessions' && (
        <div className="bg-surface rounded-2xl border border-outline-variant shadow-elevation-1 overflow-hidden">
          {sessions.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant font-bold">No platform sessions found.</div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-black uppercase text-on-surface-variant tracking-wider">
                    <th className="py-3.5 px-5">Session Title</th>
                    <th className="py-3.5 px-4">Teacher</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-xs font-medium">
                  {sessions.map((s, i) => (
                    <tr key={s.id || i} className="hover:bg-surface-container">
                      <td className="py-3.5 px-5 font-black text-on-surface">{s.title || 'Peer Learning Exchange'}</td>
                      <td className="py-3.5 px-4 font-bold text-teaching-emerald">{s.teacher?.name || s.teacherId || 'Teacher'}</td>
                      <td className="py-3.5 px-4 font-bold text-primary">{s.student?.name || s.studentId || 'Student'}</td>
                      <td className="py-3.5 px-4 font-bold text-on-surface-variant">{s.durationMin || 60} mins</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          s.status === 'completed' ? 'bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20' :
                          s.status === 'confirmed' ? 'bg-primary-container text-on-primary-container border border-primary/20' : 'bg-learning-amber-container text-on-learning-amber-container border border-learning-amber/20'
                        }`}>
                          {s.status || 'confirmed'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleDeleteSession(s)}
                          className="p-1.5 rounded-lg border border-alert-rose/20 bg-alert-rose-container hover:opacity-80 text-on-alert-rose-container font-bold transition-all shadow-elevation-1"
                          title="Delete / Cancel session"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: SYSTEM ANALYTICS */}
      {activeSection === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface p-6 rounded-2xl border border-outline-variant shadow-elevation-1 space-y-4">
            <h3 className="text-base font-black text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">pie_chart</span>
              Role Distribution Matrix
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Students Only', count: users.filter(u => u.role === 'student').length, color: 'bg-primary' },
                { label: 'Teachers Only', count: users.filter(u => u.role === 'teacher').length, color: 'bg-teaching-emerald' },
                { label: 'Dual Roles (Both)', count: users.filter(u => u.role === 'both').length, color: 'bg-secondary' },
                { label: 'Administrators', count: users.filter(u => u.role === 'admin').length, color: 'bg-learning-amber' }
              ].map(item => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-on-surface">
                    <span>{item.label}</span>
                    <span>{item.count} users ({users.length ? Math.round((item.count / users.length) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                    <div className={`${item.color} h-full transition-all duration-500`} style={{ width: `${users.length ? (item.count / users.length) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-outline-variant shadow-elevation-1 space-y-4">
            <h3 className="text-base font-black text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-teaching-emerald">verified_user</span>
              Platform Integrity & Security
            </h3>
            <div className="space-y-3 text-xs font-medium text-on-surface-variant">
              <div className="p-3 bg-teaching-emerald-container border border-teaching-emerald/20 rounded-xl text-on-teaching-emerald-container font-bold flex items-center gap-3">
                <span className="material-symbols-outlined text-teaching-emerald text-xl">shield</span>
                Multi-Laptop Real-Time Synchronization Active
              </div>
              <div className="p-3 bg-primary-container border border-primary/20 rounded-xl text-on-primary-container font-bold flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
                Atomic Prisma Database Transactions Enabled for Token Transfers
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USER INSPECTION MODAL / DRAWER */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-elevation-3 border border-outline-variant flex flex-col animate-in fade-in zoom-in-95 duration-200 text-on-surface">
            {/* Modal Header */}
            <div className="bg-surface-container-high p-6 text-on-surface flex items-center justify-between border-b border-outline-variant">
              <div className="flex items-center gap-4">
                <img
                  src={inspectUser.avatar || `https://i.pravatar.cc/150?img=11`}
                  alt={inspectUser.name}
                  className="w-14 h-14 rounded-full object-cover ring-4 ring-primary/30"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black">{inspectUser.name}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-primary-container text-on-primary-container border border-primary/20">
                      {inspectUser.role || 'both'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant font-mono">User ID: {inspectUser.id}</p>
                </div>
              </div>

              <button
                onClick={() => setInspectUser(null)}
                aria-label="Close user inspection modal"
                className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Admin Credential Audit Banner */}
            <div className="bg-surface-container border-b border-outline-variant p-4 text-on-surface font-mono text-xs select-text">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-learning-amber font-bold text-[11px] uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">key</span>
                  Admin Credential Audit
                </div>
                <span className="px-2 py-0.5 bg-learning-amber-container text-on-learning-amber-container rounded text-[10px] font-extrabold border border-learning-amber/20">Master Admin View</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-surface p-2.5 rounded-xl border border-outline-variant">
                  <span className="text-[10px] text-on-surface-variant font-bold block uppercase">User ID</span>
                  <span className="font-bold text-on-surface text-xs select-all">{inspectUser.id}</span>
                </div>
                <div className="bg-surface p-2.5 rounded-xl border border-outline-variant">
                  <span className="text-[10px] text-on-surface-variant font-bold block uppercase">Email</span>
                  <span className="font-bold text-on-surface text-xs truncate block select-all">{inspectUser.email || `${inspectUser.id}@mindroot.com`}</span>
                </div>
                <div className="bg-surface p-2.5 rounded-xl border border-outline-variant">
                  <span className="text-[10px] text-on-surface-variant font-bold block uppercase">Password</span>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teaching-emerald text-xs select-all">
                      ••••••••
                    </span>
                    <button
                      onClick={() => handleEditPassword(inspectUser)}
                      className="text-on-surface-variant hover:text-primary p-0.5 transition-colors hover:scale-110"
                      title="Edit password for this user"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Key Badges */}
            <div className="bg-surface-container-low border-b border-outline-variant p-4 grid grid-cols-3 gap-3 text-center">
              <div className="bg-surface p-3 rounded-xl border border-outline-variant shadow-elevation-1">
                <span className="text-[10px] font-black uppercase text-on-surface-variant block">Trust Score</span>
                <span className="text-lg font-black text-on-surface flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-learning-amber text-sm">star</span>
                  {typeof inspectUser.trustScore === 'number' ? inspectUser.trustScore.toFixed(2) : '5.00'}
                </span>
              </div>

              <div className="bg-surface p-3 rounded-xl border border-outline-variant shadow-elevation-1">
                <span className="text-[10px] font-black uppercase text-on-surface-variant block">Token Balance</span>
                <span className="text-lg font-black text-learning-amber">{inspectUser.tokenBalance ?? 50} Tokens</span>
              </div>

              <div className="bg-surface p-3 rounded-xl border border-outline-variant shadow-elevation-1">
                <span className="text-[10px] font-black uppercase text-on-surface-variant block">Hourly Rate</span>
                <span className="text-lg font-black text-teaching-emerald">₹{inspectUser.hourlyRate || 499}/Hr</span>
              </div>
            </div>

            {/* Inspection Tabs */}
            <div className="flex border-b border-outline-variant bg-surface px-6">
              {[
                { key: 'overview', label: 'Skills Matrix', icon: 'psychology' },
                { key: 'sessions', label: 'Session History', icon: 'event' },
                { key: 'transactions', label: 'Token Ledger', icon: 'account_balance' },
                { key: 'reviews', label: 'Reviews & Feedback', icon: 'rate_review' }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setInspectTab(t.key as any)}
                  className={`py-3 px-4 text-xs font-black border-b-2 flex items-center gap-2 transition-colors ${
                    inspectTab === t.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 max-h-96 custom-scrollbar">
              {loadingDetails ? (
                <div className="py-8 text-center text-on-surface-variant font-bold animate-pulse">Loading detailed inspection logs...</div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW & SKILLS */}
                  {inspectTab === 'overview' && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant mb-3">Skills Offered (Teaches)</h4>
                        {inspectUser.skillsTaught?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {inspectUser.skillsTaught.map((s: string) => (
                              <span key={s} className="px-3 py-1.5 bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20 rounded-xl text-xs font-black">
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-on-surface-variant italic">No skills listed for teaching.</p>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant mb-3">Skills Desired (Wants to Learn)</h4>
                        {inspectUser.skillsLearned?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {inspectUser.skillsLearned.map((s: string) => (
                              <span key={s} className="px-3 py-1.5 bg-primary-container text-on-primary-container border border-primary/20 rounded-xl text-xs font-black">
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-on-surface-variant italic">No desired skills listed.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SESSIONS */}
                  {inspectTab === 'sessions' && (
                    <div className="space-y-3">
                      {sessions.filter(s => s.teacherId === inspectUser.id || s.studentId === inspectUser.id).length === 0 ? (
                        <p className="text-xs text-on-surface-variant text-center py-6 font-bold">No sessions logged for this user.</p>
                      ) : (
                        sessions
                          .filter(s => s.teacherId === inspectUser.id || s.studentId === inspectUser.id)
                          .map((s, i) => (
                            <div key={s.id || i} className="p-3 border border-outline-variant rounded-xl flex items-center justify-between text-xs bg-surface">
                              <div>
                                <p className="font-extrabold text-on-surface">{s.title}</p>
                                <p className="text-on-surface-variant text-[11px]">
                                  Role: <span className="font-bold text-on-surface">{s.teacherId === inspectUser.id ? 'Teacher' : 'Student'}</span>
                                </p>
                              </div>
                              <span className="px-2.5 py-1 bg-surface-container rounded-full font-black text-[10px] uppercase text-on-surface">
                                {s.status}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: TRANSACTIONS */}
                  {inspectTab === 'transactions' && (
                    <div className="space-y-3">
                      {inspectTransactions.length === 0 ? (
                        <p className="text-xs text-on-surface-variant text-center py-6 font-bold">No token transactions recorded yet.</p>
                      ) : (
                        inspectTransactions.map((tx: any, i: number) => (
                          <div key={tx.id || i} className="p-3 border border-outline-variant rounded-xl flex items-center justify-between text-xs bg-surface">
                            <div>
                              <p className="font-bold text-on-surface">{tx.description || 'Token Transfer'}</p>
                              <p className="text-[10px] text-on-surface-variant">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'Recent Activity'}</p>
                            </div>
                            <span className={`font-black text-sm ${tx.type === 'earned' ? 'text-teaching-emerald' : 'text-on-surface'}`}>
                              {tx.type === 'earned' ? '+' : '-'}{tx.amount} Tokens
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: REVIEWS */}
                  {inspectTab === 'reviews' && (
                    <div className="space-y-3">
                      {inspectReviews.length === 0 ? (
                        <p className="text-xs text-on-surface-variant text-center py-6 font-bold">No reviews submitted for this profile yet.</p>
                      ) : (
                        inspectReviews.map((rev: any, i: number) => (
                          <div key={rev.id || i} className="p-4 bg-surface-container-low border border-outline-variant rounded-2xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-xs text-on-surface">{rev.topic || 'Peer Session'}</span>
                              <div className="flex items-center text-learning-amber font-black text-xs">
                                <span className="material-symbols-outlined text-sm mr-0.5">star</span>
                                {rev.rating} / 5
                              </div>
                            </div>
                            <p className="text-xs italic text-on-surface-variant">"{rev.quote}"</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-surface-container-low border-t border-outline-variant p-4 flex items-center justify-between">
              <div>
                {inspectUser.role !== 'admin' && inspectUser.id !== 'user-admin' ? (
                  <button
                    onClick={() => handleDeleteUser(inspectUser)}
                    className="px-4 py-2 bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-elevation-1"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    Delete User Account
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-on-learning-amber-container bg-learning-amber-container border border-learning-amber/20 px-3 py-1 rounded-lg">
                    Protected Master Admin Account
                  </span>
                )}
              </div>
              <Button onClick={() => setInspectUser(null)} variant="primary" className="py-2 px-5 font-bold text-xs">
                Close Inspection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM PROPER INTERFACE: DELETE USER CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-elevation-3 border border-outline-variant space-y-5 animate-in zoom-in-95 duration-200 select-none text-on-surface">
            {/* Header with Danger Icon */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface tracking-tight">Delete User Account</h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">This action will permanently delete this account from Mindroot.</p>
              </div>
            </div>

            {/* Target User Info Card */}
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 flex items-center gap-3.5">
              <img
                src={userToDelete.avatar || 'https://i.pravatar.cc/150?img=11'}
                alt={userToDelete.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-outline-variant"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-on-surface truncate">{userToDelete.name}</h4>
                  <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-full text-[10px] font-bold uppercase">
                    {userToDelete.role || 'user'}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant font-medium truncate mt-0.5">{userToDelete.email || `ID: ${userToDelete.id}`}</p>
                {userToDelete.skillsTaught?.length > 0 && (
                  <p className="text-[10px] text-teaching-emerald font-bold truncate mt-0.5">Teaches: {userToDelete.skillsTaught.join(', ')}</p>
                )}
              </div>
            </div>

            {/* Warning Callout Box */}
            <div className="bg-alert-rose-container border border-alert-rose/20 rounded-2xl p-3.5 text-xs text-on-alert-rose-container space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-base">warning</span>
                <span>Permanent Removal Warning</span>
              </div>
              <p className="text-[11px] leading-relaxed font-medium">
                All associated tutoring sessions, chat messages, token ledger history, and feedback reviews for <b>{userToDelete.name}</b> will be permanently wiped.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isDeleting}
                onClick={() => setUserToDelete(null)}
                className="font-bold text-xs px-4 py-2.5 rounded-xl shadow-elevation-1"
              >
                Cancel
              </Button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteUser}
                className="bg-alert-rose hover:bg-alert-rose-hover active:scale-95 text-on-alert-rose font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-elevation-1 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM PROPER INTERFACE: DELETE SESSION CONFIRMATION MODAL */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-elevation-3 border border-outline-variant space-y-5 animate-in zoom-in-95 duration-200 select-none text-on-surface">
            {/* Header with Session Icon */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-learning-amber-container border border-learning-amber/20 text-on-learning-amber-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">event_busy</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface tracking-tight">Delete / Cancel Session</h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">Remove this scheduled lecture from the platform ledger.</p>
              </div>
            </div>

            {/* Target Session Info Card */}
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-on-surface truncate">{sessionToDelete.title || 'Tutoring Session'}</h4>
                <span className="px-2 py-0.5 bg-learning-amber-container text-on-learning-amber-container rounded-full text-[10px] font-bold uppercase">
                  {sessionToDelete.status || 'confirmed'}
                </span>
              </div>
              <div className="text-xs text-on-surface-variant flex flex-wrap gap-x-4 gap-y-1 pt-1.5 border-t border-outline-variant">
                <span>Teacher: <b className="text-on-surface">{sessionToDelete.teacher?.name || sessionToDelete.teacherId}</b></span>
                <span>Student: <b className="text-on-surface">{sessionToDelete.student?.name || sessionToDelete.studentId}</b></span>
                <span>Duration: <b className="text-on-surface">{sessionToDelete.durationMin || 60} mins</b></span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isDeleting}
                onClick={() => setSessionToDelete(null)}
                className="font-bold text-xs px-4 py-2.5 rounded-xl shadow-elevation-1"
              >
                Cancel
              </Button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteSession}
                className="bg-alert-rose hover:bg-alert-rose-hover active:scale-95 text-on-alert-rose font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-elevation-1 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>Delete Session</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM PROPER INTERFACE: EDIT USER PASSWORD MODAL */}
      {editingPasswordUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSavePassword();
            }}
            className="bg-surface rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-elevation-3 border border-outline-variant space-y-5 animate-in zoom-in-95 duration-200 select-none text-on-surface"
          >
            {/* Header with Key Icon */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-learning-amber-container border border-learning-amber/20 text-on-learning-amber-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">key</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface tracking-tight">Edit User Password</h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  Update login password for <b>{editingPasswordUser.name}</b>.
                </p>
              </div>
            </div>

            {/* Password Input Form Fields */}
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-3">
              <div className="text-xs text-on-surface-variant font-bold flex items-center justify-between">
                <span>Target User ID:</span>
                <span className="text-on-surface font-mono select-all bg-surface px-2 py-0.5 rounded border border-outline-variant">{editingPasswordUser.id}</span>
              </div>
              <div>
                <label className="text-[11px] font-extrabold text-on-surface uppercase tracking-wider block mb-1.5">
                  New Account Password
                </label>
                <input
                  type="text"
                  required
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  placeholder="Enter new password..."
                  className="w-full bg-surface border border-outline-variant rounded-xl px-3.5 py-2.5 text-sm font-mono text-on-surface font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isUpdatingPassword}
                onClick={() => setEditingPasswordUser(null)}
                className="font-bold text-xs px-4 py-2.5 rounded-xl shadow-elevation-1"
              >
                Cancel
              </Button>
              <button
                type="submit"
                disabled={isUpdatingPassword || !newPasswordValue.trim()}
                className="bg-primary hover:bg-primary-hover text-on-primary font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-elevation-1 flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95"
              >
                {isUpdatingPassword ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">save</span>
                    <span>Save Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
