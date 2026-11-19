'use client';

import { useState, useTransition } from 'react';
import { awardPointsAction } from '@/app/actions/teacher';
import { allocateMonthlyPointsAction } from '@/app/actions/allocations';
import { createRewardAction, updateRewardStockAction, setRewardActiveAction } from '@/app/actions/admin';
import { AWARD_CATEGORIES, AwardCategory, MAX_AWARD_POINTS, STUDENT_DAILY_CAP } from '@/lib/types';
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  UserCheck,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react';

interface StudentItem {
  id: string;
  name: string;
  username: string;
  balance: number;
}

interface ClassroomItem {
  id: string;
  name: string;
  students: StudentItem[];
}

interface TeacherDashboardProps {
  teacher: {
    id: string;
    name: string;
    username: string;
    teacherStatus: 'PENDING' | 'APPROVED' | 'REVOKED';
    dailyAwardLimit: number;
  };
  classes: ClassroomItem[];
  pointsAwardedToday: number;
  recentAwards: Array<{
    id: string;
    amount: number;
    category: string | null;
    note: string | null;
    createdAt: string | Date;
    student: {
      name: string;
    };
  }>;
}

export function TeacherDashboard({
  teacher,
  classes,
  pointsAwardedToday,
  recentAwards,
}: TeacherDashboardProps) {
  const isApproved = teacher.teacherStatus === 'APPROVED';
  const isPendingStatus = teacher.teacherStatus === 'PENDING';
  const isRevoked = teacher.teacherStatus === 'REVOKED';

  // 3-Click Flow State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<AwardCategory>('PARTICIPATION');
  const [customPoints, setCustomPoints] = useState<number>(5);
  const [note, setNote] = useState<string>('');

  // Monthly Allocation State
  const [allocationAmount, setAllocationAmount] = useState<number>(0);
  const [allocationPeriod, setAllocationPeriod] = useState<string>('');
  const [allocationFeedback, setAllocationFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Reward Management State
  const [rewardName, setRewardName] = useState<string>('');
  const [rewardEmoji, setRewardEmoji] = useState<string>('??');
  const [rewardCost, setRewardCost] = useState<number>(5);
  const [rewardStock, setRewardStock] = useState<number>(0);
  const [rewardFeedback, setRewardFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isSubmitting, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const allStudents = classes.flatMap((c) => c.students);
  const selectedStudent = allStudents.find((s) => s.id === selectedStudentId);

  const remainingDailyLimit = Math.max(0, teacher.dailyAwardLimit - pointsAwardedToday);
  const maxAwardForThisClick = Math.max(0, Math.min(remainingDailyLimit, MAX_AWARD_POINTS));
  const dailyPercent =
    teacher.dailyAwardLimit > 0
      ? Math.min(100, Math.round((pointsAwardedToday / teacher.dailyAwardLimit) * 100))
      : 0;

  const handleCategorySelect = (cat: (typeof AWARD_CATEGORIES)[0]) => {
    setSelectedCategory(cat.value);
    setCustomPoints(cat.defaultPoints);
  };

  const handleAwardSubmit = () => {
    if (!selectedStudentId) {
      setFeedback({ message: 'Please select a student first (Step 1)', type: 'error' });
      return;
    }
    if (maxAwardForThisClick <= 0) {
      setFeedback({
        message: 'Your remaining daily award allowance is exhausted. Ask an administrator to adjust it.',
        type: 'error',
      });
      return;
    }
    if (customPoints > maxAwardForThisClick) {
      setFeedback({
        message: `A single award cannot exceed ${MAX_AWARD_POINTS} points or your remaining allowance of ${remainingDailyLimit}.`,
        type: 'error',
      });
      return;
    }
    setFeedback(null);

    const formData = new FormData();
    formData.append('studentId', selectedStudentId);
    formData.append('category', selectedCategory);
    formData.append('amount', customPoints.toString());
    formData.append('note', note);

    startTransition(async () => {
      const res = await awardPointsAction(formData);
      if (res?.error) {
        setFeedback({ message: res.error, type: 'error' });
      } else {
        setFeedback({
          message: `Successfully awarded +${customPoints} points to ${selectedStudent?.name}!`,
          type: 'success',
        });
        setNote('');
      }
    });

  const handleAllocationSubmit = async () => {
    if (!allocationPeriod || !/^\d{4}-\d{2}$/.test(allocationPeriod)) {
      setAllocationFeedback({ message: 'Please enter a valid period (YYYY-MM)', type: 'error' });
      return;
    }
    if (!Number.isInteger(allocationAmount) || allocationAmount < 0) {
      setAllocationFeedback({ message: 'Please enter a valid point amount', type: 'error' });
      return;
    }
    const formData = new FormData();
    formData.append('period', allocationPeriod);
    formData.append('allocatedPoints', allocationAmount.toString());
    const res = await allocateMonthlyPointsAction(formData);
    if (res?.error) {
      setAllocationFeedback({ message: res.error, type: 'error' });
    } else {
      setAllocationFeedback({ message: 'Monthly allocation saved successfully!', type: 'success' });
    }
  };

  const handleRewardCreate = async () => {
    if (!rewardName || rewardName.length > 150) {
      setRewardFeedback({ message: 'Please provide a valid reward name (1-150 characters)', type: 'error' });
      return;
    }
    if (!Number.isInteger(rewardCost) || rewardCost <= 0) {
      setRewardFeedback({ message: 'Point cost must be a positive integer', type: 'error' });
      return;
    }
    if (!Number.isInteger(rewardStock) || rewardStock < 0) {
      setRewardFeedback({ message: 'Stock must be a non-negative integer', type: 'error' });
      return;
    }
    const formData = new FormData();
    formData.append('name', rewardName);
    formData.append('emoji', rewardEmoji);
    formData.append('pointCost', rewardCost.toString());
    formData.append('stock', rewardStock.toString());
    const res = await createRewardAction(formData);
    if (res?.error) {
      setRewardFeedback({ message: res.error, type: 'error' });
    } else {
      setRewardFeedback({ message: 'Reward created successfully!', type: 'success' });
      setRewardName('');
      setRewardEmoji('??');
      setRewardCost(5);
      setRewardStock(0);
    }
  };
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-4">
      {/* Status Warning Banner for Pending/Revoked Teachers */}
      {!isApproved && (
        <div
          className={`p-5 rounded-2xl border flex items-start gap-4 ${
            isPendingStatus
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <h3 className="text-base font-bold">
              {isPendingStatus ? 'Account Pending Approval' : 'Account Access Revoked'}
            </h3>
            <p className="text-sm mt-1">
              {isPendingStatus
                ? 'Your teacher account is currently pending administrator verification. Per school policy, teachers can award points only after admin approval.'
                : 'Your teacher account has been revoked by an administrator. You cannot award points to students.'}
            </p>
            {isPendingStatus && (
              <p className="text-xs mt-2 font-semibold text-amber-700">
                Tip: If testing demo mode, log in as Admin to approve this teacher account!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Hero / Daily Limit Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-medium text-blue-100 mb-3">
              👩‍🏫 Teacher Portal
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome, {teacher.name}!
            </h2>
            <p className="text-blue-100 text-sm mt-1 max-w-lg">
              Recognize student achievements, positive habits, and acts of kindness in 3 clicks.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-white/20">
            <div className="flex justify-between items-center text-xs font-semibold text-blue-100 mb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-300" /> Daily Award Allowance
              </span>
              <span>
                {pointsAwardedToday} / {teacher.dailyAwardLimit} points used today ({remainingDailyLimit} remaining)
              </span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                  dailyPercent > 90 ? 'bg-rose-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-2xl mb-2">
            🏫
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Assigned Classes
            </span>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight my-1">
              {classes.length} {classes.length === 1 ? 'Class' : 'Classes'}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {allStudents.length} total students enrolled
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 w-full text-xs text-slate-500">
            Status:{' '}
            <span
              className={`font-bold ${
                isApproved ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {teacher.teacherStatus}
            </span>
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
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          )}
          {feedback.message}
        </div>
      )}

      {/* 3-CLICK AWARD POINTS INTERFACE */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            Award Points in 3 Clicks
          </h3>
          <p className="text-xs text-slate-500">
            Select a student in your class, pick a category, and confirm the award.
          </p>
        </div>

        <div className="space-y-6">
          {/* STEP 1: PICK STUDENT */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h4 className="text-sm font-bold text-slate-800">
                Click 1: Select Student ({allStudents.length} available)
              </h4>
            </div>

            {classes.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 text-sm text-slate-500 border border-slate-200">
                No classes assigned to your profile yet. Ask an admin to link a class.
              </div>
            ) : (
              <div className="space-y-4">
                {classes.map((cls) => (
                  <div key={cls.id} className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      {cls.name}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                      {cls.students.map((student) => {
                        const isSelected = selectedStudentId === student.id;
                        return (
                          <button
                            key={student.id}
                            type="button"
                            disabled={!isApproved}
                            onClick={() => {
                              setSelectedStudentId(student.id);
                              setFeedback(null);
                            }}
                            className={`p-3 rounded-2xl text-left border transition flex flex-col justify-between ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500/20'
                                : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-800'
                            } ${!isApproved ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <span className="text-xs font-bold truncate">
                              {student.name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono mt-1">
                              ⭐ {student.balance} pts
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STEP 2: PICK CATEGORY */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h4 className="text-sm font-bold text-slate-800">
                Click 2: Choose Category
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {AWARD_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    disabled={!isApproved}
                    onClick={() => handleCategorySelect(cat)}
                    className={`p-4 rounded-2xl border text-left transition flex items-center gap-3.5 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    } ${!isApproved ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-3xl">{cat.emoji}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {cat.label}
                      </div>
                      <div className="text-xs font-black text-indigo-600 mt-0.5">
                        +{cat.defaultPoints} Points
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: OPTIONAL NOTE & CONFIRM (Click 3) */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h4 className="text-sm font-bold text-slate-800">
                Click 3: Confirm & Award Points
              </h4>
            </div>

            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Optional Note / Shoutout
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Excellent presentation on planets!"
                    disabled={!isApproved || isSubmitting}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Point Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, maxAwardForThisClick)}
                    value={customPoints}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10) || 1;
                      setCustomPoints(
                        Math.min(Math.max(1, parsed), Math.max(1, maxAwardForThisClick))
                      );
                    }}
                    disabled={!isApproved || isSubmitting || maxAwardForThisClick <= 0}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Max {MAX_AWARD_POINTS} per award; student cap {STUDENT_DAILY_CAP}/day.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500">
                  {selectedStudent ? (
                    <span>
                      Ready to award{' '}
                      <strong className="text-slate-900 font-semibold">
                        +{customPoints} pts
                      </strong>{' '}
                      to{' '}
                      <strong className="text-slate-900 font-semibold">
                        {selectedStudent.name}
                      </strong>
                    </span>
                  ) : (
                    <span>Please select a student above to enable award</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAwardSubmit}
                  disabled={
                    !isApproved || !selectedStudentId || isSubmitting || maxAwardForThisClick <= 0
                  }
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
                    isApproved &&
                    selectedStudentId &&
                    !isSubmitting &&
                    maxAwardForThisClick > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting
                    ? 'Awarding...'
                    : maxAwardForThisClick <= 0
                      ? 'Daily allowance exhausted'
                      : `Award +${customPoints} Points (Click 3)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Awards by this Teacher */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          Recent Awards Given by You ({recentAwards.length})
        </h3>

        {recentAwards.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-4 text-center">
            You have not awarded any points yet today.
          </p>
        ) : (
          <div className="space-y-2.5">
            {recentAwards.map((award) => (
              <div
                key={award.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {award.student.name}
                    </span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold text-[11px]">
                      {award.category || 'AWARD'}
                    </span>
                  </div>
                  {award.note && (
                    <p className="text-slate-500 mt-1">&quot;{award.note}&quot;</p>
                  )}
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    {new Date(award.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <div className="font-mono font-black text-emerald-600 text-sm">
                  +{award.amount} pts
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

