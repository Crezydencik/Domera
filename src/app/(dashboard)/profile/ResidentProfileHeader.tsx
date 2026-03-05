"use client";

export default function ResidentProfileHeader({ user }: { user: any }) {
  return (
    <div className="flex flex-col items-start sm:flex-row sm:items-center gap-4 px-6 pt-6 pb-2">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-neutral-200 flex items-center justify-center text-3xl text-neutral-500">
          <span className="sr-only">User avatar</span>
          <span role="img" aria-label="user">👤</span>
        </div>
        <div>
          <div className="text-lg font-semibold text-black leading-tight">{user.displayName || user.email}</div>
          <div className="text-neutral-500 text-sm">Klienta numurs: <span className="font-mono">{user.uid || '—'}</span></div>
        </div>
      </div>
    </div>
  );
}
