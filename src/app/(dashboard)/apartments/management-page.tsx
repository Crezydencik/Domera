'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApartmentsByCompany, createApartment, deleteApartment, unassignResidentFromApartment } from '@/modules/apartments/services/apartmentsService';
import { logout } from '@/modules/auth/services/authService';
import { getBuildingsByCompany } from '@/modules/invoices/services/buildings/services/buildingsService';
import { revokeInvitation } from '@/modules/invitations/services/invitationsService';
import { doc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/shared/hooks/useAuth';
import { useTranslations } from 'next-intl';
import Header from '@/shared/components/layout/heder';
import { ConfirmationDialog } from '@/shared/components/ui/ConfirmationDialog';
import type { Apartment, Building, Invitation, InvitationGdprMeta } from '@/shared/types';
type SelectedInvitation = Invitation & { sentAt?: Date };
type SelectedApartment = Apartment & { invitations?: SelectedInvitation[] };
import { ApartmentModal } from '@/shared/components/apartments/ApartmentModal';
import { ImportApartmentsModal } from '@/shared/components/apartments/ImportApartmentsModal';
import { toast } from 'react-toastify';
import { toSafeErrorDetails } from '@/shared/lib/safeLog';

export default function ApartmentsManagementPage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', toSafeErrorDetails(error));
      toast.error(t('auth.alert.logoutError'));
    }
  };

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddingApartment, setIsAddingApartment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApartmentFilterId, setSelectedApartmentFilterId] = useState<string>('all');
  const [showGlobalInvite, setShowGlobalInvite] = useState(false);
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false);
  const [bulkInviting, setBulkInviting] = useState(false);
  const [bulkSelectedApartmentIds, setBulkSelectedApartmentIds] = useState<string[]>([]);
  const [bulkStatusSortMode, setBulkStatusSortMode] = useState<'default' | 'occupiedFirst' | 'notOccupiedFirst'>('default');
  const [globalInviteEmail, setGlobalInviteEmail] = useState('');
  const [globalInviteApartmentId, setGlobalInviteApartmentId] = useState<string | undefined>(undefined);
  const [invitedApartmentIds, setInvitedApartmentIds] = useState<string[]>([]);
  const [pendingInvitationByApartmentId, setPendingInvitationByApartmentId] = useState<Record<string, string>>({});
  const [newApartment, setNewApartment] = useState({
    number: '',
    buildingId: '',
  });
  const [selectedApartment, setSelectedApartment] = useState<SelectedApartment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [apartmentPendingDelete, setApartmentPendingDelete] = useState<Apartment | null>(null);
  const [isDeletingApartment, setIsDeletingApartment] = useState(false);
  // metersByApartmentId removed — not used in current list layout
  // kept import/getMetersByApartment for potential future use

  // Вынес fetchData наружу, чтобы можно было вызывать после добавления квартиры
  const fetchData = async () => {
    try {
      const currentCompanyId = user?.companyId?.trim();
      if (!currentCompanyId) {
        setApartments([]);
        setBuildings([]);
        return;
      }

      const [apartmentData, buildingData] = await Promise.all([
        getApartmentsByCompany(currentCompanyId),
        getBuildingsByCompany(currentCompanyId),
      ]);

      const tenantBuildings = buildingData.filter((building) => {
        const managedCompanyId =
          typeof building.companyId === 'string'
            ? building.companyId
            : (building.managedBy?.companyId ?? '');
        return managedCompanyId === currentCompanyId;
      });

      const tenantBuildingIds = new Set(tenantBuildings.map((building) => building.id));

      const tenantApartments = apartmentData.filter((apartment) => {
        const hasCompany = Array.isArray(apartment.companyIds) && apartment.companyIds.includes(currentCompanyId);
        return hasCompany || tenantBuildingIds.has(apartment.buildingId);
      });

      setApartments(
        tenantApartments.map(ap => ({
          ...ap,
          companyIds: Array.isArray(ap.companyIds) ? ap.companyIds : [],
        })) 
      );
      // (meters loading removed — not needed in this view)
      setBuildings(
        tenantBuildings.map((building) => ({
          ...building,
          name: building.name || "Unnamed Building",
          apartmentIds: building.apartmentIds || [],
        }))
      );
    } catch (error) {
      console.error('Error fetching data:', toSafeErrorDetails(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.companyId]);

  // subscribe to invitations so we can hide apartments that already have invites in the global invite selector
  useEffect(() => {
    if (!user?.companyId) {
      setInvitedApartmentIds([]);
      setPendingInvitationByApartmentId({});
      return;
    }

    const invitationsCollection = collection(db, 'invitations');
    const invitationsQuery = query(invitationsCollection, where('companyId', '==', user.companyId));
    const unsub = onSnapshot(invitationsQuery, (qs) => {
      const pendingByApartment: Record<string, string> = {};
      const ids = Array.from(new Set(qs.docs
        .map(d => {
          const data = d.data() as Record<string, unknown>;
          const status = typeof data.status === 'string' ? data.status.toLowerCase() : '';
          if (status !== 'pending') return undefined;
          const apartmentId = typeof data.apartmentId === 'string' ? data.apartmentId : undefined;
          if (apartmentId && !pendingByApartment[apartmentId]) {
            pendingByApartment[apartmentId] = d.id;
          }
          return apartmentId;
        })
        .filter(Boolean)));
      setInvitedApartmentIds(ids as string[]);
      setPendingInvitationByApartmentId(pendingByApartment);
    });
    return () => unsub();
  }, [user?.companyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-blue-500 border-t-blue-300 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  const handleAddApartment = async () => {
    try {
      const currentCompanyId = user?.companyId?.trim();
      if (!currentCompanyId) {
        toast.error(t('auth.alert.managementCompanyDetectError'));
        return;
      }

      // companyId УК только из выбранного дома
      const selectedBuilding = buildings.find(b => b.id === newApartment.buildingId);
      // Проверка: нельзя добавить квартиру с уже существующим номером в этом доме
      const duplicate = apartments.some(
        (ap) => ap.buildingId === newApartment.buildingId && ap.number === newApartment.number
      );
      if (duplicate) {
        toast.error(t('auth.alert.apartmentDuplicateInBuilding'));
        return;
      }
      if (!selectedBuilding) {
        toast.error(t('auth.alert.selectedBuildingCompanyIdMissing'));
        return;
      }

      await createApartment({
        buildingId: newApartment.buildingId,
        number: newApartment.number,
      }, currentCompanyId);

      setNewApartment({ number: '', buildingId: '' });
      setIsAddingApartment(false);
      toast.success(t('auth.alert.apartmentAdded'));
      // meters loading skipped here
      // Обновляем данные после добавления квартиры
      await fetchData();
    } catch (error) {
      console.error('Error adding apartment:', toSafeErrorDetails(error));
      toast.error(t('auth.alert.apartmentAddError'));
    }
  };

  const requestDeleteApartment = (apartment: Apartment) => {
    setApartmentPendingDelete(apartment);
  };

  const handleDeleteApartment = async () => {
    if (!apartmentPendingDelete) {
      return;
    }

    try {
      setIsDeletingApartment(true);
      await deleteApartment(apartmentPendingDelete.id);
      setApartments((prev) => prev.filter((apartment) => apartment.id !== apartmentPendingDelete.id));
      if (selectedApartment?.id === apartmentPendingDelete.id) {
        setSelectedApartment(null);
        setIsModalOpen(false);
      }
      setApartmentPendingDelete(null);
      toast.success(t('auth.alert.apartmentDeleted'));
    } catch (error) {
      console.error('Error deleting apartment:', toSafeErrorDetails(error));
      toast.error(t('auth.alert.apartmentDeleteError'));
    } finally {
      setIsDeletingApartment(false);
    }
  };

  const handleUnassignResidentFor = async (apartmentId: string) => {
    if (!window.confirm(t('auth.alert.removeResidentConfirm'))) return;
    try {
      const apt = apartments.find((a) => a.id === apartmentId);
      if (!apt || !apt.residentId) {
        toast.info(t('auth.alert.noResidentLinked'));
        return;
      }

      await unassignResidentFromApartment(apartmentId);
      setApartments((prev) => prev.map((ap) => (ap.id === apartmentId ? { ...ap, residentId: undefined, tenants: [] } : ap)));
      toast.success(t('auth.alert.residentRemovedFromApartment'));
    } catch (error) {
      console.error('Error unassigning resident:', toSafeErrorDetails(error));
      toast.error(t('auth.alert.residentRemoveError'));
    }
  };

  const handleOpenModal = (apartment: Apartment) => {
    const apartmentDoc = doc(db, 'apartments', apartment.id);
    const invitationsCollection = collection(db, 'invitations');

    const unsubscribeApartment = onSnapshot(apartmentDoc, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const apartmentData = docSnapshot.data();
        setSelectedApartment({
          ...apartment,
          ...apartmentData,
        });
      } else {
        console.error('Apartment not found in Firestore');
        setIsModalOpen(false);
      }
    });

    const unsubscribeInvitations = onSnapshot(
      query(invitationsCollection, where('apartmentId', '==', apartment.id)),
      (querySnapshot) => {
        const convert = (v: unknown): Date | undefined => {
          if (!v) return undefined;
          // Firestore Timestamp has toDate(), otherwise could be ISO string or number
          if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate?: unknown }).toDate === 'function') {
            return (v as { toDate: () => Date }).toDate();
          }
          if (typeof v === 'string' || typeof v === 'number') return new Date(v as string | number);
          if (v instanceof Date) return v;
          return undefined;
        };

        const invitations: SelectedInvitation[] = querySnapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            apartmentId: data.apartmentId as string,
            email: data.email as string,
            status: (data.status as Invitation['status']) || 'pending',
            token: (data.token as string) || '',
            createdAt: (convert(data.createdAt) || new Date()) as Date,
            expiresAt: convert(data.expiresAt),
            invitedByUid: data.invitedByUid as string | undefined,
            acceptedAt: convert(data.acceptedAt),
            revokedAt: convert(data.revokedAt),
            gdpr: data.gdpr as InvitationGdprMeta | undefined,
            permissions: data.permissions as Invitation['permissions'] | undefined,
            sentAt: convert(data.sentAt),
          } as SelectedInvitation;
        });

        setSelectedApartment((prev) => prev ? { ...prev, invitations } : null);
      }
    );

    setIsModalOpen(true);

    // Cleanup listeners when modal is closed
    return () => {
      unsubscribeApartment();
      unsubscribeInvitations();
    };
  };

  const handleCloseModal = () => {
    setSelectedApartment(null);
    setIsModalOpen(false);
  };
 
  const handleUnassignResident = async () => {
    if (!selectedApartment) return;
    try {
      await unassignResidentFromApartment(selectedApartment.id);
      setApartments((prev) => {
        const updatedApartments = prev.map((apartment) =>
          apartment.id === selectedApartment.id
            ? { ...apartment, residentId: undefined, tenants: [] }
            : apartment
        );
        return updatedApartments;
      });
    } catch (error) {
      console.error('Error unassigning resident:', toSafeErrorDetails(error));
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!window.confirm(t('auth.alert.cancelInvitationConfirm'))) {
      return;
    }

    try {
      await revokeInvitation(invitationId);
      setSelectedApartment(null);
      setIsModalOpen(false);
      toast.success(t('auth.alert.invitationCancelledSuccess'));
    } catch (error) {
      console.error('Error canceling invitation:', toSafeErrorDetails(error));
      toast.error(t('auth.alert.invitationCancelError'));
    }
  };

  const visibleApartments = apartments.filter(
    (apartment) => !selectedBuildingId || apartment.buildingId === selectedBuildingId
  );
  const hasSelectedApartmentInCurrentView = visibleApartments.some(
    (apartment) => apartment.id === selectedApartmentFilterId
  );
  const effectiveSelectedApartmentFilterId =
    selectedApartmentFilterId !== 'all' && !hasSelectedApartmentInCurrentView
      ? 'all'
      : selectedApartmentFilterId;

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredApartments = visibleApartments.filter((apartment) => {
    if (effectiveSelectedApartmentFilterId !== 'all' && apartment.id !== effectiveSelectedApartmentFilterId) {
      return false;
    }

    if (!normalizedSearch) return true;

    const tenant0 = apartment.tenants?.[0] as unknown;
    const residentName = (typeof tenant0 === 'object' && tenant0 !== null && 'name' in tenant0)
      ? (tenant0 as { name?: string }).name
      : apartment.owner;
    const residentEmail = (typeof tenant0 === 'object' && tenant0 !== null && 'email' in tenant0)
      ? (tenant0 as { email?: string }).email
      : apartment.ownerEmail;

    return [
      apartment.number,
      residentName,
      residentEmail,
      apartment.floor,
    ]
      .map((value) => (typeof value === 'string' ? value.toLowerCase() : ''))
      .some((value) => value.includes(normalizedSearch));
  });

  const displayedApartments = filteredApartments;

  const isValidInviteEmail = (email: string): boolean => /\S+@\S+\.\S+/.test(email.trim());

  const sendApartmentInvitation = async (apartmentId: string, email: string): Promise<void> => {
    const response = await fetch('/api/invitations/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apartmentId, email, legalBasisConfirmed: true }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || t('auth.alert.invitationSendError'));
    }
  };

  type BulkInviteStatus = 'ready' | 'occupied' | 'invited' | 'missingEmail';
  const bulkInviteRows: Array<{
    apartmentId: string;
    apartmentNumber: string;
    name: string;
    email: string;
    status: BulkInviteStatus;
  }> = visibleApartments.map((apartment) => {
    const hasResidentBinding = typeof apartment.residentId === 'string' && apartment.residentId.trim() !== '';
    const hasTenants = Array.isArray(apartment.tenants) && apartment.tenants.length > 0;
    const occupied = hasResidentBinding || hasTenants;
    const ownerEmail = typeof apartment.ownerEmail === 'string' ? apartment.ownerEmail.trim() : '';

    let status: BulkInviteStatus = 'ready';
    if (occupied) {
      status = 'occupied';
    } else if (invitedApartmentIds.includes(apartment.id)) {
      status = 'invited';
    } else if (!ownerEmail || !isValidInviteEmail(ownerEmail)) {
      status = 'missingEmail';
    }

    return {
      apartmentId: apartment.id,
      apartmentNumber: apartment.number,
      name: apartment.owner?.trim() || '—',
      email: ownerEmail || '—',
      status,
    };
  });

  const readyBulkInviteRows = bulkInviteRows.filter((row) => row.status === 'ready');
  const sortedBulkInviteRows = [...bulkInviteRows].sort((a, b) => {
    if (bulkStatusSortMode === 'default') return 0;

    const aOccupied = a.status === 'occupied' ? 1 : 0;
    const bOccupied = b.status === 'occupied' ? 1 : 0;

    if (bulkStatusSortMode === 'occupiedFirst') {
      return bOccupied - aOccupied;
    }

    return aOccupied - bOccupied;
  });

  const handleBulkInvite = async () => {
    const selectedTargets = readyBulkInviteRows.filter((row) => bulkSelectedApartmentIds.includes(row.apartmentId));

    if (selectedTargets.length === 0) {
      toast.info(t('auth.alert.noApartmentsSelectedForInvite'));
      return;
    }

    setBulkInviting(true);

    let successCount = 0;
    let failCount = 0;
    const successfullyInvitedIds: string[] = [];

    try {
      for (const target of selectedTargets) {
        try {
          await sendApartmentInvitation(target.apartmentId, target.email);
          successCount += 1;
          successfullyInvitedIds.push(target.apartmentId);
          setInvitedApartmentIds((prev) => Array.from(new Set([...prev, target.apartmentId])));
        } catch (error) {
          failCount += 1;
          console.error(`Ошибка отправки приглашения для квартиры #${target.apartmentNumber}:`, toSafeErrorDetails(error));
        }
      }

      if (successCount > 0) {
        toast.success(t('auth.alert.invitesSentCount', { count: successCount }));
      }
      if (failCount > 0) {
        toast.error(t('auth.alert.invitesFailedCount', { count: failCount }));
      }

      setBulkSelectedApartmentIds((prev) => prev.filter((id) => !successfullyInvitedIds.includes(id)));
      await fetchData();
    } finally {
      setBulkInviting(false);
    }
  };

  const handleCancelInvitationForApartment = async (apartmentId: string) => {
    const invitationId = pendingInvitationByApartmentId[apartmentId];
    if (!invitationId) {
      toast.info(t('auth.alert.noActiveInvitation'));
      return;
    }

    if (!window.confirm(t('auth.alert.cancelApartmentInvitationConfirm'))) {
      return;
    }

    try {
      await revokeInvitation(invitationId);
      setInvitedApartmentIds((prev) => prev.filter((id) => id !== apartmentId));
      setPendingInvitationByApartmentId((prev) => {
        const next = { ...prev };
        delete next[apartmentId];
        return next;
      });
      toast.success(t('auth.alert.invitationCancelledSuccess'));
      await fetchData();
    } catch (error) {
      console.error('Error cancel invitation from bulk modal:', toSafeErrorDetails(error));
      toast.error(t('auth.alert.invitationCancelError'));
    }
  };

  const handleExportVisibleApartments = () => {
    if (displayedApartments.length === 0) {
      toast.info(t('auth.alert.noDataToExport'));
      return;
    }

    const header = ['Квартира', 'Имя жильца', 'Email', 'Площадь', 'Декларир.', 'Этаж', 'Статус'];

    const escapeCsv = (value: unknown): string => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = displayedApartments.map((apartment) => {
      const tenant0 = apartment.tenants?.[0] as unknown;
      const residentName = (typeof tenant0 === 'object' && tenant0 !== null && 'name' in tenant0)
        ? (tenant0 as { name?: string }).name
        : apartment.owner;
      const residentEmail = (typeof tenant0 === 'object' && tenant0 !== null && 'email' in tenant0)
        ? (tenant0 as { email?: string }).email
        : apartment.ownerEmail;

      const hasTenant = Boolean(apartment.tenants && apartment.tenants.length > 0);
      const hasResidentBinding = typeof apartment.residentId === 'string' && apartment.residentId.trim() !== '';
      const ownerEmailNormalized = typeof apartment.ownerEmail === 'string' ? apartment.ownerEmail.trim().toLowerCase() : '';
      const residentEmailNormalized = typeof residentEmail === 'string' ? residentEmail.trim().toLowerCase() : '';
      const hasOwnerEmail = ownerEmailNormalized.length > 0;
      const ownerEmailChanged = hasTenant && hasOwnerEmail && residentEmailNormalized.length > 0 && residentEmailNormalized !== ownerEmailNormalized;
      const occupied = hasResidentBinding || hasTenant;
      const statusLabel = ownerEmailChanged ? 'Email изменён' : occupied ? 'Занята' : 'Свободна';

      const area = apartment.area ?? apartment.managementArea ?? apartment.heatingArea;

      return [
        apartment.number,
        residentName || '—',
        residentEmail || '—',
        typeof area === 'number' ? `${area} м²` : '—',
        typeof apartment.declaredResidents === 'number' ? apartment.declaredResidents : '—',
        apartment.floor || '—',
        statusLabel,
      ].map(escapeCsv).join(',');
    });

    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `apartments-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Password reset is handled inside the ApartmentModal now

  // Building CRUD helpers removed from this page (not used here)
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-blue-50">
      <Header 
        userName={user?.name || user?.email || t('user')} 
        userEmail={user?.email}
        onLogout={handleLogout}
        pageTitle={t('apartments') || 'Управление квартирами'}
      />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex min-w-70 flex-1 items-center gap-3">
            <select
              value={selectedBuildingId ?? 'all'}
              onChange={(e) => setSelectedBuildingId(e.target.value === 'all' ? null : e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-blue-400 focus:outline-none"
            >
              <option value="all">Все дома</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* экмспорт */}
            <button 
              type="button"
              onClick={handleExportVisibleApartments}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Экспорт"
              aria-label="Экспорт"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-violet-200 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
              title="Импорт"
              aria-label="Импорт"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21V9m0 0-4 4m4-4 4 4M4 17v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setShowGlobalInvite((s) => !s)}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              title="Добавить жильца"
              aria-label="Добавить жильца"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19a6 6 0 0 0-12 0m6-8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1v6m3-3h-6" />
              </svg>
            </button >

            <button
              type="button"
              onClick={() => setIsAddingApartment((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              title="Добавить квартиру"
              aria-label="Добавить квартиру"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkSelectedApartmentIds(readyBulkInviteRows.map((row) => row.apartmentId));
                setShowBulkInviteModal(true);
              }}
              className="inline-flex items-center justify-center rounded-xl border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              title="Список приглашений"
              aria-label="Список приглашений"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 12h8m-8 5h5M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
            />
            <svg className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M16 10.5A5.5 5.5 0 1 1 5 10.5a5.5 5.5 0 0 1 11 0Z" />
            </svg>
          </div>

          <select
            value={effectiveSelectedApartmentFilterId}
            onChange={(e) => setSelectedApartmentFilterId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 focus:border-blue-400 focus:outline-none"
          >
            <option value="all">Выбрать квартиру</option>
            {visibleApartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                Квартира #{apartment.number}
              </option>
            ))}
          </select>

          <span className="text-sm font-medium text-gray-600">Всего квартир: {apartments.length}</span>
          <span className="text-sm text-gray-500">Показано: {displayedApartments.length}</span>
        </div>

        {showGlobalInvite && (
          <div className="mb-8 rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Пригласить жильца</h2>
                <p className="text-gray-600 text-sm mt-1">Быстрое добавление нового жильца в квартиру</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-end">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email адрес</label>
                <input
                  type="email"
                  value={globalInviteEmail}
                  onChange={(e) => setGlobalInviteEmail(e.target.value)}
                  placeholder="example@domain.com"
                  className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-3 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Выберите квартиру</label>
                <select
                  value={globalInviteApartmentId}
                  onChange={(e) => setGlobalInviteApartmentId(e.target.value || undefined)}
                  className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-3 focus:border-emerald-500 focus:outline-none transition"
                >
                  <option value="">Выберите квартиру...</option>
                  {apartments
                    .filter(a => {
                      const hasResident = typeof a.residentId === 'string' && a.residentId.trim() !== '';
                      const hasTenants = Array.isArray(a.tenants) && a.tenants.length > 0;
                      return !hasResident && !hasTenants && !invitedApartmentIds.includes(a.id || '');
                    })
                    .map(a => (
                      <option key={a.id} value={a.id}>{`${a.number} — ${buildings.find(b => b.id === a.buildingId)?.name || 'Без дома'}`}</option>
                    ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const email = (globalInviteEmail || '').trim();
                    if (!email || !isValidInviteEmail(email)) {
                      toast.error(t('auth.alert.invalidEmail'));
                      return;
                    }
                    if (!globalInviteApartmentId) {
                      toast.error(t('auth.alert.selectApartment'));
                      return;
                    }
                    try {
                      await sendApartmentInvitation(globalInviteApartmentId, email);
                      toast.success(t('auth.alert.invitationSentToEmail', { email }));
                      setGlobalInviteEmail('');
                      setInvitedApartmentIds(prev => Array.from(new Set([...prev, globalInviteApartmentId])));
                      setGlobalInviteApartmentId(undefined);
                      await fetchData();
                    } catch (err) {
                      console.error('Invite error', toSafeErrorDetails(err));
                      toast.error(t('auth.alert.invitationSendError'));
                    }
                  }}
                  className="flex-1 rounded-lg bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg transition"
                >
                  Отправить приглашение
                </button>

                <button
                  type="button"
                  onClick={() => setShowGlobalInvite(false)}
                  className="px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-900 font-semibold bg-white hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">💡 В списке показаны квартиры без привязанного жильца и без активных приглашений.</p>
          </div>
        )}

        {showBulkInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Список приглашений</h2>
                  <p className="mt-1 text-sm text-gray-600">Можно отправить приглашения всем выбранным ЖИЛЬ.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={bulkStatusSortMode}
                    onChange={(e) => setBulkStatusSortMode(e.target.value as 'default' | 'occupiedFirst' | 'notOccupiedFirst')}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 focus:border-blue-400 focus:outline-none"
                    title="Сортировка по занятости"
                    aria-label="Сортировка по занятости"
                  >
                    <option value="default">Без сортировки</option>
                    <option value="occupiedFirst">Сначала занятые</option>
                    <option value="notOccupiedFirst">Сначала не занятые</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowBulkInviteModal(false)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Закрыть
                  </button>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-auto px-6 py-4">
                <table className="w-full min-w-200 text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Выбрать</th>
                      <th className="px-3 py-2 text-left font-semibold">Квартира</th>
                      <th className="px-3 py-2 text-left font-semibold">Имя</th>
                      <th className="px-3 py-2 text-left font-semibold">Email</th>
                      <th className="px-3 py-2 text-left font-semibold">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedBulkInviteRows.map((row) => {
                      const checked = bulkSelectedApartmentIds.includes(row.apartmentId);
                      const canSelect = row.status === 'ready';

                      const statusLabel = row.status === 'ready'
                        ? 'Готово к отправке'
                        : row.status === 'invited'
                          ? 'Приглашение уже отправлено'
                          : row.status === 'occupied'
                            ? 'Квартира занята'
                            : 'Нет корректного email';

                      const statusClassName = row.status === 'ready'
                        ? 'bg-emerald-100 text-emerald-700'
                        : row.status === 'invited'
                          ? 'bg-blue-100 text-blue-700'
                          : row.status === 'occupied'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-amber-100 text-amber-700';

                      return (
                        <tr key={row.apartmentId} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canSelect || bulkInviting}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setBulkSelectedApartmentIds((prev) => {
                                  if (isChecked) return Array.from(new Set([...prev, row.apartmentId]));
                                  return prev.filter((id) => id !== row.apartmentId);
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-900">#{row.apartmentNumber}</td>
                          <td className="px-3 py-2 text-gray-900">{row.name}</td>
                          <td className="px-3 py-2 text-gray-900">{row.email}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName}`}>
                                {statusLabel}
                              </span>
                              {row.status === 'invited' && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelInvitationForApartment(row.apartmentId)}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                >
                                  Отменить приглашение
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  type="button"
                  disabled={bulkInviting || readyBulkInviteRows.length === 0}
                  onClick={() => setBulkSelectedApartmentIds(readyBulkInviteRows.map((row) => row.apartmentId))}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Выбрать все готовые
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    Выбрано: {bulkSelectedApartmentIds.length}
                  </span>
                  <button
                    type="button"
                    disabled={bulkInviting || bulkSelectedApartmentIds.length === 0}
                    onClick={handleBulkInvite}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bulkInviting
                      ? 'Отправка...'
                      : `Отправить приглашение${bulkSelectedApartmentIds.length > 0 ? ` (${bulkSelectedApartmentIds.length})` : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAddingApartment && (
          <div className="mb-8 rounded-2xl border border-blue-100 bg-white p-8 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Добавить новую квартиру</h2>
                <p className="text-gray-600 text-sm mt-1">Создайте новую квартиру в выбранном доме</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-6">
              <div>
                <label htmlFor="apartmentNumber" className="block text-sm font-semibold text-gray-700 mb-2">
                  Номер квартиры
                </label>
                <input
                  type="text"
                  id="apartmentNumber"
                  value={newApartment.number}
                  onChange={(e) => setNewApartment({ ...newApartment, number: e.target.value })}
                  className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-3 focus:border-blue-500 focus:outline-none transition"
                  placeholder="Н-р: 101"
                  required
                />
              </div>
              <div>
                <label htmlFor="buildingId" className="block text-sm font-semibold text-gray-700 mb-2">
                  Выберите дом
                </label>
                <select
                  id="buildingId"
                  value={newApartment.buildingId}
                  onChange={(e) => setNewApartment({ ...newApartment, buildingId: e.target.value })}
                  className="w-full rounded-lg bg-gray-50 border-2 border-gray-200 text-gray-900 px-4 py-3 focus:border-blue-500 focus:outline-none transition"
                  required
                >
                  <option value="" disabled>Выберите дом...</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setIsAddingApartment(false)}
                className="px-6 py-3 rounded-lg border-2 border-gray-200 text-gray-900 font-semibold bg-white hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleAddApartment}
                className="px-6 py-3 rounded-lg bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold hover:shadow-lg transition"
              >
                Добавить квартиру
              </button>
            </div>
          </div>
        )}

        {displayedApartments.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-275 text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Квартира</th>
                    <th className="px-4 py-3 text-left font-semibold">Имя жильца</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Площадь</th>
                    <th className="px-4 py-3 text-left font-semibold">Декларир.</th>
                    <th className="px-4 py-3 text-left font-semibold">Этаж</th>
                    <th className="px-4 py-3 text-left font-semibold">Статус</th>
                    <th className="px-4 py-3 text-right font-semibold">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedApartments.map((apartment) => {
                    const tenant0 = apartment.tenants?.[0] as unknown;
                    const residentName = (typeof tenant0 === 'object' && tenant0 !== null && 'name' in tenant0)
                      ? (tenant0 as { name?: string }).name
                      : apartment.owner;
                    const residentEmail = (typeof tenant0 === 'object' && tenant0 !== null && 'email' in tenant0)
                      ? (tenant0 as { email?: string }).email
                      : apartment.ownerEmail;
                    const area = apartment.area ?? apartment.managementArea ?? apartment.heatingArea;
                    const hasTenant = Boolean(apartment.tenants && apartment.tenants.length > 0);
                    const hasResidentBinding = typeof apartment.residentId === 'string' && apartment.residentId.trim() !== '';
                    const ownerEmailNormalized = typeof apartment.ownerEmail === 'string' ? apartment.ownerEmail.trim().toLowerCase() : '';
                    const residentEmailNormalized = typeof residentEmail === 'string' ? residentEmail.trim().toLowerCase() : '';
                    const hasOwnerEmail = ownerEmailNormalized.length > 0;
                    const ownerEmailChanged = hasTenant && hasOwnerEmail && residentEmailNormalized.length > 0 && residentEmailNormalized !== ownerEmailNormalized;
                    const occupied = hasResidentBinding || hasTenant;

                    const statusLabel = ownerEmailChanged
                      ? 'Email изменён'
                      : occupied
                        ? 'Занята'
                        : 'Свободна';
                    const statusClassName = ownerEmailChanged
                      ? 'bg-blue-100 text-blue-700'
                      : occupied
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-yellow-100 text-yellow-700';
                    const statusDotClassName = ownerEmailChanged
                      ? 'bg-blue-600'
                      : occupied
                        ? 'bg-emerald-600'
                        : 'bg-yellow-600';

                    return (
                      <tr key={apartment.id} className="hover:bg-blue-50/30 transition">
                        <td className="px-4 py-3 font-semibold text-gray-900">#{apartment.number}</td>
                        <td className="px-4 py-3 text-gray-900">{residentName || '—'}</td>
                        <td className="px-4 py-3 text-gray-900">{residentEmail || '—'}</td>
                        <td className="px-4 py-3 text-gray-900">{typeof area === 'number' ? `${area} м²` : '—'}</td>
                        <td className="px-4 py-3 text-gray-900">{typeof apartment.declaredResidents === 'number' ? apartment.declaredResidents : '—'}</td>
                        <td className="px-4 py-3 text-gray-900">{apartment.floor || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName}`}>
                            <span className={`h-2 w-2 rounded-full ${statusDotClassName}`}></span>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(apartment)}
                              className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition"
                              title="Полная информация"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            {(hasResidentBinding || hasTenant) && (
                              <button
                                onClick={() => handleUnassignResidentFor(apartment.id)}
                                className="p-2 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition"
                                title="Удалить жильца"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6z" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => requestDeleteApartment(apartment)}
                              className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                              title="Удалить квартиру"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
 
        {isModalOpen && selectedApartment && (
          (() => {
            // compute invitation meta (latest invitation) and account status + resident email
            const invitations: SelectedInvitation[] = selectedApartment.invitations ?? [];

            let invitationMeta: { email: string; sentAt?: string | Date } | undefined = undefined;
            if (invitations.length > 0) {
              const sorted = [...invitations].sort((a, b) => {
                const da = (a.createdAt || a.sentAt) instanceof Date ? (a.createdAt || a.sentAt) as Date : new Date(0);
                const db = (b.createdAt || b.sentAt) instanceof Date ? (b.createdAt || b.sentAt) as Date : new Date(0);
                return db.getTime() - da.getTime();
              });
              const latest = sorted[0];
              invitationMeta = {
                email: latest.email,
                sentAt: (latest.sentAt || latest.createdAt) as Date | undefined,
              };
            }

            // determine resident email: prefer tenant list or accepted invitation
            const residentEmail = (selectedApartment.tenants && selectedApartment.tenants[0]?.email)
              || invitations.find(inv => inv.status === 'accepted')?.email
              || undefined;

            // Get resident joined date (acceptedAt from tenant)
            const residentJoinedAt = selectedApartment.tenants && selectedApartment.tenants[0]?.acceptedAt
              ? new Date(selectedApartment.tenants[0].acceptedAt)
              : undefined;

            // determine account status
            let accountStatus: 'activated' | 'pending' | 'notAssigned' = 'notAssigned';
            if (selectedApartment.residentId || (selectedApartment.tenants && selectedApartment.tenants.length > 0)) accountStatus = 'activated';
            else if (invitations.length > 0) accountStatus = 'pending';

            // Find pending invitation (not accepted, not revoked)
            const pendingInvitation = invitations.find(inv => inv.status === 'pending');

            return (
              <ApartmentModal
                apartment={selectedApartment}
                invitationMeta={invitationMeta}
                accountStatus={accountStatus}
                residentEmail={residentEmail}
                residentJoinedAt={residentJoinedAt}
                onClose={handleCloseModal}
                onDelete={() => requestDeleteApartment(selectedApartment)}
                onUnassignResident={handleUnassignResident}
                onCancelInvitation={pendingInvitation ? () => handleCancelInvitation(pendingInvitation.id) : undefined}
                deleting={false}
                sendingPasswordReset={false}
                canDelete={true}
                canSendPasswordReset={true}
                canUnassignResident={true}
                pendingInvitationId={pendingInvitation?.id}
              />
            );
          })()
        )}

        <ImportApartmentsModal
          buildings={buildings}
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={fetchData}
        />

        <ConfirmationDialog
          isOpen={Boolean(apartmentPendingDelete)}
          title="Удалить квартиру?"
          description="Это действие нельзя отменить. Квартира будет удалена из списка и связанных данных дома."
          details={apartmentPendingDelete ? [
            `Квартира: #${apartmentPendingDelete.number}`,
            `Дом: ${buildings.find((building) => building.id === apartmentPendingDelete.buildingId)?.name || 'Неизвестный дом'}`,
            `Email владельца: ${apartmentPendingDelete.ownerEmail || 'не указан'}`,
          ] : []}
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          confirmVariant="danger"
          loading={isDeletingApartment}
          onConfirm={handleDeleteApartment}
          onCancel={() => {
            if (!isDeletingApartment) {
              setApartmentPendingDelete(null);
            }
          }}
        />
         
      </main>
    </div>
  );
}
