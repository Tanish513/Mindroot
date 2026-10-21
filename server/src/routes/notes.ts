import express from 'express';
import multer from 'multer';
import sanitizeHtml from 'sanitize-html';
const archiver = require('archiver');
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';

export function createNotesRouter(options: {
  prisma: any;
  inMemoryNotes: any[];
  inMemorySessions: any[];
  inMemoryUsers: any[];
  saveDb: () => void;
  io: any;
  requireAuth: any;
  COUNT_DAILY_NOTE_FOR_STREAK: boolean;
  recordUserActivity: (userId: string, activityType: 'session' | 'discussion' | 'login') => Promise<any>;
}) {
  const {
    prisma,
    inMemoryNotes,
    inMemorySessions,
    inMemoryUsers,
    saveDb,
    io,
    requireAuth,
    COUNT_DAILY_NOTE_FOR_STREAK,
    recordUserActivity
  } = options;

  const router = express.Router();

  // Helper to emit note events strictly to author and shared recipient (never globally)
  const emitNoteEvent = (event: string, note: any) => {
    if (!io || !note) return;
    if (note.authorId) {
      io.to('user:' + note.authorId).emit(event, note);
    }
    if (note.visibility === 'shared' && note.sharedWithUserId && note.sharedWithUserId !== note.authorId) {
      io.to('user:' + note.sharedWithUserId).emit(event, note);
    }
  };

  const emitNoteDeleted = (note: any) => {
    if (!io || !note) return;
    if (note.authorId) {
      io.to('user:' + note.authorId).emit('note-deleted', { id: note.id });
    }
    if (note.visibility === 'shared' && note.sharedWithUserId && note.sharedWithUserId !== note.authorId) {
      io.to('user:' + note.sharedWithUserId).emit('note-deleted', { id: note.id });
    }
  };


  // Storage directory for uploads
  const uploadDir = path.join(__dirname, '../../uploads/notes');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Multer config for attachments
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeRandom = crypto.randomBytes(16).toString('hex');
      cb(null, `${Date.now()}-${safeRandom}${ext}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5 MB max
    },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
      const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
      const ext = path.extname(file.originalname).toLowerCase();

      if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PNG, JPG, WEBP and PDF files up to 5 MB are allowed.'));
      }
    }
  });

  // HTML sanitization rules
  const sanitizeOptions = {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'p', 'a', 'ul', 'ol', 'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
      'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'span'
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      span: ['class', 'style'],
      code: ['class'],
      pre: ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto']
  };

  const sanitizeContent = (raw: string): string => {
    if (!raw) return '';
    return sanitizeHtml(raw, sanitizeOptions);
  };

  // Helper: compute today's date in user's timezone (default Asia/Kolkata)
  const getUserTodayDateStr = (tz?: string): string => {
    const timeZone = tz || 'Asia/Kolkata';
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
      return formatter.format(now); // Output format: YYYY-MM-DD
    } catch {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
      return formatter.format(now);
    }
  };

  // Helper: check if content is effectively empty
  const isContentEmpty = (title: string, content: string): boolean => {
    const cleanTitle = (title || '').trim();
    const cleanContent = (content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return cleanTitle.length === 0 && cleanContent.length === 0;
  };

  // Helper: find session by ID
  const findSession = (sessionId?: string | null) => {
    if (!sessionId) return null;
    return inMemorySessions.find(s => s.id === sessionId) || null;
  };

  // POST /api/notes/upload - upload attachment (Max 5 files, 5MB each)
  router.post('/upload', requireAuth, (req: any, res: any) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds the 5 MB limit.' });
        }
        return res.status(400).json({ error: err.message || 'File upload failed.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided.' });
      }

      const fileUrl = `/uploads/notes/${req.file.filename}`;
      return res.json({
        name: req.file.originalname,
        url: fileUrl,
        type: req.file.mimetype,
        size: req.file.size
      });
    });
  });

  // GET /api/notes - list notes with permission filters
  router.get('/', requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.userId;
      const { type, sessionId, filter, tag, search, dateFrom, dateTo } = req.query;

      let notes = inMemoryNotes.filter(n => {
        // Permission rule: user can read their own notes OR notes shared with them
        const isAuthor = n.authorId === userId;
        const isSharedWithMe = n.visibility === 'shared' && n.sharedWithUserId === userId;
        return isAuthor || isSharedWithMe;
      });

      // Filter by type
      if (type && typeof type === 'string') {
        notes = notes.filter(n => n.type === type);
      }

      // Filter by sessionId
      if (sessionId && typeof sessionId === 'string') {
        notes = notes.filter(n => n.sessionId === sessionId);
      }

      // Filter chips: 'all' | 'my' | 'shared' | 'by_session'
      if (filter === 'my') {
        notes = notes.filter(n => n.authorId === userId);
      } else if (filter === 'shared') {
        notes = notes.filter(n => n.visibility === 'shared' && n.sharedWithUserId === userId);
      } else if (filter === 'by_session') {
        notes = notes.filter(n => Boolean(n.sessionId));
      }

      // Filter by tag
      if (tag && typeof tag === 'string') {
        const queryTag = tag.trim().toLowerCase();
        notes = notes.filter(n => Array.isArray(n.tags) && n.tags.some((t: string) => t.toLowerCase() === queryTag));
      }

      // Date range filter (for daily notes or createdAt)
      if (dateFrom && typeof dateFrom === 'string') {
        notes = notes.filter(n => {
          const noteDate = n.date || (n.createdAt ? n.createdAt.slice(0, 10) : '');
          return noteDate >= dateFrom;
        });
      }
      if (dateTo && typeof dateTo === 'string') {
        notes = notes.filter(n => {
          const noteDate = n.date || (n.createdAt ? n.createdAt.slice(0, 10) : '');
          return noteDate <= dateTo;
        });
      }

      // Search (title, content, tags)
      if (search && typeof search === 'string') {
        const q = search.trim().toLowerCase();
        notes = notes.filter(n => {
          const titleMatch = (n.title || '').toLowerCase().includes(q);
          const plainContent = (n.content || '').replace(/<[^>]*>/g, ' ').toLowerCase();
          const contentMatch = plainContent.includes(q);
          const tagMatch = Array.isArray(n.tags) && n.tags.some((t: string) => t.toLowerCase().includes(q));
          return titleMatch || contentMatch || tagMatch;
        });
      }

      // Populate author and session info
      const enrichedNotes = notes.map(n => {
        const author = inMemoryUsers.find(u => u.id === n.authorId);
        const session = n.sessionId ? inMemorySessions.find(s => s.id === n.sessionId) : null;
        const sharedUser = n.sharedWithUserId ? inMemoryUsers.find(u => u.id === n.sharedWithUserId) : null;
        return {
          ...n,
          authorName: author?.name || 'Unknown',
          authorAvatar: author?.avatar || null,
          authorRole: author?.role || 'student',
          sessionTitle: session?.title || null,
          sharedWithUserName: sharedUser?.name || null
        };
      });

      // Sort reverse chronological
      enrichedNotes.sort((a, b) => {
        const dateA = a.date || a.updatedAt || a.createdAt;
        const dateB = b.date || b.updatedAt || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      return res.json(enrichedNotes);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to fetch notes' });
    }
  });

  // GET /api/notes/daily/today - get or check today's note
  router.get('/daily/today', requireAuth, (req: any, res: any) => {
    try {
      const userId = req.userId;
      const tz = (req.query.tz as string) || 'Asia/Kolkata';
      const todayStr = getUserTodayDateStr(tz);

      const note = inMemoryNotes.find(n => n.authorId === userId && n.type === 'daily' && n.date === todayStr);
      return res.json({ todayDate: todayStr, note: note || null });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to fetch today note' });
    }
  });

  // GET /api/notes/daily/streak - get daily note streak
  router.get('/daily/streak', requireAuth, (req: any, res: any) => {
    try {
      const userId = req.userId;
      const tz = (req.query.tz as string) || 'Asia/Kolkata';
      const todayStr = getUserTodayDateStr(tz);

      // Find all daily notes by this user
      const dailyDates = new Set(
        inMemoryNotes
          .filter(n => n.authorId === userId && n.type === 'daily' && n.date)
          .map(n => n.date)
      );

      let noteStreak = 0;
      let checkDate = new Date();
      // Adjust checkDate to target timezone
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
      let currentCheckStr = formatter.format(checkDate);

      // If user wrote note today, streak starts with today; else check yesterday
      if (dailyDates.has(currentCheckStr)) {
        noteStreak++;
        while (true) {
          checkDate.setDate(checkDate.getDate() - 1);
          currentCheckStr = formatter.format(checkDate);
          if (dailyDates.has(currentCheckStr)) {
            noteStreak++;
          } else {
            break;
          }
        }
      } else {
        // Check if yesterday had note
        checkDate.setDate(checkDate.getDate() - 1);
        currentCheckStr = formatter.format(checkDate);
        if (dailyDates.has(currentCheckStr)) {
          noteStreak++;
          while (true) {
            checkDate.setDate(checkDate.getDate() - 1);
            currentCheckStr = formatter.format(checkDate);
            if (dailyDates.has(currentCheckStr)) {
              noteStreak++;
            } else {
              break;
            }
          }
        }
      }

      return res.json({ noteStreak, todayDate: todayStr, hasTodayNote: dailyDates.has(todayStr) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to calculate streak' });
    }
  });

  // GET /api/notes/tags - get existing tags for the current user (autocomplete)
  router.get('/tags', requireAuth, (req: any, res: any) => {
    try {
      const userId = req.userId;
      const tagSet = new Set<string>();

      inMemoryNotes
        .filter(n => n.authorId === userId && Array.isArray(n.tags))
        .forEach(n => {
          n.tags.forEach((t: string) => {
            if (t && typeof t === 'string' && t.trim()) {
              tagSet.add(t.trim());
            }
          });
        });

      return res.json(Array.from(tagSet).sort());
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to fetch tags' });
    }
  });

  // GET /api/notes/export/zip - export all daily notes as a .zip or single .md
  router.get('/export/all', requireAuth, (req: any, res: any) => {
    try {
      const userId = req.userId;
      const format = req.query.format === 'md' ? 'md' : 'zip';
      const notes = inMemoryNotes.filter(n => n.authorId === userId && n.type === 'daily');

      notes.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      if (format === 'md') {
        let fullMarkdown = `# My Daily Learning Journal\n\nExported on ${new Date().toISOString()}\n\n---\n\n`;
        notes.forEach(n => {
          fullMarkdown += `## ${n.date || 'Undated'} - ${n.title || 'Daily Note'}\n\n`;
          if (Array.isArray(n.tags) && n.tags.length > 0) {
            fullMarkdown += `**Tags:** ${n.tags.join(', ')}\n\n`;
          }
          const plainText = (n.content || '')
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<br\s*[\/]?>/gi, '\n')
            .replace(/<[^>]+>/g, '');
          fullMarkdown += `${plainText}\n\n---\n\n`;
        });

        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="mindroot-daily-notes.md"');
        return res.send(fullMarkdown);
      }

      // Export as zip
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="mindroot-daily-notes.zip"');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      notes.forEach(n => {
        const filename = `${n.date || 'note'}-${(n.title || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
        let md = `# ${n.title || 'Daily Note'}\n\nDate: ${n.date || 'N/A'}\n`;
        if (Array.isArray(n.tags) && n.tags.length > 0) {
          md += `Tags: ${n.tags.join(', ')}\n`;
        }
        md += `\n---\n\n`;
        const plainText = (n.content || '')
          .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
          .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
          .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
          .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
          .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
          .replace(/<br\s*[\/]?>/gi, '\n')
          .replace(/<[^>]+>/g, '');
        md += plainText;
        archive.append(md, { name: filename });
      });

      archive.finalize();
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Export failed' });
    }
  });

  // GET /api/notes/:id - get single note by id
  router.get('/:id', requireAuth, (req: any, res: any) => {
    try {
      const userId = req.userId;
      const note = inMemoryNotes.find(n => n.id === req.params.id);

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Check permission: author or shared recipient
      const isAuthor = note.authorId === userId;
      const isSharedWithMe = note.visibility === 'shared' && note.sharedWithUserId === userId;

      if (!isAuthor && !isSharedWithMe) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to view this note.' });
      }

      const author = inMemoryUsers.find(u => u.id === note.authorId);
      const session = note.sessionId ? inMemorySessions.find(s => s.id === note.sessionId) : null;

      return res.json({
        ...note,
        authorName: author?.name || 'Unknown',
        authorAvatar: author?.avatar || null,
        sessionTitle: session?.title || null
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to fetch note' });
    }
  });

  // POST /api/notes - create or upsert note
  router.post('/', requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.userId;
      const {
        type = 'regular',
        date,
        sessionId,
        title = '',
        content = '',
        tags = [],
        attachments = [],
        visibility = 'private',
        tz = 'Asia/Kolkata'
      } = req.body;

      // Validate Note Type
      if (type !== 'regular' && type !== 'daily') {
        return res.status(400).json({ error: 'Invalid note type. Must be "regular" or "daily".' });
      }

      // Daily notes constraints
      let noteDate: string | null = null;
      if (type === 'daily') {
        // Daily notes are always private and cannot be linked to a session
        const todayStr = getUserTodayDateStr(tz);
        noteDate = date ? String(date).slice(0, 10) : todayStr;

        // Disallow future days
        if (noteDate > todayStr) {
          return res.status(400).json({ error: 'Cannot create notes for future dates.' });
        }

        // Lazy creation: don't create empty daily notes
        if (isContentEmpty(title, content)) {
          // If empty, delete if one existed for this date
          const existingIdx = inMemoryNotes.findIndex(n => n.authorId === userId && n.type === 'daily' && n.date === noteDate);
          if (existingIdx >= 0) {
            inMemoryNotes.splice(existingIdx, 1);
            saveDb();
            if (prisma) {
              prisma.note.deleteMany({ where: { authorId: userId, date: noteDate } }).catch(() => {});
            }
          }
          return res.json({ success: true, deleted: true, message: 'Empty daily note not saved.' });
        }
      }

      // Check Session and Sharing Permissions
      let resolvedVisibility = 'private';
      let resolvedSharedWithUserId: string | null = null;
      let resolvedSessionId: string | null = null;

      if (type === 'regular' && sessionId) {
        const session = findSession(sessionId);
        if (session) {
          resolvedSessionId = session.id;
          const isMentor = session.teacherId === userId || session.teacher?.id === userId;
          const isStudent = session.studentId === userId || session.student?.id === userId ||
            (Array.isArray(session.students) && session.students.some((st: any) => (st.id || st) === userId));

          if (!isMentor && !isStudent) {
            return res.status(403).json({ error: 'You are not a participant in this session.' });
          }

          if (visibility === 'shared') {
            // Only the mentor can share, and only with the student
            if (!isMentor) {
              return res.status(403).json({ error: 'Only the session mentor can share notes with the student.' });
            }
            resolvedVisibility = 'shared';
            resolvedSharedWithUserId = session.studentId || session.student?.id || (Array.isArray(session.students) && session.students[0]?.id) || null;
          }
        }
      }

      // Sanitize rich text content and title
      const sanitizedContent = sanitizeContent(content);
      const cleanTitle = (title || '').trim().slice(0, 200);

      // Clean tags (max 10 tags, strings trimmed)
      const cleanTags: string[] = Array.isArray(tags)
        ? tags
            .filter(t => typeof t === 'string' && t.trim().length > 0)
            .map(t => t.trim().slice(0, 30))
            .slice(0, 10)
        : [];

      // Validate attachments (max 5, size <= 5MB)
      const cleanAttachments = Array.isArray(attachments)
        ? attachments.slice(0, 5).filter(a => a && a.url && a.name)
        : [];

      const now = new Date();

      // Check unique constraint: (authorId, date) for daily notes
      if (type === 'daily' && noteDate) {
        const existingNote = inMemoryNotes.find(n => n.authorId === userId && n.type === 'daily' && n.date === noteDate);
        if (existingNote) {
          // Update existing daily note for this date
          existingNote.title = cleanTitle;
          existingNote.content = sanitizedContent;
          existingNote.tags = cleanTags;
          existingNote.attachments = cleanAttachments;
          existingNote.updatedAt = now.toISOString();

          saveDb();

          if (prisma) {
            prisma.note.update({
              where: { id: existingNote.id },
              data: {
                title: cleanTitle,
                content: sanitizedContent,
                tags: cleanTags,
                attachments: cleanAttachments,
                updatedAt: now
              }
            }).catch((err: any) => console.warn('Prisma daily note update skipped:', err.message));
          }

          if (COUNT_DAILY_NOTE_FOR_STREAK) {
            await recordUserActivity(userId, 'session');
          }

          emitNoteEvent('note-updated', existingNote);
          return res.json(existingNote);
        }
      }

      // Create new Note
      const newNote = {
        id: 'note-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
        authorId: userId,
        type,
        date: type === 'daily' ? noteDate : null,
        sessionId: resolvedSessionId,
        title: cleanTitle,
        content: sanitizedContent,
        tags: cleanTags,
        attachments: cleanAttachments,
        visibility: resolvedVisibility,
        sharedWithUserId: resolvedSharedWithUserId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      inMemoryNotes.push(newNote);
      saveDb();

      if (prisma) {
        prisma.note.create({
          data: {
            id: newNote.id,
            authorId: newNote.authorId,
            type: newNote.type,
            date: newNote.date,
            sessionId: newNote.sessionId,
            title: newNote.title,
            content: newNote.content,
            tags: newNote.tags,
            attachments: newNote.attachments,
            visibility: newNote.visibility,
            sharedWithUserId: newNote.sharedWithUserId,
            createdAt: now,
            updatedAt: now
          }
        }).catch((err: any) => console.warn('Prisma note creation skipped:', err.message));
      }

      if (type === 'daily' && COUNT_DAILY_NOTE_FOR_STREAK) {
        await recordUserActivity(userId, 'session');
      }

      emitNoteEvent('note-created', newNote);
      return res.status(201).json(newNote);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to save note' });
    }
  });

  // PUT /api/notes/:id - update existing note
  router.put('/:id', requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.userId;
      const note = inMemoryNotes.find(n => n.id === req.params.id);

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Rule: Private notes and author notes are editable ONLY by the author.
      // Shared recipients get strictly read-only access.
      if (note.authorId !== userId) {
        return res.status(403).json({ error: 'Forbidden: You cannot edit notes written by others.' });
      }

      const {
        title,
        content,
        tags,
        attachments,
        visibility,
        sessionId
      } = req.body;

      // Handle daily note deletion if cleared
      if (note.type === 'daily' && isContentEmpty(title ?? note.title, content ?? note.content)) {
        const idx = inMemoryNotes.indexOf(note);
        if (idx >= 0) inMemoryNotes.splice(idx, 1);
        saveDb();
        if (prisma) {
          prisma.note.delete({ where: { id: note.id } }).catch(() => {});
        }
        emitNoteDeleted(note);
        return res.json({ success: true, deleted: true, message: 'Cleared daily note removed.' });
      }

      if (title !== undefined) note.title = (title || '').trim().slice(0, 200);
      if (content !== undefined) note.content = sanitizeContent(content);
      if (Array.isArray(tags)) {
        note.tags = tags
          .filter(t => typeof t === 'string' && t.trim().length > 0)
          .map(t => t.trim().slice(0, 30))
          .slice(0, 10);
      }
      if (Array.isArray(attachments)) {
        note.attachments = attachments.slice(0, 5).filter(a => a && a.url && a.name);
      }

      // Session linkage and sharing rules (regular notes only)
      if (note.type === 'regular') {
        const targetSessionId = sessionId !== undefined ? sessionId : note.sessionId;
        if (targetSessionId) {
          const session = findSession(targetSessionId);
          if (session) {
            note.sessionId = session.id;
            const isMentor = session.teacherId === userId || session.teacher?.id === userId;
            const isStudent = session.studentId === userId || session.student?.id === userId;

            if (visibility === 'shared') {
              if (!isMentor) {
                return res.status(403).json({ error: 'Only the session mentor can share notes with the student.' });
              }
              note.visibility = 'shared';
              note.sharedWithUserId = session.studentId || session.student?.id || null;
            } else if (visibility === 'private') {
              note.visibility = 'private';
              note.sharedWithUserId = null;
            }
          }
        } else {
          note.sessionId = null;
          note.visibility = 'private';
          note.sharedWithUserId = null;
        }
      }

      note.updatedAt = new Date().toISOString();
      saveDb();

      if (prisma) {
        prisma.note.update({
          where: { id: note.id },
          data: {
            title: note.title,
            content: note.content,
            tags: note.tags,
            attachments: note.attachments,
            visibility: note.visibility,
            sharedWithUserId: note.sharedWithUserId,
            sessionId: note.sessionId,
            updatedAt: new Date(note.updatedAt)
          }
        }).catch((err: any) => console.warn('Prisma note update skipped:', err.message));
      }

      emitNoteEvent('note-updated', note);
      return res.json(note);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to update note' });
    }
  });

  // DELETE /api/notes/:id - delete note
  router.delete('/:id', requireAuth, (req: any, res: any) => {
    try {
      const userId = req.userId;
      const idx = inMemoryNotes.findIndex(n => n.id === req.params.id);

      if (idx === -1) {
        return res.status(404).json({ error: 'Note not found' });
      }

      const note = inMemoryNotes[idx];
      // Only the author can delete a note
      if (note.authorId !== userId) {
        return res.status(403).json({ error: 'Forbidden: You can only delete your own notes.' });
      }

      inMemoryNotes.splice(idx, 1);
      saveDb();

      if (prisma) {
        prisma.note.delete({ where: { id: note.id } }).catch((err: any) => {
          console.warn('Prisma note delete skipped:', err.message);
        });
      }

      emitNoteDeleted(note);
      return res.json({ success: true, message: 'Note deleted successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to delete note' });
    }
  });

  // POST /api/notes/:id/save-copy - student can "Save a copy" of a shared note
  router.post('/:id/save-copy', requireAuth, (req: any, res: any) => {
    try {
      const userId = req.userId;
      const original = inMemoryNotes.find(n => n.id === req.params.id);

      if (!original) {
        return res.status(404).json({ error: 'Original note not found' });
      }

      // Check that this note is indeed shared with this user or authored by them
      const isSharedWithMe = original.visibility === 'shared' && original.sharedWithUserId === userId;
      if (!isSharedWithMe && original.authorId !== userId) {
        return res.status(403).json({ error: 'Forbidden: You cannot copy an unshared private note.' });
      }

      const now = new Date();
      const copiedNote = {
        id: 'note-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
        authorId: userId,
        type: 'regular',
        date: null,
        sessionId: original.sessionId,
        title: `${original.title || 'Note'} (Copy)`,
        content: original.content,
        tags: Array.isArray(original.tags) ? [...original.tags] : [],
        attachments: Array.isArray(original.attachments) ? [...original.attachments] : [],
        visibility: 'private',
        sharedWithUserId: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      inMemoryNotes.push(copiedNote);
      saveDb();

      if (prisma) {
        prisma.note.create({
          data: {
            id: copiedNote.id,
            authorId: copiedNote.authorId,
            type: copiedNote.type,
            date: copiedNote.date,
            sessionId: copiedNote.sessionId,
            title: copiedNote.title,
            content: copiedNote.content,
            tags: copiedNote.tags,
            attachments: copiedNote.attachments,
            visibility: copiedNote.visibility,
            sharedWithUserId: copiedNote.sharedWithUserId,
            createdAt: now,
            updatedAt: now
          }
        }).catch((err: any) => console.warn('Prisma copy creation skipped:', err.message));
      }

      emitNoteEvent('note-created', copiedNote);
      return res.status(201).json(copiedNote);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to copy note' });
    }
  });

  return router;
}
