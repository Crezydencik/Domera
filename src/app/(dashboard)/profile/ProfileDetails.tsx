import React from 'react';
import { FiUser, FiMail, FiKey, FiEdit2 } from 'react-icons/fi';

interface ProfileDetailsProps {
  user: {
    displayName: string;
    email: string;
    id: string;
    personalCode: string;
  };
  onEdit: (field: string) => void;
}

export default function ProfileDetails({ user, onEdit }: ProfileDetailsProps) {
  return (
    <div className="bg-white rounded-xl shadow p-6 mt-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-gray-100 rounded-full w-14 h-14 flex items-center justify-center">
          <FiUser className="text-3xl text-gray-500" />
        </div>
        <div>
          <div className="font-bold text-lg text-gray-900 uppercase">{user.displayName}</div>
          <div className="text-gray-500 text-sm">Klienta numurs: {user.id}</div>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        <ProfileRow label="E-pasts" value={user.email} onEdit={() => onEdit('email')} />
        <ProfileRow label="Lietotājvārds" value={user.id} onEdit={() => onEdit('id')} />
        <ProfileRow label="Parole" value={"******"} onEdit={() => onEdit('password')} />
        <ProfileRow label="Personas kods" value={user.personalCode} onEdit={() => onEdit('personalCode')} />
      </div>
    </div>
  );
}

function ProfileRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <div className="text-gray-500 text-sm flex items-center gap-1">
          {label}
        </div>
        <div className="text-gray-900 font-medium text-base mt-1">{value}</div>
      </div>
      <button onClick={onEdit} className="text-blue-600 hover:underline font-medium text-sm flex items-center gap-1">
        Labot <FiEdit2 className="inline-block" />
      </button>
    </div>
  );
}
