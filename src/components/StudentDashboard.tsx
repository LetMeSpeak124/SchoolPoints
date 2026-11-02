'use client';

import { useState, useTransition } from 'react';
import { redeemRewardAction } from '@/app/actions/student';
import { Award, CheckCircle2, Clock, Gift, History, Sparkles, AlertCircle, ShoppingBag } from 'lucide-react';

interface StudentDashboardProps {
  student: {
    id: string;
    name: string;
    username: string;
    classroom?: {
      name: string;
    } | null;
  };
  balance: number;
  ledger: Array<{
    id: string;
    amount: number;
    type: string;
    category: string | null;
    note: string | null;
    createdAt: string | Date;
    awardedBy?: { name: string } | null;
  }>;
  redemptions: Array<{
    id: string;
    pointCost: number;
    status: string;
    createdAt: string | Date;
    reward: {
      name: string;
      emoji: string;
    };
  }>;
  rewards: Array<{
    id: string;
    name: string;
    emoji: string;
    pointCost: number;
    stock: number;
  }>;
}

export function StudentDashboard({
  student,
  balance,
  ledger,
  redemptions,
  rewards,
}: StudentDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Find next reward target: lowest cost reward that student cannot yet afford
  const sortedRewards = [...rewards].sort((a, b) => a.pointCost - b.pointCost);
  const nextTarget = sortedRewards.find((r) => r.pointCost > balance);

  let progressPercent = 100;
  let pointsNeeded = 0;
  if (nextTarget) {
    progressPercent = Math.min(100, Math.max(5, Math.round((balance / nextTarget.pointCost) * 100)));
    pointsNeeded = nextTarget.pointCost - balance;
  }

  const handleRedeem = (rewardId: string, rewardName: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await redeemRewardAction(rewardId);
      if (res?.error) {
        setFeedback({ message: res.error, type: 'error' });
      } else {
        setFeedback({ message: `Successfully redeemed ${rewardName}! Check your redemptions below.`, type: 'success' });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" /> Requested
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Ready for Pickup
          </span>
        );
      case 'COLLECTED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3 h-3" /> Collected
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3" /> Cancelled & Refunded
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-4">
      {/* Welcome & Balance Hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-medium text-indigo-100 mb-3">
              🎒 {student.classroom?.name || 'Classroom Student'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Hello, {student.name}!
            </h2>
            <p className="text-indigo-100 text-sm mt-1 max-w-md">
              Keep up the great work in class! Earn points from your teachers for homework, kindness, and participation.
            </p>
          </div>

          {/* Next Goal Progress */}
          <div className="mt-6 pt-5 border-t border-white/20">
            {nextTarget ? (
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-indigo-100 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Next Goal: {nextTarget.emoji} {nextTarget.name} ({nextTarget.pointCost} pts)
                  </span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-white font-mono">
                    {pointsNeeded} more pt{pointsNeeded > 1 ? 's' : ''} to go!
                  </span>
                </div>
                <div className="w-full bg-black/20 rounded-full h-3 overflow-hidden p-0.5">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-amber-300 h-full rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Sparkles className="w-5 h-5 text-amber-300" />
                You have enough points to redeem any item in the school catalog! 🌟
              </div>
            )}
          </div>
        </div>

        {/* Current Balance Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mb-2">
            ⭐
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Current Balance
            </span>
            <div className="text-5xl font-extrabold text-slate-900 tracking-tight my-1">
              {balance}
            </div>
            <p className="text-xs text-slate-500 font-medium">Available School Points</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 w-full flex justify-around text-xs text-slate-500">
            <div>
              <span className="font-bold text-slate-700">{ledger.filter((l) => l.type === 'AWARD').length}</span> Awards
            </div>
            <div>
              <span className="font-bold text-slate-700">{redemptions.length}</span> Redemptions
            </div>
          </div>
        </div>
      </div>

      {/* Feedback message banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Rewards Catalog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Gift className="w-5 h-5 text-indigo-600" />
              School Supplies Catalog
            </h3>
            <p className="text-xs text-slate-500">
              Redeem your hard-earned points for awesome rewards!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rewards.map((reward) => {
            const canAfford = balance >= reward.pointCost;
            const inStock = reward.stock > 0;
            const isRedeemable = canAfford && inStock && !isPending;

            return (
              <div
                key={reward.id}
                className={`bg-white rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between relative shadow-sm ${
                  isRedeemable
                    ? 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                    : 'border-slate-100 opacity-90'
                }`}
              >
                {/* Emoji & Stock */}
                <div className="flex justify-between items-start mb-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
                    {reward.emoji}
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      reward.stock > 3
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : reward.stock > 0
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-rose-100 text-rose-800 border-rose-200'
                    }`}
                  >
                    {reward.stock > 0 ? `${reward.stock} in stock` : 'Out of stock'}
                  </span>
                </div>

                {/* Details */}
                <div className="mb-4">
                  <h4 className="font-bold text-slate-800 text-sm leading-snug">
                    {reward.name}
                  </h4>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-lg font-black text-indigo-600">
                      {reward.pointCost}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">points</span>
                  </div>
                </div>

                {/* Redeem Button */}
                <button
                  onClick={() => handleRedeem(reward.id, reward.name)}
                  disabled={!isRedeemable}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isRedeemable
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow'
                      : !inStock
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200 cursor-not-allowed'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {!inStock
                    ? 'Out of Stock'
                    : !canAfford
                    ? `Need ${reward.pointCost - balance} more pts`
                    : 'Redeem Now'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two columns: Redemptions and Append-Only History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* Active & Past Redemptions */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-indigo-600" />
            My Redemptions ({redemptions.length})
          </h3>

          {redemptions.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-6 text-center">
              No rewards redeemed yet. Choose a reward above once you have enough points!
            </p>
          ) : (
            <div className="space-y-3">
              {redemptions.map((redemption) => (
                <div
                  key={redemption.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{redemption.reward.emoji}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {redemption.reward.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(redemption.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • -{redemption.pointCost} pts
                      </p>
                    </div>
                  </div>
                  <div>{getStatusBadge(redemption.status)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Append-Only Points Ledger History */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Points Ledger History
          </h3>

          {ledger.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-6 text-center">
              No ledger transactions yet.
            </p>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {ledger.map((entry) => {
                const isPositive = entry.amount > 0;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            entry.type === 'AWARD'
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.type === 'REFUND'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {entry.type}
                        </span>
                        {entry.category && (
                          <span className="text-xs font-medium text-slate-600">
                            {entry.category}
                          </span>
                        )}
                      </div>
                      {entry.note && (
                        <p className="text-xs text-slate-600 mt-1 font-normal">
                          &quot;{entry.note}&quot;
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(entry.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {entry.awardedBy && ` • Awarded by ${entry.awardedBy.name}`}
                      </p>
                    </div>

                    <div
                      className={`text-base font-extrabold font-mono ${
                        isPositive ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                    >
                      {isPositive ? `+${entry.amount}` : entry.amount}
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
