'use client';

import { useState, useTransition } from 'react';
import {
  updateTeacherStatusAction,
  updateTeacherDailyLimitAction,
  createRewardAction,
  updateRewardStockAction,
  updateRedemptionStatusAction,
} from '@/app/actions/admin';
import { RedemptionStatus } from '@/lib/types';
import {
  Users,
  Gift,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  PlusCircle,
  Sliders,
  ShieldCheck,
  Award,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface AdminDashboardProps {
  teachers: Array<{
    id: string;
    name: string;
    username: string;
    teacherStatus: 'PENDING' | 'APPROVED' | 'REVOKED';
    dailyAwardLimit: number;
    taughtClasses: Array<{ name: string; _count: { students: number } }>;
    _count: { givenAwards: number };
  }>;
  rewards: Array<{
    id: string;
    name: string;
    emoji: string;
    pointCost: number;
    stock: number;
    active: boolean;
    _count: { redemptions: number };
  }>;
  redemptions: Array<{
    id: string;
    pointCost: number;
    status: string;
    createdAt: string | Date;
    student: {
      id: string;
      name: string;
      username: string;
    };
    reward: {
      id: string;
      name: string;
      emoji: string;
    };
  }>;
  stats: {
    totalPointsAwarded: number;
    totalRedemptions: number;
    totalStudents: number;
    totalTeachers: number;
  };
}

export function AdminDashboard({
  teachers,
  rewards,
  redemptions,
  stats,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<'teachers' | 'rewards' | 'redemptions' | 'overview'>('teachers');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Rewards form state
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardEmoji, setNewRewardEmoji] = useState('✏️');
  const [newRewardCost, setNewRewardCost] = useState(10);
  const [newRewardStock, setNewRewardStock] = useState(15);

  // Teacher limits edit states
  const [teacherLimits, setTeacherLimits] = useState<Record<string, number>>(
    Object.fromEntries(teachers.map((t) => [t.id, t.dailyAwardLimit]))
  );

  // Stock edit states
  const [stockEdits, setStockEdits] = useState<Record<string, number>>(
    Object.fromEntries(rewards.map((r) => [r.id, r.stock]))
  );

  const handleStatusChange = (teacherId: string, status: 'APPROVED' | 'REVOKED' | 'PENDING') => {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateTeacherStatusAction(teacherId, status);
      if (res?.error) {
        setFeedback({ message: res.error, type: 'error' });
      } else {
        setFeedback({ message: `Teacher status updated to ${status}`, type: 'success' });
      }
    });
  };

  const handleDailyLimitSave = (teacherId: string) => {
    setFeedback(null);
    const limit = teacherLimits[teacherId];
    startTransition(async () => {
      const res = await updateTeacherDailyLimitAction(teacherId, limit);
      if (res?.error) {
        setFeedback({ message: res.error, type: 'error' });
      } else {
        setFeedback({ message: `Teacher daily limit updated to ${limit} pts`, type: 'success' });
      }
    });
  };

  const handleStockSave = (rewardId: string) => {
    setFeedback(null);
    const stock = stockEdits[rewardId];
    startTransition(async () => {
      const res = await updateRewardStockAction(rewardId, stock);
      if (res?.error) {
        setFeedback({ message: res.error, type: 'error' });
      } else {
        setFeedback({ message: 'Reward stock updated successfully', type: 'success' });
      }
    });
  };

  const handleAddReward = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const formData = new FormData();
    formData.append('name', newRewardName);
    formData.append('emoji', newRewardEmoji);
    formData.append('pointCost', newRewardCost.toString());
    formData.append('stock', newRewardStock.toString());

    startTransition(async () => {
      const res = await createRewardAction(formData);
      if (res?.error) {
        setFeedback({ message: res.error, type: 'error' });
      } else {
        setFeedback({ message: `Added ${newRewardName} to catalog!`, type: 'success' });
        setNewRewardName('');
        setNewRewardCost(10);
        setNewRewardStock(15);
      }
    });
  };

  const handleRedemptionStatus = (redemptionId: string, status: RedemptionStatus) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateRedemptionStatusAction(redemptionId, status);
      if (res?.error) {
        setFeedback({ message: res.error, type: 'error' });
      } else {
        setFeedback({
          message:
            status === 'CANCELLED'
              ? 'Redemption cancelled! Points refunded to student and stock restored.'
              : `Redemption moved to ${status}`,
          type: 'success',
        });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-purple-800 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-medium text-purple-200 mb-2">
            <ShieldCheck className="w-4 h-4 text-purple-300" /> Administrator Console
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            School Administration
          </h2>
          <p className="text-purple-200 text-xs sm:text-sm mt-1">
            Manage teacher approvals, school rewards catalog, and student redemptions.
          </p>
        </div>

        {/* Quick Stats overview */}
        <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur">
          <div className="text-center px-2">
            <div className="text-lg font-black text-white">{stats.totalPointsAwarded}</div>
            <div className="text-[10px] text-purple-200 uppercase font-bold">Total Points</div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center px-2">
            <div className="text-lg font-black text-white">{stats.totalRedemptions}</div>
            <div className="text-[10px] text-purple-200 uppercase font-bold">Redemptions</div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center px-2">
            <div className="text-lg font-black text-white">{stats.totalStudents}</div>
            <div className="text-[10px] text-purple-200 uppercase font-bold">Students</div>
          </div>
        </div>
      </div>

      {/* Feedback banner */}
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setTab('teachers')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            tab === 'teachers'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Teachers ({teachers.length})
        </button>
        <button
          onClick={() => setTab('rewards')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            tab === 'rewards'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Gift className="w-4 h-4" />
          Rewards Catalog ({rewards.length})
        </button>
        <button
          onClick={() => setTab('redemptions')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            tab === 'redemptions'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          Redemptions Queue ({redemptions.length})
        </button>
      </div>

      {/* TAB 1: TEACHERS */}
      {tab === 'teachers' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Teacher Approvals & Limits</h3>
            <p className="text-xs text-slate-500">
              Only approved teachers are permitted to award points to their students.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Teacher</th>
                  <th className="py-3 px-4">Classes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Daily Award Limit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{t.name}</div>
                      <div className="text-[11px] text-slate-400">@{t.username}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {t.taughtClasses.length > 0
                        ? t.taughtClasses.map((c) => c.name).join(', ')
                        : 'No classes assigned'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          t.teacherStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : t.teacherStatus === 'PENDING'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}
                      >
                        {t.teacherStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={teacherLimits[t.id] ?? t.dailyAwardLimit}
                          onChange={(e) =>
                            setTeacherLimits({
                              ...teacherLimits,
                              [t.id]: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                        />
                        <button
                          onClick={() => handleDailyLimitSave(t.id)}
                          disabled={isPending}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition"
                        >
                          Save
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {t.teacherStatus !== 'APPROVED' && (
                        <button
                          onClick={() => handleStatusChange(t.id, 'APPROVED')}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                        >
                          Approve
                        </button>
                      )}
                      {t.teacherStatus !== 'REVOKED' && (
                        <button
                          onClick={() => handleStatusChange(t.id, 'REVOKED')}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: REWARDS CATALOG */}
      {tab === 'rewards' && (
        <div className="space-y-6">
          {/* Create Reward Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-purple-600" />
              Add New School Supply Reward
            </h3>

            <form onSubmit={handleAddReward} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Emoji Icon</label>
                <input
                  type="text"
                  value={newRewardEmoji}
                  onChange={(e) => setNewRewardEmoji(e.target.value)}
                  placeholder="e.g. 🎒"
                  required
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Item Name</label>
                <input
                  type="text"
                  value={newRewardName}
                  onChange={(e) => setNewRewardName(e.target.value)}
                  placeholder="e.g. Spiral Notebook"
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Point Cost</label>
                <input
                  type="number"
                  min="1"
                  value={newRewardCost}
                  onChange={(e) => setNewRewardCost(parseInt(e.target.value) || 1)}
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  value={newRewardStock}
                  onChange={(e) => setNewRewardStock(parseInt(e.target.value) || 0)}
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div className="sm:col-span-5 flex justify-end">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition"
                >
                  Create Reward
                </button>
              </div>
            </form>
          </div>

          {/* Rewards List */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Catalog Inventory</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {rewards.map((r) => (
                <div key={r.id} className="p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{r.emoji}</span>
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                      {r.pointCost} pts
                    </span>
                  </div>
                  <div className="my-2">
                    <h4 className="font-bold text-slate-900 text-sm">{r.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      {r._count.redemptions} total redeemed
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500">Stock:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={stockEdits[r.id] ?? r.stock}
                        onChange={(e) =>
                          setStockEdits({
                            ...stockEdits,
                            [r.id]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                      />
                      <button
                        onClick={() => handleStockSave(r.id)}
                        disabled={isPending}
                        className="text-xs font-bold text-purple-600 hover:bg-purple-50 px-2 py-1 rounded transition"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REDEMPTIONS */}
      {tab === 'redemptions' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Student Redemptions Workflow</h3>
            <p className="text-xs text-slate-500">
              Move items through Requested &rarr; Ready &rarr; Collected. Cancelling refunds points and restores stock in one transaction.
            </p>
          </div>

          {redemptions.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-8 text-center">No redemptions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Reward</th>
                    <th className="py-3 px-4">Points</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {redemptions.map((redemption) => (
                    <tr key={redemption.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {redemption.student.name}
                        <div className="text-[11px] text-slate-400">@{redemption.student.username}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        <span className="mr-1.5">{redemption.reward.emoji}</span>
                        {redemption.reward.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                        {redemption.pointCost} pts
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(redemption.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            redemption.status === 'REQUESTED'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : redemption.status === 'READY'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : redemption.status === 'COLLECTED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          {redemption.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {redemption.status === 'REQUESTED' && (
                          <button
                            onClick={() => handleRedemptionStatus(redemption.id, 'READY')}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition"
                          >
                            Mark Ready
                          </button>
                        )}
                        {redemption.status === 'READY' && (
                          <button
                            onClick={() => handleRedemptionStatus(redemption.id, 'COLLECTED')}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition"
                          >
                            Mark Collected
                          </button>
                        )}
                        {redemption.status !== 'COLLECTED' && redemption.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleRedemptionStatus(redemption.id, 'CANCELLED')}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition"
                          >
                            Cancel & Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
