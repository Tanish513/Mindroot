import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { NoteEditor, type NoteEditorHandle } from '../components/notes/NoteEditor';

export function Notes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, addNotification } = useAppStore();

  // Route tab detection: /notes vs /notes/daily
  const isDailyRoute = location.pathname.includes('/daily');
  const [activeTab, setActiveTab] = useState<'all' | 'daily'>(isDailyRoute ? 'daily' : 'all');

  useEffect(() => {
    setActiveTab(location.pathname.includes('/daily') ? 'daily' : 'all');
  }, [location.pathname]);

  const switchTab = (tab: 'all' | 'daily') => {
    setActiveTab(tab);
    navigate(tab === 'daily' ? '/notes/daily' : '/notes');
  };

  // User's timezone
  const userTz = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  }, []);

  // Today's local date string
  const getTodayStr = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  };
  const todayStr = getTodayStr();

  // All Notes tab state
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'my' | 'shared' | 'by_session'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Editor Modal / Panel State
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorNoteType, setEditorNoteType] = useState<'regular' | 'daily'>('regular');
  const [editorDefaultDate, setEditorDefaultDate] = useState<string>(todayStr);

  // Daily Notes tab state
  const [dailyViewMode, setDailyViewMode] = useState<'calendar' | 'timeline'>('calendar');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [dailyNotes, setDailyNotes] = useState<any[]>([]);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(todayStr);
  const [dateRangeFrom, setDateRangeFrom] = useState<string>('');
  const [dateRangeTo, setDateRangeTo] = useState<string>('');
  const [timelineVisibleCount, setTimelineVisibleCount] = useState(10);
  const dailyEditorRef = useRef<NoteEditorHandle>(null);

  // 250ms search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Sessions and Tags
  useEffect(() => {
    api.getSessions().then(sList => {
      if (Array.isArray(sList)) setSessions(sList);
    }).catch(() => {});

    api.getNoteTags().then(tList => {
      if (Array.isArray(tList)) setAvailableTags(tList);
    }).catch(() => {});
  }, []);

  // Load All Notes with filters
  const loadNotes = () => {
    setLoadingNotes(true);
    api.getNotes({
      filter: activeFilter,
      tag: selectedTag || undefined,
      search: debouncedSearch || undefined
    }).then(res => {
      if (Array.isArray(res)) {
        setNotes(res);
        setDailyNotes(res.filter(n => n.type === 'daily'));
      }
    }).catch(() => {})
      .finally(() => setLoadingNotes(false));
  };

  useEffect(() => {
    loadNotes();
  }, [activeFilter, selectedTag, debouncedSearch]);

  // Active Daily Note for selected date
  const activeDailyNote = useMemo(() => {
    return dailyNotes.find(n => n.date === selectedDailyDate) || null;
  }, [dailyNotes, selectedDailyDate]);

  // Daily note dates set for calendar dots
  const dailyNoteDatesSet = useMemo(() => {
    return new Set(dailyNotes.filter(n => n.date).map(n => n.date));
  }, [dailyNotes]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isFuture: boolean;
      hasNote: boolean;
    }> = [];

    // Prev month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = prevDate.toISOString().slice(0, 10);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDailyDate,
        isFuture: dateStr > todayStr,
        hasNote: dailyNoteDatesSet.has(dateStr)
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const curDate = new Date(year, month, d);
      const curYear = curDate.getFullYear();
      const curMonth = String(curDate.getMonth() + 1).padStart(2, '0');
      const curDay = String(d).padStart(2, '0');
      const dateStr = `${curYear}-${curMonth}-${curDay}`;

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDailyDate,
        isFuture: dateStr > todayStr,
        hasNote: dailyNoteDatesSet.has(dateStr)
      });
    }

    // Next month padding to fill rows of 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().slice(0, 10);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDailyDate,
        isFuture: dateStr > todayStr,
        hasNote: dailyNoteDatesSet.has(dateStr)
      });
    }

    return days;
  }, [calendarMonth, todayStr, selectedDailyDate, dailyNoteDatesSet]);

  // Reverse-chronological timeline grouping by week
  const timelineGroupedByWeek = useMemo(() => {
    let filtered = [...dailyNotes];

    if (dateRangeFrom) {
      filtered = filtered.filter(n => (n.date || '') >= dateRangeFrom);
    }
    if (dateRangeTo) {
      filtered = filtered.filter(n => (n.date || '') <= dateRangeTo);
    }
    if (selectedTag) {
      const q = selectedTag.toLowerCase();
      filtered = filtered.filter(n => Array.isArray(n.tags) && n.tags.some((t: string) => t.toLowerCase() === q));
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter(n => {
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const contentMatch = (n.content || '').toLowerCase().includes(q);
        const tagMatch = Array.isArray(n.tags) && n.tags.some((t: string) => t.toLowerCase().includes(q));
        return titleMatch || contentMatch || tagMatch;
      });
    }

    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const sliced = filtered.slice(0, timelineVisibleCount);

    // Group by week label
    const groups: { [weekLabel: string]: any[] } = {};
    sliced.forEach(n => {
      const d = n.date ? new Date(n.date + 'T00:00:00') : new Date();
      const startOfWeek = new Date(d);
      const day = (startOfWeek.getDay() + 6) % 7;
      startOfWeek.setDate(startOfWeek.getDate() - day);
      const weekLabel = `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      if (!groups[weekLabel]) groups[weekLabel] = [];
      groups[weekLabel].push(n);
    });

    return { groups, totalCount: filtered.length, hasMore: filtered.length > timelineVisibleCount };
  }, [dailyNotes, dateRangeFrom, dateRangeTo, selectedTag, debouncedSearch, timelineVisibleCount]);

  // This week's daily notes
  const thisWeekNotes = useMemo(() => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    const mondayStr = monday.toISOString().slice(0, 10);

    return dailyNotes
      .filter(n => (n.date || '') >= mondayStr && (n.date || '') <= todayStr)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [dailyNotes, todayStr]);

  // Copy Week's notes as markdown
  const handleCopyThisWeekMarkdown = () => {
    if (thisWeekNotes.length === 0) return;
    let md = `# Weekly Learning Log (${thisWeekNotes[0].date} to ${thisWeekNotes[thisWeekNotes.length - 1].date})\n\n`;
    thisWeekNotes.forEach(n => {
      md += `## ${n.date} - ${n.title || 'Daily Note'}\n\n`;
      if (Array.isArray(n.tags) && n.tags.length > 0) {
        md += `**Tags:** ${n.tags.join(', ')}\n\n`;
      }
      const plain = (n.content || '').replace(/<[^>]+>/g, '').trim();
      md += `${plain}\n\n---\n\n`;
    });
    navigator.clipboard.writeText(md);
    addNotification({
      type: 'reminder',
      title: 'Copied to Clipboard',
      body: 'This week’s notes copied in Markdown format.'
    });
  };

  // Download Week's notes as .md file
  const handleDownloadThisWeekMarkdown = () => {
    if (thisWeekNotes.length === 0) return;
    let md = `# Weekly Learning Log (${thisWeekNotes[0].date} to ${thisWeekNotes[thisWeekNotes.length - 1].date})\n\n`;
    thisWeekNotes.forEach(n => {
      md += `## ${n.date} - ${n.title || 'Daily Note'}\n\n`;
      if (Array.isArray(n.tags) && n.tags.length > 0) {
        md += `**Tags:** ${n.tags.join(', ')}\n\n`;
      }
      const plain = (n.content || '').replace(/<[^>]+>/g, '').trim();
      md += `${plain}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindroot-week-${todayStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Open note in editor
  const handleOpenNote = (note: any) => {
    setSelectedNote(note);
    setEditorNoteType(note.type || 'regular');
    setEditorDefaultDate(note.date || todayStr);
    setIsEditorOpen(true);
  };

  // Create new regular note
  const handleCreateNewNote = () => {
    setSelectedNote(null);
    setEditorNoteType('regular');
    setIsEditorOpen(true);
  };

  // On Save / Delete callbacks
  const handleSaveSuccess = (saved: any) => {
    loadNotes();
    setSelectedNote(saved);
    addNotification({
      type: 'session',
      title: 'Note Saved',
      body: `"${saved.title || 'Note'}" has been saved.`
    });
  };

  const handleDeleteSuccess = () => {
    setIsEditorOpen(false);
    setSelectedNote(null);
    loadNotes();
    addNotification({
      type: 'session',
      title: 'Note Deleted',
      body: 'The note has been removed.'
    });
  };

  // Helper: Strip HTML for 2-3 line card previews
  const getPlainTextPreview = (html: string) => {
    if (!html) return 'No content yet...';
    const tmp = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return tmp || 'No content yet...';
  };

  return (
    <div className="max-w-container_max mx-auto space-y-6 select-none pb-12">
      {/* Page Header with Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">edit_note</span>
            <h1 className="text-xl sm:text-2xl font-bold text-text tracking-tight">Notes & Learning Journal</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted font-medium mt-0.5">
            Capture freeform notes, share lecture notes with students, and maintain your daily journal.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-start">
          {/* Two Tabs: All Notes & Daily */}
          <div className="flex items-center p-1 bg-surface-2 rounded-xl border border-border">
            <button
              onClick={() => switchTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-muted hover:text-text'
              }`}
            >
              All Notes
            </button>
            <button
              onClick={() => switchTab('daily')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'daily'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-muted hover:text-text'
              }`}
            >
              <span>Daily</span>
              {dailyNoteDatesSet.has(todayStr) && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              )}
            </button>
          </div>

          {/* Export button dropdown */}
          <div className="relative group">
            <button
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-border bg-surface text-text hover:bg-surface-2 flex items-center gap-1 cursor-pointer shadow-xs"
              title="Export daily notes"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span className="hidden sm:inline">Export</span>
            </button>
            <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-xl shadow-xl p-1 z-50 hidden group-hover:block">
              <a
                href={api.exportDailyNotesUrl('zip')}
                download="mindroot-daily-notes.zip"
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2 rounded-lg"
              >
                <span className="material-symbols-outlined text-sm">folder_zip</span>
                <span>Export as .ZIP</span>
              </a>
              <a
                href={api.exportDailyNotesUrl('md')}
                download="mindroot-daily-notes.md"
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2 rounded-lg"
              >
                <span className="material-symbols-outlined text-sm">article</span>
                <span>Export single .MD</span>
              </a>
            </div>
          </div>

          {activeTab === 'all' && (
            <button
              onClick={handleCreateNewNote}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>New Note</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================== TAB 1: ALL NOTES ===================== */}
      {activeTab === 'all' && (
        <div className="space-y-5">
          {/* Search, Filter Chips & Tag Dropdown */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Box with 250ms debounce */}
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-muted text-lg">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes by title, text, or tags..."
                className="w-full bg-surface border border-border rounded-xl pl-9 pr-8 py-2 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted hover:text-text cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* Filter Chips: All, My Notes, Shared with me, By Session */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'my', label: 'My Notes' },
                { id: 'shared', label: 'Shared with me' },
                { id: 'by_session', label: 'By Session' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                    activeFilter === f.id
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-2 text-muted hover:text-text border border-border'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {/* Tag Dropdown */}
              {availableTags.length > 0 && (
                <select
                  value={selectedTag}
                  onChange={e => setSelectedTag(e.target.value)}
                  className="bg-surface text-text border border-border rounded-full px-3 py-1.5 text-xs font-semibold focus:border-primary focus:outline-hidden cursor-pointer"
                >
                  <option value="">All Tags</option>
                  {availableTags.map((t, idx) => (
                    <option key={idx} value={t}>#{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Notes Responsive Card Grid */}
          {loadingNotes ? (
            <div className="py-16 text-center text-muted font-bold text-xs animate-pulse">
              Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-12 text-center bg-surface space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-2 text-primary flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">description</span>
              </div>
              <h3 className="text-sm font-bold text-text">
                {activeFilter === 'shared' ? 'No shared notes yet' : 'No notes yet'}
              </h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                {activeFilter === 'shared'
                  ? 'Notes your mentors share will appear here.'
                  : 'Start capturing your insights, action items, or session takeaways.'}
              </p>
              {activeFilter !== 'shared' && (
                <button
                  onClick={handleCreateNewNote}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
                >
                  Create your first note
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notes.map(note => {
                const isShared = note.visibility === 'shared';
                const isAuthor = note.authorId === currentUser?.id;
                const attachCount = Array.isArray(note.attachments) ? note.attachments.length : 0;
                const updatedStr = new Date(note.updatedAt || note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

                return (
                  <div
                    key={note.id}
                    onClick={() => handleOpenNote(note)}
                    className="bg-surface border border-border rounded-2xl p-4 shadow hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between gap-3 group focus-visible:ring-2 focus-visible:ring-primary"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenNote(note);
                      }
                    }}
                  >
                    <div>
                      {/* Card Header: Type / Session / Shared Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {note.type === 'daily' && (
                            <span className="px-2 py-0.5 rounded-full bg-primary-tint text-primary-text font-bold text-[10px]">
                              Daily • {note.date}
                            </span>
                          )}
                          {note.sessionTitle && (
                            <span className="px-2 py-0.5 rounded-full bg-surface-2 text-text font-bold text-[10px] border border-border truncate max-w-[150px]">
                              📅 {note.sessionTitle}
                            </span>
                          )}
                          {isShared && (
                            <span className="px-2 py-0.5 rounded-full bg-accent-tint text-accent-text font-bold text-[10px] flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">share</span>
                              <span>{isAuthor ? 'Shared' : 'Shared by Mentor'}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted whitespace-nowrap">{updatedStr}</span>
                      </div>

                      {/* Card Title */}
                      <h3 className="text-sm font-bold text-text group-hover:text-primary transition-colors line-clamp-1">
                        {note.title || 'Untitled Note'}
                      </h3>

                      {/* 2-3 Line Plain Text Preview */}
                      <p className="text-xs text-muted line-clamp-3 mt-1.5 leading-relaxed">
                        {getPlainTextPreview(note.content)}
                      </p>
                    </div>

                    {/* Card Footer: Tags & Attachment Indicator */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-1 flex-wrap overflow-hidden max-h-6">
                        {Array.isArray(note.tags) && note.tags.slice(0, 3).map((tag: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-primary-tint text-primary-text font-semibold text-[10px]">
                            #{tag}
                          </span>
                        ))}
                        {Array.isArray(note.tags) && note.tags.length > 3 && (
                          <span className="text-[10px] text-muted font-bold">+{note.tags.length - 3}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-muted">
                        {attachCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[11px] font-bold" title={`${attachCount} attachment(s)`}>
                            <span className="material-symbols-outlined text-sm">attach_file</span>
                            <span>{attachCount}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: DAILY NOTES ===================== */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Daily Header: Date, Prompt Chips, View Toggle */}
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Learning Journal</span>
                <h2 className="text-lg sm:text-xl font-bold text-text">
                  Daily Note • {selectedDailyDate === todayStr ? `Today (${todayStr})` : selectedDailyDate}
                </h2>
              </div>

              {/* Calendar vs Timeline toggle */}
              <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
                <button
                  onClick={() => setDailyViewMode('calendar')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    dailyViewMode === 'calendar' ? 'bg-primary text-on-primary shadow-xs' : 'text-muted hover:text-text'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  <span>Calendar</span>
                </button>
                <button
                  onClick={() => setDailyViewMode('timeline')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    dailyViewMode === 'timeline' ? 'bg-primary text-on-primary shadow-xs' : 'text-muted hover:text-text'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">view_timeline</span>
                  <span>Timeline</span>
                </button>
              </div>
            </div>

            {/* Quick-Prompt Chips: What I learned today, What I'm stuck on, Plan for tomorrow */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <span className="text-xs font-semibold text-muted">Quick Prompts:</span>
              {[
                'What I learned today',
                "What I'm stuck on",
                'Plan for tomorrow'
              ].map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => dailyEditorRef.current?.insertHeading(promptText)}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-2 border border-border text-text hover:bg-primary-tint hover:text-primary-text transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm text-primary">add_circle</span>
                  <span>{promptText}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Calendar View vs Timeline View */}
          {dailyViewMode === 'calendar' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Interactive Month Calendar */}
              <div className="lg:col-span-5 bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow space-y-4">
                {/* Month Navigation */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const m = new Date(calendarMonth);
                        m.setMonth(m.getMonth() - 1);
                        setCalendarMonth(m);
                      }}
                      className="p-1 text-muted hover:text-text rounded-lg hover:bg-surface-2 cursor-pointer"
                      title="Previous month"
                      aria-label="Previous month"
                    >
                      <span className="material-symbols-outlined text-base">chevron_left</span>
                    </button>
                    <button
                      onClick={() => setCalendarMonth(new Date())}
                      className="px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary-tint rounded-lg cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => {
                        const m = new Date(calendarMonth);
                        m.setMonth(m.getMonth() + 1);
                        setCalendarMonth(m);
                      }}
                      className="p-1 text-muted hover:text-text rounded-lg hover:bg-surface-2 cursor-pointer"
                      title="Next month"
                      aria-label="Next month"
                    >
                      <span className="material-symbols-outlined text-base">chevron_right</span>
                    </button>
                  </div>
                </div>

                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => (
                    <div key={i} className="py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar Days Matrix */}
                <div className="grid grid-cols-7 gap-1" role="grid">
                  {calendarDays.map((item, idx) => {
                    const isDisabled = item.isFuture;
                    return (
                      <button
                        key={idx}
                        disabled={isDisabled}
                        onClick={() => setSelectedDailyDate(item.dateStr)}
                        className={`h-9 rounded-xl flex flex-col items-center justify-center relative text-xs font-semibold transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                          isDisabled
                            ? 'opacity-30 cursor-not-allowed text-muted'
                            : item.isSelected
                              ? 'bg-primary-tint text-primary-text font-bold shadow-xs'
                              : item.isCurrentMonth
                                ? 'text-text hover:bg-surface-2'
                                : 'text-muted/60 hover:bg-surface-2'
                        } ${item.isToday ? 'ring-2 ring-accent' : ''}`}
                      >
                        <span>{item.dayNumber}</span>
                        {/* Dot on days with notes */}
                        {item.hasNote && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary absolute bottom-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span>Has note</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-accent" />
                    <span>Today</span>
                  </div>
                </div>

                {/* This Week Notes Section */}
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-text">This Week ({thisWeekNotes.length} notes)</h4>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleCopyThisWeekMarkdown}
                        disabled={thisWeekNotes.length === 0}
                        className="px-2 py-0.5 text-[10px] font-bold rounded bg-surface-2 text-text hover:bg-primary-tint hover:text-primary-text cursor-pointer disabled:opacity-40"
                        title="Copy as Markdown"
                      >
                        Copy .MD
                      </button>
                      <button
                        onClick={handleDownloadThisWeekMarkdown}
                        disabled={thisWeekNotes.length === 0}
                        className="px-2 py-0.5 text-[10px] font-bold rounded bg-surface-2 text-text hover:bg-primary-tint hover:text-primary-text cursor-pointer disabled:opacity-40"
                        title="Download .md"
                      >
                        Download .md
                      </button>
                    </div>
                  </div>
                  {thisWeekNotes.length === 0 ? (
                    <p className="text-[11px] text-muted">No notes recorded yet this week.</p>
                  ) : (
                    <div className="space-y-1">
                      {thisWeekNotes.map(n => (
                        <div
                          key={n.id}
                          onClick={() => setSelectedDailyDate(n.date)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                            selectedDailyDate === n.date ? 'bg-primary-tint text-primary-text font-bold' : 'hover:bg-surface-2 text-text'
                          }`}
                        >
                          <span className="truncate">{n.title || 'Daily Note'}</span>
                          <span className="text-[10px] text-muted shrink-0 ml-2">{n.date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Shared Editor for selected day */}
              <div className="lg:col-span-7 bg-surface border border-border rounded-2xl shadow overflow-hidden flex flex-col min-h-[500px]">
                <NoteEditor
                  ref={dailyEditorRef}
                  key={`daily-${selectedDailyDate}`}
                  initialNote={activeDailyNote}
                  noteType="daily"
                  defaultDate={selectedDailyDate}
                  currentUserId={currentUser?.id}
                  onSaveSuccess={handleSaveSuccess}
                  onDeleteSuccess={() => {
                    handleDeleteSuccess();
                  }}
                />
              </div>
            </div>
          ) : (
            /* Timeline View */
            <div className="space-y-4">
              {/* Filters for Timeline: Date range, tag */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-surface border border-border rounded-2xl text-xs">
                <span className="material-symbols-outlined text-muted text-base">filter_list</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted">From:</span>
                  <input
                    type="date"
                    value={dateRangeFrom}
                    onChange={e => setDateRangeFrom(e.target.value)}
                    className="bg-surface-2 text-text border border-border rounded-lg px-2 py-1 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted">To:</span>
                  <input
                    type="date"
                    value={dateRangeTo}
                    onChange={e => setDateRangeTo(e.target.value)}
                    className="bg-surface-2 text-text border border-border rounded-lg px-2 py-1 text-xs"
                  />
                </div>
                {(dateRangeFrom || dateRangeTo) && (
                  <button
                    onClick={() => { setDateRangeFrom(''); setDateRangeTo(''); }}
                    className="text-primary font-bold hover:underline cursor-pointer ml-auto"
                  >
                    Clear Dates
                  </button>
                )}
              </div>

              {Object.keys(timelineGroupedByWeek.groups).length === 0 ? (
                <div className="border border-dashed border-border rounded-2xl p-12 text-center bg-surface space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-2 text-primary flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-2xl">history_edu</span>
                  </div>
                  <h3 className="text-sm font-bold text-text">No daily notes in this period</h3>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    Start your learning journal. Write your first note for today.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedDailyDate(todayStr);
                      setDailyViewMode('calendar');
                    }}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
                  >
                    Write today's note
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(timelineGroupedByWeek.groups).map(([weekLabel, weekNotesList], wIdx) => (
                    <div key={wIdx} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted uppercase tracking-wider">{weekLabel}</span>
                        <div className="flex-1 h-[1px] bg-border" />
                      </div>

                      <div className="space-y-2.5">
                        {weekNotesList.map(n => (
                          <div
                            key={n.id}
                            onClick={() => {
                              setSelectedDailyDate(n.date);
                              setDailyViewMode('calendar');
                            }}
                            className="bg-surface border border-border rounded-xl p-3.5 shadow-sm hover:border-primary transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-primary-tint text-primary-text font-bold text-xs flex flex-col items-center justify-center shrink-0">
                                <span className="text-[10px] uppercase">{new Date(n.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                <span className="text-sm leading-none">{new Date(n.date + 'T00:00:00').getDate()}</span>
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-text group-hover:text-primary transition-colors truncate">
                                  {n.title || 'Daily Note'}
                                </h4>
                                <p className="text-xs text-muted truncate mt-0.5">
                                  {getPlainTextPreview(n.content)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {Array.isArray(n.tags) && n.tags.map((t: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded-full bg-primary-tint text-primary-text font-semibold text-[10px]">
                                  #{t}
                                </span>
                              ))}
                              {Array.isArray(n.attachments) && n.attachments.length > 0 && (
                                <span className="material-symbols-outlined text-muted text-base">attach_file</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {timelineGroupedByWeek.hasMore && (
                    <div className="text-center pt-2">
                      <button
                        onClick={() => setTimelineVisibleCount(prev => prev + 10)}
                        className="px-4 py-2 bg-surface border border-border text-text hover:bg-surface-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
                      >
                        Load More
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Editor Modal for All Notes */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-3xl h-[90vh] max-h-[800px] flex flex-col overflow-hidden">
            <NoteEditor
              isModal
              initialNote={selectedNote}
              noteType={editorNoteType}
              defaultDate={editorDefaultDate}
              sessions={sessions}
              currentUserId={currentUser?.id}
              onClose={() => setIsEditorOpen(false)}
              onSaveSuccess={saved => {
                handleSaveSuccess(saved);
              }}
              onDeleteSuccess={() => {
                handleDeleteSuccess();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
