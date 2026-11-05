import { useState } from 'react';
import { Button } from '../ui/Button';

interface TodayNoteCardProps {
  todayNote: any | null;
  noteStreak: number;
  onSaveQuickNote: (content: string) => Promise<void>;
  onOpenDailyNote: () => void;
}

export function TodayNoteCard({
  todayNote,
  noteStreak,
  onSaveQuickNote,
  onOpenDailyNote
}: TodayNoteCardProps) {
  const [noteInput, setNoteInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!noteInput.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveQuickNote(noteInput.trim());
      setNoteInput('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-xs flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">
            note_alt
          </span>
          <h3 className="text-base font-semibold text-text">Today's note</h3>
        </div>
        {noteStreak > 0 && (
          <span className="text-xs font-medium text-muted">
            {noteStreak}-day streak
          </span>
        )}
      </div>

      <div className="min-w-0">
        {todayNote ? (
          <div className="space-y-2">
            <p className="text-[13px] text-muted line-clamp-3 leading-relaxed">
              <span className="text-text font-medium">{todayNote.title || 'Today’s Note'}: </span>
              {(todayNote.content || '').replace(/<[^>]*>/g, ' ').slice(0, 140)}
            </p>
            <button
              type="button"
              onClick={onOpenDailyNote}
              className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Continue writing</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[13px] text-muted">
              Capture quick takeaways or study goals for today.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave();
                }}
                placeholder="Quick thought..."
                className="flex-1 min-w-0 bg-surface text-text border border-border rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-colors"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={!noteInput.trim() || isSaving}
                isLoading={isSaving}
                onClick={handleSave}
                className="text-xs font-medium px-3.5 py-1.5 rounded-lg"
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
