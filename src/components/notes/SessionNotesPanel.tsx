import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { NoteEditor } from './NoteEditor';

export interface SessionNotesPanelProps {
  session: any;
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SessionNotesPanel({
  session,
  currentUserId,
  isOpen,
  onClose
}: SessionNotesPanelProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [isInlineAdding, setIsInlineAdding] = useState(false);

  const sessionId = session?.id;

  const loadSessionNotes = () => {
    if (!sessionId) return;
    setLoading(true);
    api.getNotes({ sessionId })
      .then(res => {
        if (Array.isArray(res)) {
          setNotes(res);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen && sessionId) {
      loadSessionNotes();
      setIsInlineAdding(false);
      setSelectedNote(null);
    }
  }, [isOpen, sessionId]);

  if (!isOpen || !session) return null;

  const isMentor = session.teacherId === currentUserId || session.teacher?.id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] max-h-[750px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-surface-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-tint text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <span className="material-symbols-outlined text-xl">description</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-text truncate">
                  Session Notes: {session.title || 'Mentorship Lecture'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-surface text-text font-bold text-[10px] border border-border">
                  {notes.length} note{notes.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-muted truncate">
                {isMentor ? 'You can write private notes or share them with your student.' : 'Your private notes and notes shared by your mentor.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isInlineAdding && !selectedNote && (
              <button
                onClick={() => setIsInlineAdding(true)}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Add Note</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-text rounded-lg hover:bg-surface transition-colors cursor-pointer"
              aria-label="Close session notes panel"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-surface">
          {isInlineAdding || selectedNote ? (
            <div className="h-full flex flex-col">
              <div className="mb-2">
                <button
                  onClick={() => {
                    setIsInlineAdding(false);
                    setSelectedNote(null);
                  }}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Back to Session Notes list</span>
                </button>
              </div>
              <div className="flex-1 border border-border rounded-xl overflow-hidden">
                <NoteEditor
                  initialNote={selectedNote}
                  noteType="regular"
                  defaultSessionId={sessionId}
                  sessions={[session]}
                  currentUserId={currentUserId}
                  onClose={() => {
                    setIsInlineAdding(false);
                    setSelectedNote(null);
                  }}
                  onSaveSuccess={() => {
                    loadSessionNotes();
                    setIsInlineAdding(false);
                    setSelectedNote(null);
                  }}
                  onDeleteSuccess={() => {
                    loadSessionNotes();
                    setIsInlineAdding(false);
                    setSelectedNote(null);
                  }}
                />
              </div>
            </div>
          ) : loading ? (
            <div className="py-20 text-center text-xs font-bold text-muted animate-pulse">
              Loading notes for this session...
            </div>
          ) : notes.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-10 text-center bg-surface-2/40 my-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-tint text-primary flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">edit_note</span>
              </div>
              <h4 className="text-sm font-bold text-text">No notes for this session yet</h4>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Capture key formulas, homework questions, action items, or study resources.
              </p>
              <button
                onClick={() => setIsInlineAdding(true)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition-all shadow cursor-pointer inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Add first note</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => {
                const isAuthor = note.authorId === currentUserId;
                const isShared = note.visibility === 'shared';
                const attachCount = Array.isArray(note.attachments) ? note.attachments.length : 0;
                const preview = (note.content || '').replace(/<[^>]*>/g, ' ').slice(0, 140);

                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="p-4 rounded-xl border border-border bg-surface hover:border-primary/50 shadow-xs cursor-pointer transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-text group-hover:text-primary transition-colors">
                          {note.title || 'Untitled Note'}
                        </h4>
                        {isShared && (
                          <span className="px-2 py-0.5 rounded-full bg-accent-tint text-accent-text font-bold text-[10px] flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">share</span>
                            <span>{isAuthor ? 'Shared with student' : 'Shared by Mentor'}</span>
                          </span>
                        )}
                        {!isShared && (
                          <span className="px-2 py-0.5 rounded-full bg-surface-2 text-muted font-bold text-[10px]">
                            Private
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted">
                        {new Date(note.updatedAt || note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                      {preview || 'No content...'}
                    </p>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50 text-muted">
                      <div className="flex items-center gap-1">
                        {Array.isArray(note.tags) && note.tags.map((t: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-primary-tint text-primary-text font-semibold text-[10px]">
                            #{t}
                          </span>
                        ))}
                      </div>

                      {attachCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold">
                          <span className="material-symbols-outlined text-xs">attach_file</span>
                          <span>{attachCount}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
