'use client';

import { useState, useTransition } from 'react';
import { loginAction, demoLoginAction } from '@/app/actions/auth';
import { Sparkles, Shield, User, Lock, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const isDemoMode = true; // Enabled via DEMO_MODE=true
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCredentialsLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await loginAction(formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  const handleDemoClick = (target: 'admin' | 'teacher_approved' | 'teacher_pending' | 'student') => {
    setError(null);
    startTransition(async () => {
      const res = await demoLoginAction(target);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl mx-auto flex items-center justify-center text-white text-3xl shadow-lg shadow-indigo-100 mb-4">
          ⭐
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          SchoolPoints
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Earn points for positive habits, redeem for school supplies!
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-200/80 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  name="username"
                  required
                  placeholder="e.g. admin or student_alice"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <span>{isPending ? 'Logging in...' : 'Sign in to Dashboard'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Demo Mode 1-Click Buttons */}
          {isDemoMode && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Demo 1-Click Login
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Click any role to test permissions and features instantly:
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDemoClick('admin')}
                  className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-left transition"
                >
                  <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    👑 Admin
                  </div>
                  <div className="text-[10px] text-purple-700 font-medium truncate">
                    Principal Vance
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDemoClick('teacher_approved')}
                  className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-left transition"
                >
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    👩‍🏫 Teacher
                  </div>
                  <div className="text-[10px] text-blue-700 font-medium truncate">
                    Ms. Connor (Approved)
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDemoClick('teacher_pending')}
                  className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-left transition"
                >
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    ⏳ Teacher
                  </div>
                  <div className="text-[10px] text-amber-700 font-medium truncate">
                    Mr. Keating (Pending)
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDemoClick('student')}
                  className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-left transition"
                >
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    🎒 Student
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium truncate">
                    Alice Walker (5A)
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          SchoolPoints PoC • Append-only Ledger • Windows Local Proof of Concept
        </p>
      </div>
    </div>
  );
}
