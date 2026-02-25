"use client";


import { useAuth } from '@/shared/hooks/useAuth';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import { updateUserProfile } from '@/modules/auth/services/authService';
import { showCustomToast } from '@/shared/components/ui/CustomToast';
import { Switch } from '@/shared/components/ui/Switch';
import { FiEdit2 } from 'react-icons/fi';


export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    email: user?.email || '',
    displayName: user?.displayName || '',
    phone: user?.phone || '',
  });
  const [editField, setEditField] = useState<null | 'displayName' | 'phone'>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // --- Notification and privacy state ---
  const [notif, setNotif] = useState({
    email: user?.notifications?.email ?? true,
    meterReminder: user?.notifications?.meterReminder ?? true,
    paymentReminder: user?.notifications?.paymentReminder ?? true,
    general: user?.notifications?.general ?? true,
  });
  const [privacyConsent, setPrivacyConsent] = useState(user?.privacyConsent ?? false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);

  // Сохранять настройки уведомлений
  const handleNotifChange = async (key: keyof typeof notif, value: boolean) => {
    setNotif((prev) => ({ ...prev, [key]: value }));
    setNotifSaving(true);
    setNotifSaved(false);
    try {
      await updateUserProfile(user.uid, { notifications: { ...notif, [key]: value } });
      setNotifSaved(true);
      showCustomToast({ type: 'success', title: 'Настройки уведомлений сохранены' });
    } finally {
      setNotifSaving(false);
      setTimeout(() => setNotifSaved(false), 1200);
    }
  };

  // Сохранять согласие на обработку данных
  const handlePrivacyConsent = async (value: boolean) => {
    setPrivacyConsent(value);
    setPrivacySaving(true);
    setPrivacySaved(false);
    try {
      await updateUserProfile(user.uid, { privacyConsent: value });
      setPrivacySaved(true);
      showCustomToast({ type: 'success', title: 'Согласие сохранено' });
    } finally {
      setPrivacySaving(false);
      setTimeout(() => setPrivacySaved(false), 1200);
    }
  };

  // Удаление аккаунта (отправка запроса в УК)
  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      // Здесь можно реализовать Firestore-запрос или email-уведомление УК
      // Например, создать документ в коллекции 'deleteRequests'
      // await createDocument('deleteRequests', { uid: user.uid, email: user.email, requestedAt: new Date() });
      alert('Запрос на удаление аккаунта отправлен в УК.');
      setDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Информация о квартире и доме для жильца
  const [apartmentInfo, setApartmentInfo] = useState<{
    number?: string;
    buildingAddress?: string;
    companyName?: string;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchInfo() {
      if (user?.role === 'Resident' && user.apartmentId) {
        const apartment = await getApartment(user.apartmentId);
        if (apartment && apartment.buildingId) {
          const building = await getBuilding(apartment.buildingId);
          if (!ignore) {
            setApartmentInfo({
              number: apartment.number,
              buildingAddress: building?.address,
              companyName: building?.managedBy?.companyName,
            });
          }
        } else if (!ignore) {
          setApartmentInfo(null);
        }
      } else if (!ignore) {
        setApartmentInfo(null);
      }
    }
    fetchInfo();
    return () => {
      ignore = true;
    };
  }, [user]);

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
      showCustomToast({ type: 'success', title: 'Профиль обновлён' });
      setEditField(null);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Интеграция с updateProfile
    console.log('Update profile:', formData);
  };

  if (loading) {
    return <div className="text-white">Загрузка...</div>;
  }

  if (!user) {
    return <div className="text-white">Требуется вход</div>;
  }

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
            <p className="text-gray-400 text-sm mt-2">
              {user.role === 'Resident' ? 'Жилец' : user.role === 'ManagementCompany' ? 'Управляющая компания' : user.role}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm">Email</p>
                <p className="text-white">{user.email}</p>
              </div>
              {/* ID аккаунта убран по требованию */}
              {/* Роль убрана по требованию */}
              {user.role === 'Resident' && (
                <>
                  <div>
                    <p className="text-gray-400 text-sm">Квартира</p>
                    <p className="text-white">{apartmentInfo?.number || '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Дом</p>
                    <p className="text-white">{apartmentInfo?.buildingAddress || '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Управляющая компания</p>
                    <p className="text-white">{apartmentInfo?.companyName || '—'}</p>
                  </div>
                </>
              )}
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
                  <span className="text-lg font-semibold text-white">Настройки уведомлений</span>
                </div>
                <div className="flex flex-col divide-y divide-slate-700 bg-slate-800 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between py-3 px-2">
                    <div>
                      <div className="text-base text-gray-200 font-medium">Email уведомления</div>
                      <div className="text-xs text-gray-400">Получать все важные сообщения на почту</div>
                    </div>
                    <Switch checked={notif.email} onChange={v => handleNotifChange('email', v)} disabled={notifSaving} />
                  </div>
                  <div className="flex items-center justify-between py-3 px-2">
                    <div>
                      <div className="text-base text-gray-200 font-medium">Напоминание о сдаче показаний</div>
                      <div className="text-xs text-gray-400">Напоминать о необходимости передать показания счетчиков</div>
                    </div>
                    <Switch checked={notif.meterReminder} onChange={v => handleNotifChange('meterReminder', v)} disabled={notifSaving} />
                  </div>
                  <div className="flex items-center justify-between py-3 px-2">
                    <div>
                      <div className="text-base text-gray-200 font-medium">Напоминание об оплате</div>
                      <div className="text-xs text-gray-400">Напоминать о необходимости оплатить счета</div>
                    </div>
                    <Switch checked={notif.paymentReminder} onChange={v => handleNotifChange('paymentReminder', v)} disabled={notifSaving} />
                  </div>
                  <div className="flex items-center justify-between py-3 px-2">
                    <div>
                      <div className="text-base text-gray-200 font-medium">Общедомовые уведомления</div>
                      <div className="text-xs text-gray-400">Важные объявления от управляющей компании</div>
                    </div>
                    <Switch checked={notif.general} onChange={v => handleNotifChange('general', v)} disabled={notifSaving} />
                  </div>
                </div>
              </div>
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
                  {user.role === 'ManagementCompany' ? (
                    <div className="text-red-400 text-base font-semibold mt-2">Для удаления аккаунта обратитесь к администратору платформы</div>
                  ) : (
                    <button type="button" onClick={() => setDeleteModal(true)} className="block text-red-400 hover:underline text-base font-semibold mt-2 disabled:opacity-60" disabled={notifSaving || privacySaving}>Удалить аккаунт (запрос в УК)</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Модальное окно подтверждения удаления аккаунта */}
        {deleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 max-w-sm w-full text-center">
              <h3 className="text-xl font-bold text-white mb-4">Удалить аккаунт?</h3>
              <p className="text-gray-300 mb-6">Вы уверены, что хотите отправить запрос на удаление аккаунта в управляющую компанию?</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => setDeleteModal(false)} className="px-4 py-2 rounded bg-slate-700 text-gray-200">Отмена</button>
                <button onClick={handleDeleteAccount} disabled={deleteLoading} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">{deleteLoading ? 'Отправка...' : 'Удалить'}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
