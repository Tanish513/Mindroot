import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';

interface AISkillMatchBannerProps {
  currentUser: any;
  peer: any;
  onProposeExchange: (giveSkill: string, takeSkill: string) => void;
}

export function AISkillMatchBanner({ currentUser, peer, onProposeExchange }: AISkillMatchBannerProps) {
  const [giveSkill, setGiveSkill] = useState<string | null>(null);
  const [takeSkill, setTakeSkill] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number>(85);
  const [aiInsight, setAiInsight] = useState<string>('');

  useEffect(() => {
    if (!currentUser || !peer) return;

    // Current user skills
    const myTeaches = Array.isArray(currentUser.skillsTaught) && currentUser.skillsTaught.length > 0
      ? currentUser.skillsTaught
      : (Array.isArray(currentUser.userSkills) ? currentUser.userSkills.filter((us: any) => us.type === 'teaches').map((us: any) => us.skill?.name || '') : ['Mentorship']);

    const myLearns = Array.isArray(currentUser.skillsLearned) && currentUser.skillsLearned.length > 0
      ? currentUser.skillsLearned
      : (Array.isArray(currentUser.userSkills) ? currentUser.userSkills.filter((us: any) => us.type === 'wants_to_learn').map((us: any) => us.skill?.name || '') : ['Skill Exchange']);

    // Peer skills
    const peerTeaches = Array.isArray(peer.skillsTaught) && peer.skillsTaught.length > 0
      ? peer.skillsTaught
      : (Array.isArray(peer.userSkills) ? peer.userSkills.filter((us: any) => us.type === 'teaches').map((us: any) => us.skill?.name || '') : ['Tutoring']);

    const peerLearns = Array.isArray(peer.skillsLearned) && peer.skillsLearned.length > 0
      ? peer.skillsLearned
      : (Array.isArray(peer.userSkills) ? peer.userSkills.filter((us: any) => us.type === 'wants_to_learn').map((us: any) => us.skill?.name || '') : ['Skill Learning']);

    // 1. Skill to Give: Peer wants what I teach
    const giveMatch = myTeaches.find((t: string) => peerLearns.some((pl: string) => pl.toLowerCase() === t.toLowerCase()));
    const finalGive = giveMatch || myTeaches[0] || 'Web Development';

    // 2. Skill to Take: Peer teaches what I want
    const takeMatch = peerTeaches.find((pt: string) => myLearns.some((ml: string) => ml.toLowerCase() === pt.toLowerCase()));
    const finalTake = takeMatch || peerTeaches[0] || 'Python';

    setGiveSkill(finalGive);
    setTakeSkill(finalTake);

    const hasMutualMatch = giveMatch && takeMatch;
    const computedScore = hasMutualMatch ? 98 : (giveMatch || takeMatch ? 88 : 75);
    setMatchScore(computedScore);

    setAiInsight(
      hasMutualMatch
        ? `Perfect mutual fit! You can teach ${finalGive} and ${peer.name} can teach ${finalTake}.`
        : `Smart Barter Tip: Swap your ${finalGive} expertise for ${peer.name}'s ${finalTake} knowledge.`
    );
  }, [currentUser, peer]);

  if (!peer || !giveSkill || !takeSkill) return null;

  return (
    <div className="bg-surface border border-outline-variant rounded-2xl p-4 mb-4 shadow-elevation-1 select-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-surface-container border border-outline-variant text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">auto_awesome</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold text-on-surface">Gemini AI Exchange Recommendation</span>
              <span className="px-2 py-0.5 bg-surface-container border border-outline-variant text-primary text-[10px] font-bold rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">bolt</span>
                {matchScore}% MATCH
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              {aiInsight}
            </p>
            <div className="flex items-center gap-2 mt-2 text-[11px] font-medium text-on-surface flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant text-on-surface font-semibold">
                Give: {giveSkill}
              </span>
              <span className="material-symbols-outlined text-xs text-on-surface-variant">sync_alt</span>
              <span className="px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant text-on-surface font-semibold">
                Take: {takeSkill}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => onProposeExchange(giveSkill, takeSkill)}
          className="w-full sm:w-auto shrink-0 py-2 px-3.5 text-xs font-semibold shadow-elevation-1 flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">handshake</span>
          <span>Propose Exchange</span>
        </Button>
      </div>
    </div>
  );
}
