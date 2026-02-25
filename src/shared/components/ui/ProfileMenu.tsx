import React, { useState, useRef, useEffect } from 'react';
import { FiUser, FiLogOut } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

export function ProfileMenu({ user, onLogout }: { user: { email: string; displayName?: string; photoURL?: string }, onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 focus:outline-none hover:bg-slate-700 rounded-full px-2 py-1"
        onClick={() => setOpen((v) => !v)}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg">👤</span>
        )}
        <span className="hidden md:block text-white font-medium text-sm">{user.displayName || user.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
          <button
            className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-200 hover:bg-slate-700"
            onClick={() => { setOpen(false); router.push('/dashboard/profile'); }}
          >
            <FiUser /> Профиль
          </button>
          <button
            className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-400 hover:bg-slate-700"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            <FiLogOut /> Выйти
          </button>
        </div>
      )}
    </div>
  );
}
