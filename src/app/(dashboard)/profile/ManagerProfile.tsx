"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from 'next-intl';
import { updateUserProfile } from "@/modules/auth/services/authService";
import { showCustomToast } from "@/shared/components/ui/CustomToast";
import { FiEdit2 } from "react-icons/fi";

export default function ManagerProfile({ user }: { user: any }) {
  const t = useTranslations();
  const [formData, setFormData] = useState({
    email: user?.email || '',
    displayName: user?.displayName || '',
    phone: user?.phone || '',
  });
  const [editField, setEditField] = useState<null | 'displayName' | 'phone'>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(user?.privacyConsent ?? false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: formData.displayName,
        phone: formData.phone,
      });
      showCustomToast({ type: 'success', title: t('auth.alert.profileUpdated') });
      setEditField(null);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePrivacyConsent = async (value: boolean) => {
    setPrivacyConsent(value);
    setPrivacySaving(true);
    setPrivacySaved(false);
    try {
      await updateUserProfile(user.uid, { privacyConsent: value });
      setPrivacySaved(true);
      showCustomToast({ type: 'success', title: t('auth.alert.consentSaved') });
    } finally {
      setPrivacySaving(false);
      setTimeout(() => setPrivacySaved(false), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">
            ← Вернуться
          </Link>
          <h1 className="text-2xl font-bold text-white">Профиль</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <div className="text-center mb-8">
            <div className="text-5xl bg-blue-600 text-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              👤
            </div>
            <h2 className="text-xl font-bold text-white">{user.email}</h2>
            <p className="text-gray-400 text-sm mt-2">Управляющая компания</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm">Email</p>
                <p className="text-white">{user.email}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1 flex items-center gap-2">
                  Имя
                  {editField !== 'displayName' && (
                    <button type="button" className="ml-1 text-blue-400 hover:text-blue-300" onClick={() => setEditField('displayName')} title="Редактировать">
                      <FiEdit2 size={16} />
                    </button>
                  )}
                </p>
                {editField === 'displayName' ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleChange}
                      className="px-3 py-1 rounded bg-slate-700 border border-slate-600 text-white"
                      autoFocus
                      disabled={profileSaving}
                    />
                    <button type="button" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={handleProfileSave} disabled={profileSaving || !formData.displayName.trim()}>
                      Сохранить
                    </button>
                    <button type="button" className="text-gray-400 hover:text-gray-200" onClick={() => setEditField(null)} disabled={profileSaving}>Отмена</button>
                  </div>
                ) : (
                  <p className="text-white text-lg">{formData.displayName || 'Не указано'}</p>
                )}
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1 flex items-center gap-2">
                  Телефон
                  {editField !== 'phone' && (
                    <button type="button" className="ml-1 text-blue-400 hover:text-blue-300" onClick={() => setEditField('phone')} title="Редактировать">
                      <FiEdit2 size={16} />
                    </button>
                  )}
                </p>
                {editField === 'phone' ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="px-3 py-1 rounded bg-slate-700 border border-slate-600 text-white"
                      autoFocus
                      disabled={profileSaving}
                    />
                    <button type="button" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={handleProfileSave} disabled={profileSaving}>
                      Сохранить
                    </button>
                    <button type="button" className="text-gray-400 hover:text-gray-200" onClick={() => setEditField(null)} disabled={profileSaving}>Отмена</button>
                  </div>
                ) : (
                  <p className="text-white text-lg">{formData.phone || 'Не указано'}</p>
                )}
              </div>
            </div>
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-400 text-lg">◆</span>
                  <span className="text-lg font-semibold text-white">Конфиденциальность</span>
                </div>
                <div className="space-y-4 ml-2">
                  <label className="flex items-center gap-3 text-gray-200 text-base cursor-pointer">
                    <input type="checkbox" checked={privacyConsent} disabled={privacySaving} onChange={e => handlePrivacyConsent(e.target.checked)} className="accent-blue-500 w-5 h-5" />
                    <span>
                      Согласие на обработку данных
                      <span className="block text-xs text-gray-400">Вы соглашаетесь с условиями обработки персональных данных</span>
                    </span>
                  </label>
                  <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="block text-blue-400 hover:underline text-base">Политика конфиденциальности</a>
                  <div className="text-red-400 text-base font-semibold mt-2">Для удаления аккаунта обратитесь к администратору платформы</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
