import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, onRewardsUpdated, onPeersUpdated } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

export interface RewardItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  type: 'wallet_credit' | 'badge' | 'perk' | 'voucher' | 'featured_mentor' | 'zero_fee_pass' | 'doubt_pass';
  value: number | string;
  icon: string;
  category: string;
  targetRole?: 'all' | 'student' | 'teacher';
}

export interface RedemptionItem {
  id: string;
  userId: string;
  rewardId?: string;
  rewardTitle?: string;
  rewardType?: string;
  cost?: number;
  points: number;
  kind: 'earn' | 'redeem';
  reason?: string;
  sessionId?: string | null;
  status?: string;
  createdAt: string;
}

export function Rewards() {
  const currentUser = useAppStore(state => state.currentUser);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const addNotification = useAppStore(state => state.addNotification);

  const [catalog, setCatalog] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentPoints = currentUser?.rewardPoints ?? 0;
  const userBadges: string[] = Array.isArray(currentUser?.badges) ? currentUser.badges : [];

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [catData, redData] = await Promise.all([
        api.getRewards(),
        api.getRewardRedemptions()
      ]);
      if (Array.isArray(catData)) setCatalog(catData);
      if (Array.isArray(redData)) setRedemptions(redData);
    } catch (err) {
      console.warn('Error loading rewards data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const unsubRewards = onRewardsUpdated((data: any) => {
      if (Array.isArray(data)) {
        setRedemptions(data.filter((r: any) => r.userId === currentUser?.id));
      } else if (data?.redemptions && Array.isArray(data.redemptions)) {
        setRedemptions(data.redemptions.filter((r: any) => r.userId === currentUser?.id));
        if (Array.isArray(data.catalog)) setCatalog(data.catalog);
      } else {
        api.getRewardRedemptions().then(r => Array.isArray(r) && setRedemptions(r)).catch(() => {});
      }
    });

    const unsubPeers = onPeersUpdated((peers: any[]) => {
      if (currentUser?.id && Array.isArray(peers)) {
        const peer = peers.find((p: any) => p.id === currentUser.id);
        if (peer && typeof peer.rewardPoints === 'number') {
          // Points sync handled by useAppStore
        }
      }
    });

    return () => {
      unsubRewards();
      unsubPeers();
    };
  }, [currentUser?.id, loadData]);

  const handleRedeem = async (reward: RewardItem) => {
    if (currentPoints < reward.cost) return;
    setRedeemingId(reward.id);
    setFeedbackMsg(null);

    try {
      const res = await api.redeemReward(reward.id);
      if (res?.success) {
        let successMsg = 'Perk requested.';
        if (reward.type === 'wallet_credit') {
          successMsg = 'Tokens added to your platform wallet!';
        } else if (reward.type === 'badge') {
          successMsg = 'Badge added to your profile!';
        } else if (reward.type === 'voucher') {
          successMsg = 'Discount voucher unlocked! You can apply it directly when booking in Marketplace.';
        } else if (reward.type === 'featured_mentor') {
          successMsg = '⭐ Featured Mentor Spotlight activated! Your card is now boosted to the top of the Marketplace.';
        } else if (reward.type === 'zero_fee_pass') {
          successMsg = 'Zero Platform Fee Pass added! Enjoy 100% payout with 0% platform fee on your next lectures.';
        } else if (reward.type === 'doubt_pass') {
          successMsg = '15-Min Instant Doubt Clearing Pass added to your profile!';
        }

        setFeedbackMsg({
          type: 'success',
          text: `Successfully redeemed "${reward.title}"! ${successMsg}`
        });

        // Optimistically update currentUser state
        if (res.user) {
          setCurrentUser(res.user);
        } else {
          const updatedUser = {
            ...currentUser,
            rewardPoints: Math.max(0, currentPoints - reward.cost),
            tokenBalance: reward.type === 'wallet_credit' ? (currentUser?.tokenBalance || 0) + (typeof reward.value === 'number' ? reward.value : 5) : currentUser?.tokenBalance,
            badges: reward.type === 'badge' ? [...userBadges, String(reward.value || reward.title)] : userBadges
          };
          setCurrentUser(updatedUser);
        }

        if (res.redemption) {
          setRedemptions(prev => [res.redemption, ...prev]);
        } else {
          api.getRewardRedemptions().then(r => Array.isArray(r) && setRedemptions(r)).catch(() => {});
        }

        addNotification({
          type: 'reminder',
          title: `🎁 Reward Redeemed!`,
          body: `You successfully redeemed "${reward.title}" for ${reward.cost} points.`,
          link: reward.type === 'wallet_credit' ? '/wallet' : (reward.type === 'voucher' || reward.type === 'featured_mentor') ? '/marketplace' : '/rewards'
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text: res?.error || 'Failed to redeem reward. Please check your points balance.'
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Network error occurred while redeeming.'
      });
    } finally {
      setRedeemingId(null);
    }
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(catalog.map(item => item.category).filter(Boolean)));
    return ['all', ...cats];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (selectedCategory === 'all') return catalog;
    return catalog.filter(item => item.category === selectedCategory);
  }, [catalog, selectedCategory]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-surface border border-outline-variant p-6 md:p-8 shadow-elevation-1">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-on-surface border border-outline-variant text-xs font-semibold tracking-wide uppercase">
              <span className="material-symbols-outlined text-sm text-primary">stars</span>
              Student Loyalty Rewards
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-on-surface">
              Earn Points While You Learn
            </h1>
            <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
              Complete peer mentoring sessions to automatically earn reward points (min 15 pts + duration bonus). Redeem them for free booking wallet credits, showcase badges, and career consultation perks!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            {/* Points Balance Pill */}
            <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 md:px-6 flex items-center gap-4 shadow-elevation-1">
              <div className="w-12 h-12 rounded-xl bg-surface border border-outline-variant text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  military_tech
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant block uppercase tracking-wider">
                  Available Balance
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
                    {currentPoints.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-primary uppercase">Pts</span>
                </div>
              </div>
            </div>

            {/* Badges count pill */}
            <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 md:px-6 flex items-center gap-4 shadow-elevation-1">
              <div className="w-12 h-12 rounded-xl bg-surface border border-outline-variant text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  workspace_premium
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant block uppercase tracking-wider">
                  Badges Earned
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
                    {userBadges.length}
                  </span>
                  <span className="text-xs font-semibold text-on-surface-variant uppercase">Badges</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Badges Strip if available */}
        {userBadges.length > 0 && (
          <div className="mt-6 pt-5 border-t border-outline-variant/60 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-on-surface-variant mr-1">Your Achievements:</span>
            {userBadges.map((badge, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-learning-amber/15 text-learning-amber border border-learning-amber/30 text-xs font-extrabold shadow-sm"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Active Unlocked Vouchers & Boosts Strip */}
      {((Array.isArray(currentUser?.vouchers) && currentUser.vouchers.some((v: any) => !v.isUsed)) ||
        currentUser?.isFeatured ||
        (currentUser?.zeroFeePasses && currentUser.zeroFeePasses > 0) ||
        (currentUser?.doubtPasses && currentUser.doubtPasses > 0)) && (
        <div className="bg-surface border border-outline-variant rounded-2xl p-5 shadow-elevation-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-primary">confirmation_number</span>
              Your Active Unlocked Perks & Vouchers
            </span>
            <span className="text-[11px] text-on-surface-variant font-medium">Ready to use in Marketplace</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Active Vouchers */}
            {Array.isArray(currentUser?.vouchers) && currentUser.vouchers.filter((v: any) => !v.isUsed).map((v: any) => (
              <div key={v.id} className="p-3 bg-primary-container/20 border border-primary/30 rounded-xl flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">local_activity</span>
                    <span className="text-xs font-black text-on-surface">{v.title}</span>
                  </div>
                  <div className="text-[10px] font-mono font-bold text-primary">{v.code}</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-primary text-on-primary text-[10px] font-bold">
                  {v.discountType === 'percent' ? `${v.discountValue}% OFF` : `₹${v.discountValue} OFF`}
                </span>
              </div>
            ))}

            {/* Featured Mentor Active */}
            {currentUser?.isFeatured && (
              <div className="p-3 bg-learning-amber-container/30 border border-learning-amber/40 rounded-xl flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-learning-amber">star</span>
                    <span className="text-xs font-black text-on-surface">Featured Mentor</span>
                  </div>
                  <div className="text-[10px] text-on-surface-variant">Pinned at top of Marketplace</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-learning-amber text-on-learning-amber text-[10px] font-bold">
                  Active ⭐
                </span>
              </div>
            )}

            {/* Zero Fee Passes */}
            {currentUser?.zeroFeePasses > 0 && (
              <div className="p-3 bg-teaching-emerald-container/30 border border-teaching-emerald/40 rounded-xl flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-teaching-emerald">monetization_on</span>
                    <span className="text-xs font-black text-on-surface">Zero Platform Fee</span>
                  </div>
                  <div className="text-[10px] text-on-surface-variant">{currentUser.zeroFeePasses} lectures 100% payout</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-teaching-emerald text-on-teaching-emerald text-[10px] font-bold">
                  {currentUser.zeroFeePasses} Left
                </span>
              </div>
            )}

            {/* Instant Doubt Passes */}
            {currentUser?.doubtPasses > 0 && (
              <div className="p-3 bg-surface-container-high border border-outline-variant rounded-xl flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">bolt</span>
                    <span className="text-xs font-black text-on-surface">15-Min Doubt Pass</span>
                  </div>
                  <div className="text-[10px] text-on-surface-variant">Drop-in emergency call</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-surface text-on-surface border border-outline-variant text-[10px] font-bold">
                  {currentUser.doubtPasses} Pass{currentUser.doubtPasses > 1 ? 'es' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feedback message banner */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-bold shadow-elevation-1 ${
              feedbackMsg.type === 'success'
                ? 'bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/30'
                : 'bg-alert-rose/10 text-alert-rose border border-alert-rose/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                {feedbackMsg.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-outline-variant pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all ${
              activeTab === 'catalog'
                ? 'bg-primary text-on-primary shadow-elevation-1'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-base">storefront</span>
            <span>Rewards Catalog</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all ${
              activeTab === 'history'
                ? 'bg-primary text-on-primary shadow-elevation-1'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-base">history</span>
            <span>Points History</span>
            {redemptions.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-surface text-on-surface">
                {redemptions.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'catalog' && categories.length > 2 && (
          <div className="hidden sm:flex items-center gap-1.5 bg-surface-container p-1 rounded-xl border border-outline-variant overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold capitalize transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab 1: Catalog */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 rounded-2xl bg-surface-container animate-pulse" />
              ))}
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-2xl border border-outline-variant">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">loyalty</span>
              <h3 className="text-base font-bold text-on-surface">No rewards available in this category</h3>
              <p className="text-xs text-on-surface-variant mt-1">Check back later or browse other categories.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCatalog.map(item => {
                const canAfford = currentPoints >= item.cost;
                const pointsNeeded = item.cost - currentPoints;
                const isBadgeOwned = item.type === 'badge' && userBadges.includes(String(item.value || item.title));
                const isFeaturedActive = item.type === 'featured_mentor' && currentUser?.isFeatured;
                const isRedeeming = redeemingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between bg-surface border rounded-3xl p-6 transition-all duration-200 hover:shadow-elevation-2 relative group ${
                      item.category === 'Mentor Boosts' 
                        ? 'border-learning-amber/30 hover:border-learning-amber' 
                        : item.category === 'Discounts & Vouchers'
                        ? 'border-primary/30 hover:border-primary'
                        : 'border-outline-variant hover:border-primary/40'
                    }`}
                  >
                    <div>
                      {/* Top Header with Icon & Category Badge */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          item.type === 'wallet_credit'
                            ? 'bg-teaching-emerald-container text-on-teaching-emerald-container'
                            : item.type === 'badge'
                            ? 'bg-learning-amber/20 text-learning-amber'
                            : item.type === 'voucher'
                            ? 'bg-primary-container text-on-primary-container'
                            : item.type === 'featured_mentor'
                            ? 'bg-learning-amber-container text-on-learning-amber-container'
                            : item.type === 'zero_fee_pass'
                            ? 'bg-teaching-emerald-container text-teaching-emerald'
                            : 'bg-surface-container-high text-primary'
                        }`}>
                          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {item.icon || 'card_giftcard'}
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            item.category === 'Mentor Boosts'
                              ? 'bg-learning-amber-container text-on-learning-amber-container border-learning-amber/30'
                              : item.category === 'Discounts & Vouchers'
                              ? 'bg-primary-container text-on-primary-container border-primary/30'
                              : 'bg-surface-container-high text-on-surface-variant border-outline-variant'
                          }`}>
                            {item.category || item.type}
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-base font-black text-on-surface mb-2 group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {item.title}
                      </h3>
                      <p className="text-xs text-on-surface-variant font-medium leading-relaxed mb-6">
                        {item.description}
                      </p>
                    </div>

                    {/* Bottom Cost & Redeem Action */}
                    <div className="pt-4 border-t border-outline-variant/60 flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Cost</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-on-surface">{item.cost}</span>
                          <span className="text-xs font-extrabold text-primary uppercase">Pts</span>
                        </div>
                      </div>

                      <div>
                        {isBadgeOwned ? (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-learning-amber bg-learning-amber/15 px-3 py-2 rounded-xl border border-learning-amber/30">
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            Owned
                          </span>
                        ) : isFeaturedActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-learning-amber bg-learning-amber/15 px-3 py-2 rounded-xl border border-learning-amber/30">
                            <span className="material-symbols-outlined text-sm">star</span>
                            Active Now
                          </span>
                        ) : (
                          <Button
                            variant={canAfford ? 'primary' : 'secondary'}
                            disabled={!canAfford || isRedeeming}
                            onClick={() => handleRedeem(item)}
                            className="text-xs py-2 px-3"
                          >
                            {isRedeeming ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                <span>Redeeming...</span>
                              </>
                            ) : canAfford ? (
                              <>
                                <span className="material-symbols-outlined text-sm">redeem</span>
                                <span>Redeem</span>
                              </>
                            ) : (
                              <span>Need {pointsNeeded} more pts</span>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* How to Earn Info Box */}
          <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-learning-amber/20 text-learning-amber flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">help_outline</span>
              </div>
              <div>
                <h4 className="text-xs font-black text-on-surface">How are session reward points calculated?</h4>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  Points = Base 15 pts + 5 pts per 30 minutes of session duration (e.g. 60 min session = 25 pts, min 10 pts).
                </p>
              </div>
            </div>
            <div className="text-xs font-black text-primary flex items-center gap-1">
              <span>Automatic upon session completion</span>
              <span className="material-symbols-outlined text-sm">task_alt</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Points History (Ledger) */}
      {activeTab === 'history' && (
        <div className="bg-surface rounded-3xl border border-outline-variant overflow-hidden shadow-elevation-1">
          <div className="p-5 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-on-surface">Activity Ledger</h2>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Complete record of earned loyalty points and reward redemptions
              </p>
            </div>
            <button
              onClick={loadData}
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline p-1"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
          </div>

          {redemptions.length === 0 ? (
            <div className="text-center py-16 px-4">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">history</span>
              <h3 className="text-base font-bold text-on-surface">No points activity yet</h3>
              <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
                Complete your first mentoring session to start earning reward points and unlocking catalog perks!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/60">
              {redemptions.map(entry => {
                const isEarn = entry.kind === 'earn';
                const dateStr = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString([], {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Recently';

                return (
                  <div
                    key={entry.id}
                    className="p-4 md:p-5 flex items-center justify-between gap-4 hover:bg-surface-container/50 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isEarn
                          ? 'bg-teaching-emerald-container text-on-teaching-emerald-container'
                          : 'bg-primary-container text-on-primary-container'
                      }`}>
                        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {isEarn ? 'add_circle' : 'redeem'}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-on-surface truncate">
                            {isEarn ? (entry.reason || 'Session Completed') : (entry.rewardTitle || 'Reward Redeemed')}
                          </h4>
                          {entry.status && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-surface-container border border-outline-variant text-on-surface-variant">
                              {entry.status}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-on-surface-variant block mt-0.5">
                          {dateStr}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-black ${
                        isEarn ? 'text-teaching-emerald' : 'text-primary'
                      }`}>
                        {isEarn ? `+${entry.points}` : `${entry.points}`}
                      </span>
                      <span className="text-xs font-extrabold text-on-surface-variant uppercase">Pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Rewards;
