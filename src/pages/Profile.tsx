import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../lib/api';

const PRESET_AVATARS = [
  'https://i.pravatar.cc/150?img=11',
  'https://i.pravatar.cc/150?img=25',
  'https://i.pravatar.cc/150?img=33',
  'https://i.pravatar.cc/150?img=60',
  'https://i.pravatar.cc/150?img=47',
  'https://i.pravatar.cc/150?img=68',
];

export function Profile() {
  const { currentUser, setCurrentUser, role, loginRole, toggleRole } = useAppStore();

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [bio, setBio] = useState(currentUser?.bio || 'Passionate about peer-to-peer knowledge sharing and skill exchanges.');
  const [hourlyRate, setHourlyRate] = useState(currentUser?.hourlyRate || 499);
  const [avatar, setAvatar] = useState(currentUser?.avatar || 'https://i.pravatar.cc/150?img=11');
  
  const [skillsTaught, setSkillsTaught] = useState<string[]>(
    currentUser?.skillsTaught || (currentUser?.userSkills ? currentUser.userSkills.filter((us: any) => us.type === 'teaches').map((us: any) => us.skill?.name) : ['UI Design', 'Figma'])
  );
  
  const [skillsLearned, setSkillsLearned] = useState<string[]>(
    currentUser?.skillsLearned || (currentUser?.userSkills ? currentUser.userSkills.filter((us: any) => us.type === 'wants_to_learn').map((us: any) => us.skill?.name) : ['Python', 'React'])
  );

  const [newTeachSkill, setNewTeachSkill] = useState('');
  const [newLearnSkill, setNewLearnSkill] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setBio(currentUser.bio || 'Passionate about peer-to-peer knowledge sharing and skill exchanges.');
      setHourlyRate(currentUser.hourlyRate || 499);
      setAvatar(currentUser.avatar || 'https://i.pravatar.cc/150?img=11');
      if (currentUser.skillsTaught) setSkillsTaught(currentUser.skillsTaught);
      if (currentUser.skillsLearned) setSkillsLearned(currentUser.skillsLearned);
    }
  }, [currentUser]);

  // Handle local image file uploads (JPEG, PNG, WebP)
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size exceeds 5MB. Please choose a smaller photo.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTeachSkill = () => {
    if (newTeachSkill.trim() && !skillsTaught.includes(newTeachSkill.trim())) {
      setSkillsTaught([...skillsTaught, newTeachSkill.trim()]);
      setNewTeachSkill('');
    }
  };

  const handleRemoveTeachSkill = (skill: string) => {
    setSkillsTaught(skillsTaught.filter(s => s !== skill));
  };

  const handleAddLearnSkill = () => {
    if (newLearnSkill.trim() && !skillsLearned.includes(newLearnSkill.trim())) {
      setSkillsLearned([...skillsLearned, newLearnSkill.trim()]);
      setNewLearnSkill('');
    }
  };

  const handleRemoveLearnSkill = (skill: string) => {
    setSkillsLearned(skillsLearned.filter(s => s !== skill));
  };

  const handleSaveProfile = () => {
    const updatedUser = {
      ...(currentUser || {}),
      id: currentUser?.id || 'user-' + Date.now(),
      name,
      email,
      bio,
      hourlyRate: Number(hourlyRate),
      avatar,
      skillsTaught,
      skillsLearned,
      userSkills: [
        ...skillsTaught.map(t => ({ type: 'teaches', skill: { id: 's-' + t, name: t, category: 'Software & AI' } })),
        ...skillsLearned.map(l => ({ type: 'wants_to_learn', skill: { id: 's-' + l, name: l, category: 'Software & AI' } }))
      ]
    };

    setCurrentUser(updatedUser);
    api.syncNetworkUser(updatedUser);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Only allow mode switching if user registered with 'both' mode
  const canSwitchMode = loginRole === 'both' || currentUser?.role === 'both';
  const userRole = currentUser?.role || role || 'student';
  const trustScore = currentUser?.trustScore || 4.95;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 select-none">
      {/* Top Banner Card */}
      <div className="relative bg-surface-container-high border border-outline-variant rounded-2xl p-6 sm:p-8 text-on-surface shadow-elevation-1 overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar with Click-to-Upload Camera Overlay */}
          <div className="relative group">
            <img 
              src={avatar} 
              alt={name ? `${name}'s profile picture` : 'User profile picture'} 
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-primary/50 shadow-elevation-2 transition-all duration-200 group-hover:brightness-75"
            />
            <label 
              htmlFor="banner-avatar-input"
              className="absolute inset-0 rounded-full flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
              title="Change Profile Picture"
            >
              <span className="material-symbols-outlined text-2xl">photo_camera</span>
              <span className="text-[10px] font-extrabold tracking-wider uppercase mt-0.5">Change</span>
            </label>
            <input 
              id="banner-avatar-input" 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="absolute bottom-2 right-2 w-4 h-4 bg-teaching-emerald rounded-full ring-4 ring-surface" title="Online" />
          </div>

          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-on-surface">{name || 'Peer Learning User'}</h1>
              <span className="px-3 py-1 bg-primary-container border border-primary/20 text-on-primary-container rounded-full text-xs font-bold uppercase tracking-wider">
                {userRole}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${role === 'student' ? 'bg-teaching-emerald-container border-teaching-emerald/20 text-on-teaching-emerald-container' : 'bg-learning-amber-container border-learning-amber/20 text-on-learning-amber-container'}`}>
                <span className="material-symbols-outlined text-sm">{role === 'student' ? 'verified_user' : 'star'}</span>
                {role === 'student' ? `${Math.min(100, Math.round(trustScore * 20))}% Reliability` : `${trustScore} Tutor Rating`}
              </span>
            </div>

            <p className="text-on-surface-variant text-sm max-w-2xl">{bio}</p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-xl text-xs font-semibold text-on-surface">
                <span className="material-symbols-outlined text-teaching-emerald text-base">shield_lock</span>
                <span>Razorpay Active</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-xl text-xs font-semibold text-on-surface">
                <span className="material-symbols-outlined text-teaching-emerald text-base">payments</span>
                <span>₹{hourlyRate || 499}/hr Teaching Rate</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-xl text-xs font-semibold text-on-surface">
                <span className="material-symbols-outlined text-primary text-base">mail</span>
                <span>{email || 'user@mindroot.com'}</span>
              </div>
            </div>
          </div>

          {/* Mode Switcher Button: ONLY displayed if user role is 'both' */}
          {canSwitchMode && (
            <button 
              onClick={toggleRole}
              className="shrink-0 px-4 py-2.5 bg-learning-amber hover:bg-learning-amber-hover text-on-learning-amber rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-elevation-1 transition-all hover:scale-105 active:scale-95"
              title="Switch active perspective between Student and Teacher"
            >
              <span className="material-symbols-outlined text-base">swap_horiz</span>
              Switch View ({role === 'student' ? 'Teacher' : 'Student'})
            </button>
          )}
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="material-symbols-outlined text-teaching-emerald">check_circle</span>
          <span className="text-xs sm:text-sm font-bold">Profile successfully saved and synchronized across all peer devices!</span>
        </div>
      )}

      {/* Grid Layout for Profile Editing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Personal Information & Profile Picture */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-elevation-1 space-y-6">
            <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
              <span className="material-symbols-outlined text-primary text-2xl">person_edit</span>
              <h2 className="text-lg font-black text-on-surface">Personal Profile Details</h2>
            </div>

            {/* Profile Picture Uploader & Selector */}
            <div className="p-4 bg-surface-container-low border border-outline-variant rounded-2xl space-y-4">
              <label className="block text-xs font-extrabold text-on-surface uppercase tracking-wider">
                📸 Profile Picture
              </label>
              
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <img 
                  src={avatar} 
                  alt="Selected Avatar" 
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/50 shadow-elevation-1 shrink-0"
                />

                <div className="space-y-2 text-center sm:text-left flex-1">
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <label 
                      htmlFor="custom-photo-upload"
                      className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-extrabold cursor-pointer transition-colors flex items-center gap-1.5 shadow-elevation-1"
                    >
                      <span className="material-symbols-outlined text-base">upload_file</span>
                      Upload Photo from Device
                    </label>
                    <input 
                      id="custom-photo-upload" 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  <p className="text-[11px] text-on-surface-variant">Supports JPG, PNG, WebP up to 5MB.</p>
                </div>
              </div>

              {/* Preset Avatars Picker */}
              <div className="pt-2 border-t border-outline-variant">
                <span className="block text-[11px] font-bold text-on-surface-variant mb-2">Or select from avatar presets:</span>
                <div className="flex flex-wrap gap-3">
                  {PRESET_AVATARS.map((presetUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatar(presetUrl)}
                      className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all ${
                        avatar === presetUrl ? 'border-primary ring-2 ring-primary/40 scale-110' : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img src={presetUrl} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface"
                  placeholder="Enter email address"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-on-surface mb-1">Bio / Tagline</label>
                <textarea 
                  rows={3} 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface"
                  placeholder="Tell peers about yourself, your background, and learning goals..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Teaching Rate (₹ INR / Hour)</label>
                <input 
                  type="number" 
                  min={50}
                  max={10000}
                  step={50}
                  value={hourlyRate} 
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Avatar Image URL (Optional)</label>
                <input 
                  type="text" 
                  value={avatar} 
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Skills Management Card */}
          <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-elevation-1 space-y-6">
            <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
              <span className="material-symbols-outlined text-teaching-emerald text-2xl">school</span>
              <h2 className="text-lg font-black text-on-surface">Skills Portfolio</h2>
            </div>

            {/* Skills Taught */}
            <div className="space-y-3">
              <label className="block text-xs font-extrabold text-teaching-emerald uppercase tracking-wider">
                🎓 Skills You Teach (Teacher Profile)
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newTeachSkill}
                  onChange={(e) => setNewTeachSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTeachSkill())}
                  placeholder="e.g. React, Python, UI Design..."
                  className="flex-1 px-3.5 py-2 bg-surface-container border border-outline-variant rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-teaching-emerald/20 focus:border-teaching-emerald"
                />
                <button 
                  onClick={handleAddTeachSkill}
                  className="px-4 py-2 bg-teaching-emerald hover:bg-teaching-emerald-hover text-on-teaching-emerald rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span> Add
                </button>
              </div>

              {/* Quick skill add suggestions */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-on-surface-variant">Quick Add:</span>
                {['React', 'TypeScript', 'Python', 'UI Design', 'Figma', 'Node.js', 'Machine Learning'].map(s => (
                  !skillsTaught.includes(s) && (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSkillsTaught([...skillsTaught, s])}
                      className="px-2 py-0.5 bg-surface-container hover:bg-teaching-emerald-container text-on-surface-variant hover:text-on-teaching-emerald-container rounded-md text-[10px] font-bold border border-outline-variant hover:border-teaching-emerald/20 transition-colors flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-[11px]">add</span> {s}
                    </button>
                  )
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {skillsTaught.map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-full text-xs font-bold shadow-elevation-1">
                    <span>{skill}</span>
                    <button onClick={() => handleRemoveTeachSkill(skill)} className="hover:text-alert-rose p-0.5">
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </span>
                ))}
                {skillsTaught.length === 0 && (
                  <p className="text-xs text-on-surface-variant italic">No teaching skills listed yet. Add skills above!</p>
                )}
              </div>
            </div>

            <hr className="border-outline-variant" />

            {/* Skills Desired */}
            <div className="space-y-3">
              <label className="block text-xs font-extrabold text-primary uppercase tracking-wider">
                🚀 Skills You Want to Learn (Student Profile)
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newLearnSkill}
                  onChange={(e) => setNewLearnSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLearnSkill())}
                  placeholder="e.g. Java, Data Structures, Figma..."
                  className="flex-1 px-3.5 py-2 bg-surface-container border border-outline-variant rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button 
                  onClick={handleAddLearnSkill}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span> Add
                </button>
              </div>

              {/* Quick skill add suggestions */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-on-surface-variant">Quick Add:</span>
                {['Java', 'Spring Boot', 'Data Structures', 'Docker', 'AWS', 'Python', 'Solidity'].map(s => (
                  !skillsLearned.includes(s) && (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSkillsLearned([...skillsLearned, s])}
                      className="px-2 py-0.5 bg-surface-container hover:bg-primary-container text-on-surface-variant hover:text-on-primary-container rounded-md text-[10px] font-bold border border-outline-variant hover:border-primary/20 transition-colors flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-[11px]">add</span> {s}
                    </button>
                  )
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {skillsLearned.map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-container border border-primary/20 text-on-primary-container rounded-full text-xs font-bold shadow-elevation-1">
                    <span>{skill}</span>
                    <button onClick={() => handleRemoveLearnSkill(skill)} className="hover:text-alert-rose p-0.5">
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </span>
                ))}
                {skillsLearned.length === 0 && (
                  <p className="text-xs text-on-surface-variant italic">No learning goals listed yet. Add skills above!</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              onClick={handleSaveProfile}
              className="px-8 py-3.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-extrabold shadow-elevation-1 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              Save & Synchronize Profile
            </button>
          </div>
        </div>

        {/* Right Column: Achievements & Activity Summary */}
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-elevation-1 space-y-4">
            <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-learning-amber">workspace_premium</span>
              Peer Badges & Status
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 bg-learning-amber-container border border-learning-amber/20 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-learning-amber text-on-learning-amber flex items-center justify-center font-black">
                  ⭐
                </div>
                <div>
                  <h4 className="text-xs font-bold text-on-learning-amber-container">High-Trust Educator</h4>
                  <p className="text-[11px] text-on-learning-amber-container/80">Maintained {trustScore} rating across peer sessions</p>
                </div>
              </div>

              <div className="p-3.5 bg-primary-container border border-primary/20 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center font-black">
                  ⚡
                </div>
                <div>
                  <h4 className="text-xs font-bold text-on-primary-container">Verified Peer Sync</h4>
                  <p className="text-[11px] text-on-primary-container/80">Connected & synchronized across multi-devices</p>
                </div>
              </div>

              <div className="p-3.5 bg-teaching-emerald-container border border-teaching-emerald/20 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teaching-emerald text-on-teaching-emerald flex items-center justify-center font-black">
                  🎓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-on-teaching-emerald-container">Active Skill Exchanger</h4>
                  <p className="text-[11px] text-on-teaching-emerald-container/80">{skillsTaught.length} teaching skills & {skillsLearned.length} learning goals</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-high border border-outline-variant rounded-2xl p-6 text-on-surface space-y-3 shadow-elevation-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Direct Mentoring Fee</span>
              <span className="material-symbols-outlined text-teaching-emerald">payments</span>
            </div>
            <div className="text-3xl font-black text-teaching-emerald">₹{hourlyRate || 499} / hr</div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Set your custom hourly rate in rupees. Students pay securely via Razorpay (UPI, GPay, Cards) when booking sessions with you.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
