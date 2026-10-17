import { useState } from 'react';

export interface NotesEditorProps {
  notes: string;
  setNotes: (notes: string) => void;
  emitRoomEvent: (event: { type: 'notes'; value: string }) => void;
  onSaveNotes?: (notes: string) => void;
}

export function NotesEditor({
  notes,
  setNotes,
  emitRoomEvent,
  onSaveNotes
}: NotesEditorProps) {
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const wordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  const charCount = notes.length;

  const handleCopy = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onSaveNotes) {
      onSaveNotes(notes);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface p-4 sm:p-6 overflow-hidden text-on-surface">
      <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-3">
        <div className="flex items-center gap-2 text-xs font-extrabold text-on-surface">
          <span className="material-symbols-outlined text-primary text-base">edit_note</span>
          <span>Shared Markdown Notes & Action Items</span>
          <span className="text-[10px] text-on-surface-variant font-bold ml-2">
            {wordCount} words · {charCount} chars
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onSaveNotes && (
            <button
              onClick={handleSave}
              className="px-2.5 py-1 text-xs font-extrabold bg-primary text-on-primary hover:bg-primary-hover rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-elevation-1"
            >
              <span className="material-symbols-outlined text-xs">save</span>
              <span>{savedNotice ? 'Saved!' : 'Save to Session'}</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs font-extrabold bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg flex items-center gap-1 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-xs">content_copy</span>
            <span>{copied ? 'Copied!' : 'Copy Notes'}</span>
          </button>
        </div>
      </div>

      <textarea
        value={notes}
        onChange={event => {
          setNotes(event.target.value);
          emitRoomEvent({ type: 'notes', value: event.target.value });
        }}
        className="flex-1 w-full resize-none font-sans text-sm leading-7 text-on-surface outline-none placeholder:text-neutral-subtle p-2 rounded-xl focus:bg-surface-container-low transition-colors custom-scrollbar bg-surface"
        placeholder="Type shared session notes, formulas, explanations, and action items (supports Markdown)..."
      />
    </div>
  );
}
