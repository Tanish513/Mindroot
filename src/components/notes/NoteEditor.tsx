import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../../lib/api';

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface NoteEditorProps {
  initialNote?: any;
  noteType: 'regular' | 'daily';
  defaultDate?: string;
  defaultSessionId?: string | null;
  sessions?: any[];
  currentUserId?: string;
  onSaveSuccess?: (savedNote: any) => void;
  onDeleteSuccess?: (deletedId: string) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export interface NoteEditorHandle {
  insertHeading: (text: string) => void;
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(({
  initialNote,
  noteType,
  defaultDate,
  defaultSessionId,
  sessions = [],
  currentUserId,
  onSaveSuccess,
  onDeleteSuccess,
  onClose,
  isModal = false
}, ref) => {
  const [title, setTitle] = useState(initialNote?.title || '');
  const [content, setContent] = useState(initialNote?.content || '');
  const [tags, setTags] = useState<string[]>(initialNote?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(initialNote?.sessionId || defaultSessionId || null);
  const [visibility, setVisibility] = useState<'private' | 'shared'>(initialNote?.visibility || 'private');
  const [attachments, setAttachments] = useState<Attachment[]>(initialNote?.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filteredTagSuggestions, setFilteredTagSuggestions] = useState<string[]>([]);

  // Autosave and status tracking
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  const lastSavedRef = useRef<{
    title: string;
    content: string;
    tags: string[];
    sessionId: string | null;
    visibility: 'private' | 'shared';
    attachments: Attachment[];
  }>({
    title: (initialNote?.title || '').trim(),
    content: initialNote?.content || '',
    tags: Array.isArray(initialNote?.tags) ? [...initialNote.tags] : [],
    sessionId: initialNote?.sessionId || defaultSessionId || null,
    visibility: initialNote?.visibility || 'private',
    attachments: Array.isArray(initialNote?.attachments) ? [...initialNote.attachments] : []
  });

  const updateLastSaved = (noteObj: any) => {
    lastSavedRef.current = {
      title: (noteObj?.title || '').trim(),
      content: noteObj?.content || '',
      tags: Array.isArray(noteObj?.tags) ? [...noteObj.tags] : [],
      sessionId: noteObj?.sessionId || defaultSessionId || null,
      visibility: noteObj?.visibility || 'private',
      attachments: Array.isArray(noteObj?.attachments) ? [...noteObj.attachments] : []
    };
  };

  const checkIfDirty = () => {
    const saved = lastSavedRef.current;
    if (title.trim() !== saved.title) return true;
    if (content !== saved.content) return true;
    if (sessionId !== saved.sessionId) return true;
    if (visibility !== saved.visibility) return true;
    if (tags.length !== saved.tags.length || tags.some((t, i) => t !== saved.tags[i])) return true;
    if (attachments.length !== saved.attachments.length) return true;
    return false;
  };

  // Read-only state if shared note where user is not author
  const isReadOnly = Boolean(initialNote?.id && initialNote?.authorId && currentUserId && initialNote.authorId !== currentUserId);

  // Selected session details
  const selectedSession = sessions.find(s => s.id === sessionId);
  const isMentorOfSession = Boolean(selectedSession && currentUserId && (selectedSession.teacherId === currentUserId || selectedSession.teacher?.id === currentUserId || selectedSession.mentorId === currentUserId));
  const studentName = selectedSession?.student?.name || (Array.isArray(selectedSession?.students) && (selectedSession?.students[0]?.name || selectedSession?.students[0])) || 'Student';

  // Expose insertHeading for quick prompts
  useImperativeHandle(ref, () => ({
    insertHeading: (headingText: string) => {
      if (isReadOnly) return;
      const htmlHeading = `<h3><strong>${DOMPurify.sanitize(headingText)}</strong></h3><p><br></p>`;
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertHTML', false, htmlHeading);
        setContent(editorRef.current.innerHTML);
        setHasUnsavedChanges(true);
      } else {
        setContent((prev: string) => `${prev}${htmlHeading}`);
        setHasUnsavedChanges(true);
      }
    }
  }));

  // Fetch available tags for autocomplete
  useEffect(() => {
    api.getNoteTags().then(tagsList => {
      if (Array.isArray(tagsList)) setAvailableTags(tagsList);
    }).catch(() => {});
  }, []);

  // Update tag suggestions as user types
  useEffect(() => {
    if (!tagInput.trim()) {
      setFilteredTagSuggestions([]);
      return;
    }
    const q = tagInput.trim().toLowerCase();
    const suggestions = availableTags.filter(t => t.toLowerCase().includes(q) && !tags.includes(t));
    setFilteredTagSuggestions(suggestions.slice(0, 5));
  }, [tagInput, availableTags, tags]);

  // Sync initial content on note change
  useEffect(() => {
    setTitle(initialNote?.title || '');
    setContent(initialNote?.content || '');
    setTags(initialNote?.tags || []);
    setSessionId(initialNote?.sessionId || defaultSessionId || null);
    setVisibility(initialNote?.visibility || 'private');
    setAttachments(initialNote?.attachments || []);
    updateLastSaved(initialNote);
    setHasUnsavedChanges(false);
    setSaveStatus('idle');
    setErrorMessage(null);

    if (editorRef.current) {
      editorRef.current.innerHTML = initialNote?.content || '';
    }
  }, [initialNote, defaultSessionId]);

  // Autosave setup
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isReadOnly) return;

    const dirty = checkIfDirty();
    setHasUnsavedChanges(dirty);

    if (!dirty) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 3000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [title, content, tags, sessionId, visibility, attachments]);

  // Warn before closing/unloading if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Rich text formatting execution
  const executeCommand = (cmd: string, val: string = '') => {
    if (isReadOnly) return;
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
      setHasUnsavedChanges(true);
    }
  };

  // Add tag
  const handleAddTag = (rawTag: string) => {
    const clean = rawTag.trim().replace(/^#/, '');
    if (!clean) return;
    if (tags.length >= 10) {
      setErrorMessage('Maximum 10 tags allowed per note.');
      return;
    }
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
      setHasUnsavedChanges(true);
    }
    setTagInput('');
    setFilteredTagSuggestions([]);
  };

  const handleRemoveTag = (index: number) => {
    if (isReadOnly) return;
    setTags(tags.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  // File upload handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || isReadOnly) return;
    setUploadError(null);

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    const maxFiles = 5;

    if (attachments.length + files.length > maxFiles) {
      setUploadError(`Maximum ${maxFiles} attachments allowed per note.`);
      return;
    }

    setUploading(true);
    try {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`"${file.name}" has an unsupported format. Only PNG, JPG, WEBP and PDF files are allowed.`);
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`"${file.name}" exceeds the 5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        }
        const uploaded = await api.uploadNoteAttachment(file);
        if (uploaded) {
          newAttachments.push(uploaded);
        }
      }
      setAttachments(prev => [...prev, ...newAttachments]);
      setHasUnsavedChanges(true);
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    if (isReadOnly) return;
    setAttachments(attachments.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  // Save note action
  const handleSave = async () => {
    if (isReadOnly) return;
    setSaveStatus('saving');
    setErrorMessage(null);

    try {
      const sanitizedHtml = DOMPurify.sanitize(content);
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

      const payload = {
        id: initialNote?.id,
        type: noteType,
        date: noteType === 'daily' ? (initialNote?.date || defaultDate) : undefined,
        sessionId: noteType === 'regular' ? sessionId : null,
        title: title.trim(),
        content: sanitizedHtml,
        tags,
        attachments,
        visibility: noteType === 'regular' && isMentorOfSession ? visibility : 'private',
        tz: userTz
      };

      const res = await api.saveNote(payload);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      updateLastSaved(res);

      if (onSaveSuccess && res) {
        onSaveSuccess(res);
      }
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err.message || 'Failed to save note');
    }
  };

  // Delete note action
  const handleDelete = async () => {
    if (!initialNote?.id || isReadOnly) return;
    try {
      await api.deleteNote(initialNote.id);
      setShowDeleteConfirm(false);
      if (onDeleteSuccess) {
        onDeleteSuccess(initialNote.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete note');
    }
  };

  // Save copy action for students viewing shared notes
  const handleSaveCopy = async () => {
    if (!initialNote?.id) return;
    try {
      const copy = await api.saveCopyOfNote(initialNote.id);
      if (onSaveSuccess && copy) {
        onSaveSuccess(copy);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save a copy');
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose?.();
      }
    } else {
      onClose?.();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-surface ${isModal ? 'p-0' : 'p-4 sm:p-6'} overflow-hidden`}>
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary text-xl">
            {noteType === 'daily' ? 'calendar_today' : 'description'}
          </span>
          <span className="text-sm font-bold text-text truncate">
            {isReadOnly ? 'Viewing Shared Note' : (initialNote?.id ? 'Edit Note' : (noteType === 'daily' ? `Daily Note • ${defaultDate || 'Today'}` : 'New Note'))}
          </span>
          {/* Status Badge */}
          {!isReadOnly && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              saveStatus === 'saving'
                ? 'bg-accent-tint text-accent-text'
                : saveStatus === 'saved'
                  ? 'bg-primary-tint text-primary-text'
                  : saveStatus === 'error'
                    ? 'bg-danger/10 text-danger'
                    : 'text-muted'
            }`}>
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'error' && 'Save failed'}
              {saveStatus === 'idle' && (hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved')}
            </span>
          )}
          {isReadOnly && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-accent-tint text-accent-text">
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isReadOnly && (
            <button
              onClick={handleSaveCopy}
              className="px-3 py-1.5 text-xs font-bold bg-primary text-on-primary rounded-xl hover:bg-primary-hover flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              <span>Save a copy</span>
            </button>
          )}

          {!isReadOnly && (
            <>
              {initialNote?.id && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label="Delete note"
                  className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                  title="Delete note"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              )}
              <button
                onClick={() => handleSave()}
                disabled={saveStatus === 'saving'}
                className="px-3.5 py-1.5 text-xs font-bold bg-primary text-on-primary rounded-xl hover:bg-primary-hover transition-all flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                <span>Save</span>
              </button>
            </>
          )}

          {onClose && (
            <button
              onClick={handleClose}
              aria-label="Close note editor"
              className="p-1.5 text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors cursor-pointer ml-1"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-3 px-3 py-2 bg-danger/10 text-danger text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-danger hover:underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Title Field */}
      <div className="mb-3 shrink-0">
        <input
          type="text"
          value={title}
          disabled={isReadOnly}
          onChange={e => setTitle(e.target.value)}
          placeholder={noteType === 'daily' ? `Today's Reflections & Key Takeaways...` : 'Note Title...'}
          className="w-full text-base sm:text-lg font-bold text-text bg-transparent border-b border-border/80 pb-1.5 focus:border-primary focus:outline-hidden placeholder:text-muted/60 disabled:opacity-80"
        />
      </div>

      {/* Session link & Sharing Controls (Regular notes only) */}
      {noteType === 'regular' && (
        <div className="flex flex-wrap items-center gap-3 mb-3 p-2.5 bg-surface-2 rounded-xl text-xs shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="material-symbols-outlined text-muted text-base">link</span>
            <span className="text-muted font-semibold whitespace-nowrap">Link to session:</span>
            <select
              value={sessionId || ''}
              disabled={isReadOnly}
              onChange={e => {
                setSessionId(e.target.value || null);
                if (!e.target.value) setVisibility('private');
              }}
              className="flex-1 bg-surface text-text border border-border rounded-lg px-2.5 py-1 text-xs focus:border-primary focus:outline-hidden"
            >
              <option value="">No Session (Freeform)</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title || 'Untitled Session'} ({s.scheduledAt ? new Date(s.scheduledAt).toLocaleDateString() : 'Scheduled'})
                </option>
              ))}
            </select>
          </div>

          {/* Mentor-only sharing toggle */}
          {sessionId && isMentorOfSession && !isReadOnly && (
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visibility === 'shared'}
                  onChange={e => setVisibility(e.target.checked ? 'shared' : 'private')}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-text">Share with student</span>
              </label>
              <span className="text-muted text-[11px]">
                ({studentName} will be able to read this note)
              </span>
            </div>
          )}

          {visibility === 'shared' && !isMentorOfSession && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-tint text-accent-text font-bold text-[11px]">
              <span className="material-symbols-outlined text-xs">share</span>
              <span>Shared note</span>
            </div>
          )}
        </div>
      )}

      {/* Rich Text Toolbar */}
      {!isReadOnly && (
        <div className="flex flex-wrap items-center gap-1 bg-surface-2 p-1.5 rounded-xl border border-border mb-2.5 shrink-0">
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            className="p-1.5 hover:bg-surface rounded text-text font-bold transition-colors cursor-pointer"
            title="Bold"
          >
            <span className="material-symbols-outlined text-base">format_bold</span>
          </button>
          <button
            type="button"
            onClick={() => executeCommand('italic')}
            className="p-1.5 hover:bg-surface rounded text-text transition-colors cursor-pointer"
            title="Italic"
          >
            <span className="material-symbols-outlined text-base">format_italic</span>
          </button>
          <div className="w-[1px] h-4 bg-border mx-0.5" />
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h2>')}
            className="px-2 py-1 hover:bg-surface rounded text-text font-bold text-xs transition-colors cursor-pointer"
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h3>')}
            className="px-2 py-1 hover:bg-surface rounded text-text font-bold text-xs transition-colors cursor-pointer"
            title="Heading 3"
          >
            H3
          </button>
          <div className="w-[1px] h-4 bg-border mx-0.5" />
          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            className="p-1.5 hover:bg-surface rounded text-text transition-colors cursor-pointer"
            title="Bullet list"
          >
            <span className="material-symbols-outlined text-base">format_list_bulleted</span>
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            className="p-1.5 hover:bg-surface rounded text-text transition-colors cursor-pointer"
            title="Numbered list"
          >
            <span className="material-symbols-outlined text-base">format_list_numbered</span>
          </button>
          <div className="w-[1px] h-4 bg-border mx-0.5" />
          <button
            type="button"
            onClick={() => {
              const url = window.prompt('Enter link URL:');
              if (url) executeCommand('createLink', url);
            }}
            className="p-1.5 hover:bg-surface rounded text-text transition-colors cursor-pointer"
            title="Insert Link"
          >
            <span className="material-symbols-outlined text-base">link</span>
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<pre>')}
            className="p-1.5 hover:bg-surface rounded text-text transition-colors cursor-pointer"
            title="Code block"
          >
            <span className="material-symbols-outlined text-base">code</span>
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar border border-border rounded-xl p-3 bg-surface focus-within:border-primary/60 transition-colors min-h-[220px]">
        {isReadOnly ? (
          <div
            className="prose prose-sm max-w-none text-text text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            onInput={e => {
              setContent((e.target as HTMLElement).innerHTML);
              setHasUnsavedChanges(true);
            }}
            className="outline-hidden text-text text-sm leading-relaxed min-h-full font-sans selection:bg-primary-tint"
            data-placeholder="Write your note here... (Markdown & Rich Text supported)"
          />
        )}
      </div>

      {/* Tags & Attachments Row */}
      <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2.5 shrink-0 text-xs">
        {/* Tags Section */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="material-symbols-outlined text-muted text-base">tag</span>
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-tint text-primary-text font-bold text-xs"
            >
              #{tag}
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(idx)}
                  className="hover:text-danger cursor-pointer"
                  title="Remove tag"
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {!isReadOnly && tags.length < 10 && (
            <div className="relative inline-block">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddTag(tagInput);
                  }
                }}
                placeholder="Add tag (Enter or comma)..."
                className="bg-surface-2 text-text px-2.5 py-1 rounded-full text-xs outline-hidden border border-border focus:border-primary w-40"
              />
              {/* Autocomplete Dropdown */}
              {filteredTagSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-48 bg-surface border border-border rounded-xl shadow-lg z-50 p-1">
                  {filteredTagSuggestions.map((sug, i) => (
                    <div
                      key={i}
                      onClick={() => handleAddTag(sug)}
                      className="px-2.5 py-1 text-xs hover:bg-surface-2 rounded-lg cursor-pointer text-text truncate"
                    >
                      #{sug}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attachments Section */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted text-base">attach_file</span>
              <span className="text-muted font-semibold">Attachments ({attachments.length}/5):</span>
              {uploading && <span className="text-primary font-bold animate-pulse">Uploading...</span>}
            </div>

            {!isReadOnly && attachments.length < 5 && (
              <label className="flex items-center gap-1 text-primary hover:text-primary-hover font-bold cursor-pointer">
                <span className="material-symbols-outlined text-sm">cloud_upload</span>
                <span>Upload (PNG, JPG, WEBP, PDF up to 5MB)</span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={e => handleFileUpload(e.target.files)}
                />
              </label>
            )}
          </div>

          {uploadError && (
            <p className="text-danger text-[11px] font-semibold">{uploadError}</p>
          )}

          {/* Attachment Chips / Thumbnails */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {attachments.map((att, idx) => {
                const isImage = att.type.startsWith('image/');
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-2 border border-border rounded-xl text-xs max-w-xs group"
                  >
                    {isImage ? (
                      <img src={att.url} alt={att.name} className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-accent text-lg">picture_as_pdf</span>
                    )}
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-text hover:text-primary font-medium hover:underline max-w-[140px]"
                      title={att.name}
                    >
                      {att.name}
                    </a>
                    <span className="text-[10px] text-muted whitespace-nowrap">
                      ({(att.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="text-muted hover:text-danger cursor-pointer ml-1"
                        title="Remove file"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-danger font-bold text-sm">
              <span className="material-symbols-outlined">warning</span>
              <span>Confirm Note Deletion</span>
            </div>
            <p className="text-xs text-muted">
              Are you sure you want to permanently delete this note? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-border text-muted hover:text-text cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-danger text-white hover:bg-danger/90 cursor-pointer shadow"
              >
                Delete Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
