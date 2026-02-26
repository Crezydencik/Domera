import React from 'react'

import Link from 'next/link';

interface HeaderProps {
  userName?: string;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ userName, onLogout }) => {
  return (
    <header className="bg-slate-800 border-b border-slate-700 w-full">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-white font-bold text-xl tracking-wide">
            <span className="mr-2">🏢</span> Domera
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {userName && (
            <span className="text-gray-300">{userName}</span>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition"
            >
              Выйти
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
