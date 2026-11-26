'use client';

import { useState, useTransition } from 'react';
import { logoutAction, demoLoginAction } from '@/app/actions/auth';
import { Role } from '@/lib/types';
import { LogOut, UserCheck } from 'lucide-react';

interface NavbarProps {
  demoMode?: boolean;
  user: {
    userId: string;
    username: string;
    role: Role;
    name: string;
  };
}

export function Navbar({ user, demoMode = false }: NavbarProps) {
  const [isPending, startTransition] = useTransition();
  const [demoPending, setDemoPending] = useState(false);

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };


  const handleDemoSwitch = async (
    target: 'admin' | 'teacher_approved' | 'teacher_pending' | 'student'
  ) => {
    setDemoPending(true);
    try {
      await demoLoginAction(target);
    } catch {
      // Redirects from server actions surface as exceptions in the client.
    } finally {
      setDemoPending(false);
    }
  };

  const roleColors: Record<Role, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    TEACHER: 'bg-blue-100 text-blue-800 border-blue-200',
    STUDENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-md">
            ⭐
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              SchoolPoints
              <span className="text-xs px-2 py-0.5 font-medium bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                PoC
              </span>
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">Positive Student Rewards System</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* User info */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${roleColors[user.role]}`}
            >
              {user.role}
            </span>
            <span className="text-sm font-medium text-slate-700 hidden md:inline">
              {user.name}
            </span>
          </div>


          {demoMode && (
            <div className="hidden xl:flex items-center gap-1.5 pl-3 border-l border-slate-200">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Switch:
              </span>
              <button
                type="button"
                disabled={demoPending}
                onClick={() => handleDemoSwitch('admin')}
                className={`text-xs px-2 py-1 rounded border transition disabled:opacity-60 ${
                  user.role === 'ADMIN'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                disabled={demoPending}
                onClick={() => handleDemoSwitch('teacher_approved')}
                className={`text-xs px-2 py-1 rounded border transition disabled:opacity-60 ${
                  user.username === 'teacher_sarah'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Teacher
              </button>
              <button
                type="button"
                disabled={demoPending}
                onClick={() => handleDemoSwitch('teacher_pending')}
                className={`text-xs px-2 py-1 rounded border transition disabled:opacity-60 ${
                  user.username === 'teacher_john'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                disabled={demoPending}
                onClick={() => handleDemoSwitch('student')}
                className={`text-xs px-2 py-1 rounded border transition disabled:opacity-60 ${
                  user.role === 'STUDENT'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Student
              </button>
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-slate-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
