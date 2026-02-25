import { useState, useEffect } from 'react';
import { getApartmentsByCompany } from '@/modules/apartments/services/apartmentsService';
import { getBuildingsByCompany } from '@/modules/invoices/services/buildings/services/buildingsService';
import { getInvitationsByCompany } from '@/modules/invitations/services/invitationsService';
import { getUserById } from '@/modules/auth/services/authService';
import type { Apartment, Building, Invitation } from '@/shared/types';

export function useApartmentsData(user: any) {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [residentEmailByApartmentId, setResidentEmailByApartmentId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.companyId) return;
      setLoading(true);
      try {
        const data = await getApartmentsByCompany(user.companyId);
        const visibleApartments = user.role === 'Resident'
          ? data.filter((apartment) => apartment.id === user.apartmentId)
          : data;
        const companyBuildings = await getBuildingsByCompany(user.companyId);
        const visibleBuildings = user.role === 'Resident'
          ? companyBuildings.filter((building) => visibleApartments.some((apartment) => apartment.buildingId === building.id))
          : companyBuildings;
        const visibleApartmentIds = new Set(visibleApartments.map((apartment) => apartment.id));
        const invitations = (await getInvitationsByCompany(user.companyId)).filter((invitation) => visibleApartmentIds.has(invitation.apartmentId));
        const residentEntries = await Promise.all(
          visibleApartments.filter((apartment) => Boolean(apartment.residentId)).map(async (apartment) => {
            const resident = await getUserById(apartment.residentId ?? null);
            return {
              apartmentId: apartment.id,
              email: resident?.email ?? '',
            };
          })
        );
        const nextResidentEmailByApartmentId = residentEntries.reduce<Record<string, string>>((acc, entry) => {
          if (entry.email) {
            acc[entry.apartmentId] = entry.email;
          }
          return acc;
        }, {});
        setApartments(visibleApartments);
        setBuildings(visibleBuildings);
        setInvitations(invitations);
        setResidentEmailByApartmentId(nextResidentEmailByApartmentId);
      } catch (e) {
        // handle error
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.apartmentId, user?.companyId, user?.role]);

  return { apartments, buildings, invitations, residentEmailByApartmentId, loading };
}
