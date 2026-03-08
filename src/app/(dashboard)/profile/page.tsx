"use client";


import { useAuth } from '@/shared/hooks/useAuth';
import { useEffect, useState } from 'react';
import { getApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import { updateUserProfile } from '@/modules/auth/services/authService';
import { showCustomToast } from '@/shared/components/ui/CustomToast';
import { Switch } from '@/shared/components/ui/Switch';
import Header from '../../../shared/components/layout/heder';
import { useTranslations } from 'next-intl';
import { FiCheck, FiX } from 'react-icons/fi';
import { NotificationItem, NotificationsDropdown } from '../../../shared/components/ui/NotificationsDropdown';


export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  // --- Header helpers ---
  const getUserName = (user: any) => user?.displayName || user?.email || '';
  const getUserAvatar = (user: any) => user?.avatarUrl;
  const handleLogout = () => { window.location.reload(); };
  const t = useTranslations('dashboard.profile');
  const th = useTranslations();
  
  // (Переехало в выпадающее меню уведомлений)
  
  
  // --- Tabs for navigation ---
  const tabs = [
    { label: t('tabs.profile'), key: 'profile' },
    { label: t('tabs.notifications'), key: 'notifications' },
  ];
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    email: user?.email || '',
    displayName: user?.displayName || '',
    phone: user?.phone || '',
    address: user?.address || '',
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
      showCustomToast({ type: 'success', title: t('notificationsSaved') });
    } finally {
      setNotifSaving(false);
      setTimeout(() => setNotifSaved(false), 1200);
    }
  };
  const [profileNotifications, setProfileNotifications] = useState<NotificationItem[]>([]);
    
  useEffect(() => {
    const notifs: NotificationItem[] = [];
    if (user && (!user.phone || !user.displayName)) {
      notifs.push({
        id: 'profile-incomplete',
        type: 'warning',
        title: t('profileIncompleteTitle'),
        message: t('profileIncompleteMessage')
      });
    }
    setProfileNotifications(notifs);
  }, [user]);

  // Сохранять согласие на обработку данных
  const handlePrivacyConsent = async (value: boolean) => {
    setPrivacyConsent(value);
    setPrivacySaving(true);
    setPrivacySaved(false);
    try {
      await updateUserProfile(user.uid, { privacyConsent: value });
      setPrivacySaved(true);
      showCustomToast({ type: 'success', title: t('privacySaved') });
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
      alert(t('deleteRequestSent')); // Временно показываем алерт
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
               {/* Уведомления профиля */}
               {profileNotifications.length > 0 && (
                 <div className="mb-6">
                   <NotificationsDropdown notifications={profileNotifications} open={true} onClose={() => {}} />
                 </div>
               )}
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

  return (
    <div className="min-h-screen bg-neutral-100 py-0">
      <Header
        userName={getUserName(user)}
        userEmail={user?.email}
        userAvatarUrl={getUserAvatar(user)}
        onLogout={handleLogout}
        pageTitle={th('dashboard.sidebar.profile')}
      />
      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Tabs */}
        <div className="bg-white rounded-t-xl px-6 pt-4 border border-b-0 border-neutral-200">
          <nav className="flex gap-2 sm:gap-6 text-sm font-medium">
            {tabs.map((tab, i) => (
                 <button
                   key={tab.key}
                   className={`pt-2 pb-3 px-1 sm:px-2 border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${activeTab === tab.key ? 'border-black text-black font-bold' : 'border-transparent text-neutral-500 hover:text-black hover:border-gray-400'}`}
                   onClick={() => setActiveTab(tab.key)}
                   type="button"
                   tabIndex={0}
                 >
                   {tab.label}
                 </button>
            ))}
          </nav>
        </div>
        {/* Card */}
        <div className="bg-white rounded-b-xl border border-t-0 border-neutral-200 p-0">
          {activeTab === 'profile' && (
            <>
              {/* User header */}
              <div className="flex flex-col items-start sm:flex-row sm:items-center gap-4 px-6 pt-6 pb-2">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-neutral-200 flex items-center justify-center text-3xl text-neutral-500">
                    <span className="sr-only">{t('userAvatar')}</span>
                    <span role="img" aria-label="user">👤</span>
                  </div>
                  <div>
                        <div className="text-lg font-semibold text-black leading-tight">{user ? (user.displayName || user.email) : ''}</div>
                            </div>
                </div>
              </div>
              {/* Section: Person data */}
              <div className="px-6 pt-4 pb-2">j
                <div className="text-lg font-semibold text-black mb-4">{t('personalData')}</div>
                <div className="divide-y divide-neutral-200">
                  {/* Name */}
                  <div className="flex items-center justify-between py-3">
                    <span className="text-neutral-700">{t('name')}</span>
                    <div className="flex items-center gap-4">
                      {editField === 'displayName' ? (
                        <>
                          <input
                            className="border rounded px-2 py-1 text-black font-mono"
                            value={formData.displayName}
                            onChange={e => setFormData(f => ({ ...f, displayName: e.target.value }))}
                            autoFocus
                          />
                          <button
                            className="text-blue-600 text-xl p-1 hover:bg-blue-50 rounded"
                            title={t('profile.save')}
                            onClick={async () => {
                              setProfileSaving(true);
                              await updateUserProfile(user.uid, { displayName: formData.displayName });
                              await refreshUser();
                              setEditField(null);
                              setProfileSaving(false);
                              showCustomToast({ type: 'success', title: t('updated') });
                              setFormData(f => ({ ...f, displayName: formData.displayName }));
                            }}
                            disabled={profileSaving}
                          >
                            <FiCheck />
                          </button>
                          <button
                            className="text-blue-600 text-xl p-1 hover:bg-blue-50 rounded"
                            title={t('profile.cancel')}
                            onClick={() => { setEditField(null); setFormData(f => ({ ...f, displayName: user.displayName || '' })); }}
                            disabled={profileSaving}
                          >
                            <FiX />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-black font-mono">{user ? user.displayName || '' : ''}</span>
                          <button className="text-black underline underline-offset-2 text-sm font-medium" onClick={() => setEditField('displayName')}>Labot</button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Phone */}
                  <div className="flex items-center justify-between py-3">
                    <span className="text-neutral-700">{t('phone')}</span>
                    <div className="flex items-center gap-4">
                      {editField === 'phone' ? (
                        <>
                          <input
                            className="border rounded px-2 py-1 text-black font-mono"
                            value={formData.phone}
                            onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                            autoFocus
                          />
                          <button
                            className="text-blue-600 text-xl p-1 hover:bg-blue-50 rounded"
                            title={t('save')}
                            onClick={async () => {
                              setProfileSaving(true);
                              await updateUserProfile(user.uid, { phone: formData.phone });
                              await refreshUser();
                              setEditField(null);
                              setProfileSaving(false);
                              showCustomToast({ type: 'success', title: t('updated') });
                              setFormData(f => ({ ...f, phone: formData.phone }));
                            }}
                            disabled={profileSaving}
                          >
                            <FiCheck />
                          </button>
                          <button
                            className="text-blue-600 text-xl p-1 hover:bg-blue-50 rounded"
                            title={t('cancel')}
                            onClick={() => { setEditField(null); setFormData(f => ({ ...f, phone: user.phone || '' })); }}
                            disabled={profileSaving}
                          >
                            <FiX />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-black font-mono">{user ? user.phone || '' : ''}</span>
                          <button className="text-black underline underline-offset-2 text-sm font-medium" onClick={() => setEditField('phone')}>Labot</button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Email */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-700">{t('email')}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-black font-mono">{user ? user.email : ''}</span>
                      <button className="text-black underline underline-offset-2 text-sm font-medium">{t('edit')}</button>
                    </div>
                  </div>
                  {/* Address */}
                  <div className="flex items-center justify-between py-3">
                    <span className="text-neutral-700">{t('address')}</span>
                    <div className="flex items-center gap-4">
                      {editField === 'address' ? (
                        <>
                          <input
                            className="border rounded px-2 py-1 text-black font-mono"
                            value={formData.address || ''}
                            onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
                            autoFocus
                          />
                          <button
                            className="text-blue-600 text-xl p-1 hover:bg-blue-50 rounded"
                            title={t('save')}
                            onClick={async () => {
                              setProfileSaving(true);
                              await updateUserProfile(user.uid, { address: formData.address });
                              await refreshUser();
                              setEditField(null);
                              setProfileSaving(false);
                              showCustomToast({ type: 'success', title: t('addressUpdated') });
                              setFormData(f => ({ ...f, address: formData.address }));
                            }}
                            disabled={profileSaving}
                          >
                            <FiCheck />
                          </button>
                          <button
                            className="text-blue-600 text-xl p-1 hover:bg-blue-50 rounded"
                            title={t('cancel')}
                            onClick={() => { setEditField(null); setFormData(f => ({ ...f, address: user.address || '' })); }}
                            disabled={profileSaving}
                          >
                            <FiX />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-black font-mono">{user ? user.address || '' : ''}</span>
                          <button className="text-black underline underline-offset-2 text-sm font-medium" onClick={() => setEditField('address')}>Labot</button>
                        </>
                      )}
                    </div>
                  </div>
                    {/* Password */}
                    <div className="flex items-center justify-between py-3">
                      <span className="text-neutral-700">{t('password')}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-black font-mono">******</span>
                        <button className="text-black underline underline-offset-2 text-sm font-medium">{t('edit')}</button>
                      </div>
                    </div>
                  </div>
                  </div>
                </>)}
         {activeTab === 'notifications' && (
                  <div className="px-6 py-8">
                    <div className="text-lg font-semibold text-black mb-4">{t('notificationSettings')}</div>
                    <div className="space-y-4 mx-auto">
                      {/* <div className="flex items-center justify-between">
                        <span className="text-neutral-700">{t('emailNotifications')}</span>
                        <Switch
                          checked={notif.email}
                          onChange={val => handleNotifChange('email', val)}
                          disabled={notifSaving}
                        />
                      </div> */}
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-700">{t('notification.general')}</span>
                        <Switch
                          checked={notif.general}
                          onChange={val => handleNotifChange('general', val)}
                          disabled={notifSaving}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-700">{t('notification.meterReminder')}</span>
                        <Switch
                          checked={notif.meterReminder}
                          onChange={val => handleNotifChange('meterReminder', val)}
                          disabled={notifSaving}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-700">{t('notification.paymentReminder')}</span>
                        <Switch
                          checked={notif.paymentReminder}
                          onChange={val => handleNotifChange('paymentReminder', val)}
                          disabled={notifSaving}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-700">{t('notification.lang')}</span>
                        <select
                          className="border rounded px-2 py-1 text-black bg-white"
                          value={user?.notifications?.lang || 'ru'}
                          onChange={async (e) => {
                            setNotifSaving(true);
                            setNotifSaved(false);
                            await updateUserProfile(user.uid, { notifications: { ...notif, lang: e.target.value } });
                            setNotifSaved(true);
                            setNotifSaving(false);
                          }}
                          disabled={notifSaving}
                        >
                          <option value="ru">{t('notification.lang_ru')}</option>
                          <option value="lv">{t('notification.lang_lv')}</option>
                          <option value="en">{t('notification.lang_en')}</option>
                        </select>
                      </div>
                      {notifSaved && (
                        <div className="text-green-600 text-sm mt-2">{t('notificationSettingsSaved')}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
          );
        }