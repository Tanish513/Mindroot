import { useState, useMemo } from 'react';
import { MobileBookingDrawer } from './MobileBookingDrawer';

interface MobileMarketplaceViewProps {
  teachers: any[];
  onBookSession: (teacher: any, paymentMethod?: string) => void;
  onOpenChat: (teacher: any) => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

const COMMON_TOPICS = [
  'All',
  'React',
  'Python',
  'Data Structures',
  'System Design',
  'UI/UX Design',
  'Calculus',
  'TypeScript',
  'Docker',
];

const getMentorSkills = (m: any): string[] => {
  const skills: string[] = [];
  if (Array.isArray(m.skillsTaught)) {
    m.skillsTaught.forEach((s: any) => {
      const name = typeof s === 'string' ? s : s?.name;
      if (name && !skills.includes(name)) skills.push(name);
    });
  }
  if (Array.isArray(m.userSkills)) {
    m.userSkills.forEach((us: any) => {
      const name = us?.skill?.name;
      if (name && !skills.includes(name)) skills.push(name);
    });
  }
  return skills.length > 0 ? skills : ['Peer Mentoring'];
};

export function MobileMarketplaceView({
  teachers,
  onBookSession,
  onOpenChat,
  selectedCategory = 'All',
  onSelectCategory,
}: MobileMarketplaceViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState(
    selectedCategory === 'All Skills' ? 'All' : selectedCategory
  );
  const [selectedMentorForBooking, setSelectedMentorForBooking] = useState<any | null>(null);

  // Filter mentors based on search and topic
  const filteredMentors = useMemo(() => {
    if (!Array.isArray(teachers)) return [];
    return teachers.filter((m: any) => {
      const q = searchQuery.toLowerCase().trim();
      const skills = getMentorSkills(m);
      const nameMatch = !q || m.name?.toLowerCase().includes(q);
      const skillMatch = !q || skills.some((s: string) => s.toLowerCase().includes(q));
      
      const isAll = activeTopic === 'All' || activeTopic === 'All Skills';
      const topicMatch = isAll || skills.some((s: string) => s.toLowerCase().includes(activeTopic.toLowerCase()));

      return (nameMatch || skillMatch) && topicMatch;
    });
  }, [teachers, searchQuery, activeTopic]);

  const handleTopicClick = (topic: string) => {
    setActiveTopic(topic);
    onSelectCategory?.(topic === 'All' ? 'All Skills' : topic);
  };

  return (
    <div className="flex flex-col w-full pb-8 select-none">
      {/* 1. Header Title & Count */}
      <div className="flex flex-col gap-1 mb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">
            Find a Mentor
          </h1>
          <span className="text-xs font-bold text-primary bg-primary-tint/40 px-2.5 py-0.5 rounded-full border border-primary/20">
            {teachers.length} online
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          High-signal peer mentors available for 1:1 learning and skill barter.
        </p>
      </div>

      {/* 2. Compact Search Input */}
      <div className="relative w-full mb-3">
        <span className="material-symbols-outlined text-lg absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search subjects, mentors, or topics..."
          className="w-full h-11 pl-10 pr-10 bg-surface border border-border text-text placeholder:text-muted rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-primary shadow-xs transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      {/* 3. Horizontal Scrollable Topic Pills */}
      <div className="overflow-x-auto no-scrollbar flex items-center gap-1.5 -mx-4 px-4 mb-4">
        {COMMON_TOPICS.map((topic) => {
          const isActive = activeTopic === topic;
          return (
            <button
              key={topic}
              type="button"
              onClick={() => handleTopicClick(topic)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface border border-border text-muted hover:text-text hover:bg-surface-2'
              }`}
            >
              {topic}
            </button>
          );
        })}
      </div>

      {/* 4. List of Mentor Cards */}
      <div className="flex flex-col gap-3">
        {filteredMentors.length > 0 ? (
          filteredMentors.map((mentor: any) => {
            const skills = getMentorSkills(mentor);
            const rate = mentor.hourlyRate ? `₹${mentor.hourlyRate}/hr` : '1 Token / Free';

            return (
              <div
                key={mentor.id}
                className="bg-surface border border-border rounded-2xl p-4 shadow-xs flex flex-col gap-3 transition-transform active:scale-[0.99]"
              >
                {/* Mentor Top Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={mentor.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80'}
                        alt={mentor.name}
                        className="w-11 h-11 rounded-full object-cover border border-border"
                      />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface"></span>
                    </div>

                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-1">
                        <h2 className="text-sm font-bold text-text truncate">
                          {mentor.name}
                        </h2>
                        <span className="material-symbols-outlined text-[15px] text-primary shrink-0" title="Verified">
                          verified
                        </span>
                      </div>
                      <p className="text-[11px] text-muted truncate">
                        {mentor.bio || 'IIT/NIT Peer Mentor • Algorithms & Systems'}
                      </p>
                    </div>
                  </div>

                  {/* Rating Badge */}
                  <div className="flex items-center gap-1 bg-surface-2 border border-border px-2 py-0.5 rounded-lg shrink-0">
                    <span className="material-symbols-outlined text-xs text-amber-500 fill-1">star</span>
                    <span className="text-xs font-bold text-text">
                      {mentor.trustScore ? Number(mentor.trustScore).toFixed(1) : '4.9'}
                    </span>
                  </div>
                </div>

                {/* Skills Chips */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {skills.slice(0, 3).map((s: string) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-tint/30 text-primary border border-primary/20"
                    >
                      {s}
                    </span>
                  ))}
                  {skills.length > 3 && (
                    <span className="text-[10px] text-muted font-semibold">
                      +{skills.length - 3} more
                    </span>
                  )}
                </div>

                {/* Bottom Actions Row */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Rate</span>
                    <span className="text-xs font-black text-primary">
                      {rate}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenChat(mentor)}
                      className="p-2 rounded-xl border border-border bg-surface hover:bg-surface-2 text-muted hover:text-text transition-all cursor-pointer"
                      title="Direct Chat"
                    >
                      <span className="material-symbols-outlined text-base">chat_bubble</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMentorForBooking(mentor)}
                      className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-hover active:scale-95 shadow-xs transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>Book</span>
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center bg-surface border border-border rounded-2xl flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-3xl text-muted">search_off</span>
            <p className="text-xs font-bold text-text">No mentors found</p>
            <p className="text-[11px] text-muted">Try searching for another topic or skill</p>
          </div>
        )}
      </div>

      {/* Slide-Up Bottom Booking Drawer */}
      <MobileBookingDrawer
        isOpen={Boolean(selectedMentorForBooking)}
        onClose={() => setSelectedMentorForBooking(null)}
        mentor={selectedMentorForBooking}
        onConfirm={(mentor, paymentMode) => {
          setSelectedMentorForBooking(null);
          onBookSession(mentor, paymentMode);
        }}
      />
    </div>
  );
}
