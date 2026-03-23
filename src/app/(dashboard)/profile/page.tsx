"use client";

import { useAuth } from '@/shared/hooks/useAuth';
import type { User } from '@/shared/types';
import { useEffect, useState } from 'react';
import { getApartment } from '@/modules/apartments/services/apartmentsService';
import { getBuilding } from '@/modules/invoices/services/buildings/services/buildingsService';
import { updateUserProfile } from '@/modules/auth/services/authService';
import { logout } from '@/modules/auth/services/authService';
import { getCompany, updateCompany } from '@/modules/company/services/companyService';
import type { Company } from '@/shared/types';
import { showCustomToast } from '@/shared/components/ui/CustomToast';
import { Switch } from '@/shared/components/ui/Switch';
import Header from '../../../shared/components/layout/heder';
import { useTranslations } from 'next-intl';
import { FiCheck, FiX } from 'react-icons/fi';
import React from 'react';
import { usePageTitle } from '../../../shared/context/PageTitleContext';

type EditableFieldRowProps = {
  label: string;
  isEditing: boolean;
  inputValue: string;
  displayValue: string;
  isSaving: boolean;
  onValueChange: (value: string) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onStartEdit: () => void;
};

function EditableFieldRow({
  label,
  isEditing,
  inputValue,
  displayValue,
  isSaving,
  onValueChange,
  onSave,
  onCancel,
  onStartEdit,
}: EditableFieldRowProps) {
  const ts = useTranslations('system');
  const t = useTranslations('dashboard');
   
    const { setPageTitle } = usePageTitle();
    React.useEffect(() => { setPageTitle(t('sidebar.profile')); }, [setPageTitle]);

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-neutral-700">{label}</span>
      <div className="flex items-center gap-4">
        {isEditing ? (
          <>
            <input
              className="border rounded px-2 py-1 text-black font-mono"
              value={inputValue}
              onChange={(e) => onValueChange(e.target.value)}
              autoFocus
            />
            <button
              className="text-blue-600 text-xl p-1 hover:bg-blue-50 rounded"
              title={ts('button.save')}
              onClick={onSave}
              disabled={isSaving}
            >
              <FiCheck />
            </button>
            <button
              className="text-blue-600 text-xl p-1 hover:bg-blue-50 rounded"
              title={ts('button.cancel')}
              onClick={onCancel}
              disabled={isSaving}
            >
              <FiX />
            </button>
          </>
        ) : (
          <>
            <span className="text-black font-mono">{displayValue}</span>
            <button
              className="text-black underline underline-offset-2 text-sm font-medium"
              onClick={onStartEdit}
            >
              {ts('button.change')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const getUserName = (u: User | null) => u?.displayName || u?.name || u?.email || '';
  const getDisplayName = (u: User | null) => u?.displayName || u?.name || '';
  const getFieldValue = (value?: string) => value?.trim() || '—';
  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const t = useTranslations('dashboard.profile');
  const th = useTranslations();
  const ts = useTranslations('system');

  const tabs = [
    { label: t('tabs.profile'), key: 'profile' },
    { label: t('tabs.notifications'), key: 'notifications' },
    ...(user?.role === 'ManagementCompany' ? [{ label: t('tabs.company'), key: 'company' }] : []),
  ];

  const [activeTab, setActiveTab] = useState('profile');
  const [editField, setEditField] = useState<null | 'displayName' | 'phone' | 'address'>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [editCompanyField, setEditCompanyField] = useState<null | 'name' | 'address' | 'phone' | 'email'>(null);
  const [companySaving, setCompanySaving] = useState(false);

  const [notif, setNotif] = useState({
    email: user?.notifications?.email ?? true,
    meterReminder: user?.notifications?.meterReminder ?? true,
    paymentReminder: user?.notifications?.paymentReminder ?? true,
    general: user?.notifications?.general ?? true,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  const [formData, setFormData] = useState({
    email: user?.email || '',
    displayName: user?.displayName || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        displayName: user.displayName || user.name || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

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

  useEffect(() => {
    if (user?.role === 'ManagementCompany' && user.companyId) {
      getCompany(user.companyId).then((c) => {
        if (c) {
          setCompany(c);
          setCompanyForm({
            name: c.name || '',
            address: c.address || '',
            phone: c.phone || '',
            email: c.email || '',
          });
        }
      });
    }
  }, [user]);

  const [, setApartmentInfo] = useState<{
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

  return (
    <div className="min-h-screen bg-neutral-100 py-0">

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white rounded-t-xl px-6 pt-4 border border-b-0 border-neutral-200">
          <nav className="flex gap-2 sm:gap-6 text-sm font-medium">
            {tabs.map((tab) => (
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

        <div className="bg-white rounded-b-xl border border-t-0 border-neutral-200 p-0">
          {activeTab === 'profile' && (
            <>
              <div className="flex flex-col items-start sm:flex-row sm:items-center gap-4 px-6 pt-6 pb-2">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-neutral-200 flex items-center justify-center text-3xl text-neutral-500">
                    <span className="sr-only">{t('userAvatar')}</span>
                    <span role="img" aria-label="user">👤</span>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-black leading-tight">
                      {user ? (getDisplayName(user) || user.email) : ''}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pt-4 pb-2">
                <div className="text-lg font-semibold text-black mb-4">{t('personalData')}</div>
                <div className="divide-y divide-neutral-200">
                  <EditableFieldRow
                    label={ts('form.fullname')}
                    isEditing={editField === 'displayName'}
                    inputValue={formData.displayName}
                    displayValue={user ? getFieldValue(getDisplayName(user)) : '—'}
                    isSaving={profileSaving}
                    onValueChange={(value) => setFormData((f) => ({ ...f, displayName: value }))}
                    onSave={async () => {
                      setProfileSaving(true);
                      await updateUserProfile(user.uid, { displayName: formData.displayName });
                      await refreshUser();
                      setEditField(null);
                      setProfileSaving(false);
                      showCustomToast({ type: 'success', title: ts('updated') });
                      setFormData((f) => ({ ...f, displayName: formData.displayName }));
                    }}
                    onCancel={() => {
                      setEditField(null);
                      setFormData((f) => ({ ...f, displayName: user.displayName || '' }));
                    }}
                    onStartEdit={() => setEditField('displayName')}
                  />

                  <EditableFieldRow
                    label={ts('form.phone')}
                    isEditing={editField === 'phone'}
                    inputValue={formData.phone}
                    displayValue={user ? getFieldValue(user.phone) : '—'}
                    isSaving={profileSaving}
                    onValueChange={(value) => setFormData((f) => ({ ...f, phone: value }))}
                    onSave={async () => {
                      setProfileSaving(true);
                      await updateUserProfile(user.uid, { phone: formData.phone });
                      await refreshUser();
                      setEditField(null);
                      setProfileSaving(false);
                      showCustomToast({ type: 'success', title: t('updated') });
                      setFormData((f) => ({ ...f, phone: formData.phone }));
                    }}
                    onCancel={() => {
                      setEditField(null);
                      setFormData((f) => ({ ...f, phone: user.phone || '' }));
                    }}
                    onStartEdit={() => setEditField('phone')}
                  />

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-700">{t('email')}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-black font-mono">{user ? getFieldValue(user.email) : '—'}</span>
                    </div>
                  </div>

                  <EditableFieldRow
                    label={t('address')}
                    isEditing={editField === 'address'}
                    inputValue={formData.address || ''}
                    displayValue={user ? getFieldValue(user.address) : '—'}
                    isSaving={profileSaving}
                    onValueChange={(value) => setFormData((f) => ({ ...f, address: value }))}
                    onSave={async () => {
                      setProfileSaving(true);
                      await updateUserProfile(user.uid, { address: formData.address });
                      await refreshUser();
                      setEditField(null);
                      setProfileSaving(false);
                      showCustomToast({ type: 'success', title: t('addressUpdated') });
                      setFormData((f) => ({ ...f, address: formData.address }));
                    }}
                    onCancel={() => {
                      setEditField(null);
                      setFormData((f) => ({ ...f, address: user.address || '' }));
                    }}
                    onStartEdit={() => setEditField('address')}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'company' && company && (
            <div className="px-6 pt-6 pb-8">
              <div className="text-lg font-semibold text-black mb-4">{t('company.companyData')}</div>
              <div className="divide-y divide-neutral-200">
                <EditableFieldRow
                  label={t('company.name')}
                  isEditing={editCompanyField === 'name'}
                  inputValue={companyForm.name}
                  displayValue={company.name || '—'}
                  isSaving={companySaving}
                  onValueChange={(v) => setCompanyForm((f) => ({ ...f, name: v }))}
                  onSave={async () => {
                    setCompanySaving(true);
                    await updateCompany(company.id, { name: companyForm.name });
                    setCompany((c) => c ? { ...c, name: companyForm.name } : c);
                    setEditCompanyField(null);
                    setCompanySaving(false);
                    showCustomToast({ type: 'success', title: t('company.updated') });
                  }}
                  onCancel={() => { setEditCompanyField(null); setCompanyForm((f) => ({ ...f, name: company.name || '' })); }}
                  onStartEdit={() => setEditCompanyField('name')}
                />
                <EditableFieldRow
                  label={t('company.address')}
                  isEditing={editCompanyField === 'address'}
                  inputValue={companyForm.address}
                  displayValue={company.address || '—'}
                  isSaving={companySaving}
                  onValueChange={(v) => setCompanyForm((f) => ({ ...f, address: v }))}
                  onSave={async () => {
                    setCompanySaving(true);
                    await updateCompany(company.id, { address: companyForm.address });
                    setCompany((c) => c ? { ...c, address: companyForm.address } : c);
                    setEditCompanyField(null);
                    setCompanySaving(false);
                    showCustomToast({ type: 'success', title: t('company.updated') });
                  }}
                  onCancel={() => { setEditCompanyField(null); setCompanyForm((f) => ({ ...f, address: company.address || '' })); }}
                  onStartEdit={() => setEditCompanyField('address')}
                />
                <EditableFieldRow
                  label={t('company.phone')}
                  isEditing={editCompanyField === 'phone'}
                  inputValue={companyForm.phone}
                  displayValue={company.phone || '—'}
                  isSaving={companySaving}
                  onValueChange={(v) => setCompanyForm((f) => ({ ...f, phone: v }))}
                  onSave={async () => {
                    setCompanySaving(true);
                    await updateCompany(company.id, { phone: companyForm.phone });
                    setCompany((c) => c ? { ...c, phone: companyForm.phone } : c);
                    setEditCompanyField(null);
                    setCompanySaving(false);
                    showCustomToast({ type: 'success', title: t('company.updated') });
                  }}
                  onCancel={() => { setEditCompanyField(null); setCompanyForm((f) => ({ ...f, phone: company.phone || '' })); }}
                  onStartEdit={() => setEditCompanyField('phone')}
                />
                <EditableFieldRow
                  label={t('company.email')}
                  isEditing={editCompanyField === 'email'}
                  inputValue={companyForm.email}
                  displayValue={company.email || '—'}
                  isSaving={companySaving}
                  onValueChange={(v) => setCompanyForm((f) => ({ ...f, email: v }))}
                  onSave={async () => {
                    setCompanySaving(true);
                    await updateCompany(company.id, { email: companyForm.email });
                    setCompany((c) => c ? { ...c, email: companyForm.email } : c);
                    setEditCompanyField(null);
                    setCompanySaving(false);
                    showCustomToast({ type: 'success', title: t('company.updated') });
                  }}
                  onCancel={() => { setEditCompanyField(null); setCompanyForm((f) => ({ ...f, email: company.email || '' })); }}
                  onStartEdit={() => setEditCompanyField('email')}
                />
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="px-6 py-8">
              <div className="text-lg font-semibold text-black mb-4">{t('notificationSettings')}</div>
              <div className="space-y-4 mx-auto">
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
                    value={user?.preferredLang || 'ru'}
                    onChange={async (e) => {
                      setNotifSaving(true);
                      setNotifSaved(false);
                      await updateUserProfile(user.uid, { preferredLang: e.target.value as 'lv' | 'ru' });
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
