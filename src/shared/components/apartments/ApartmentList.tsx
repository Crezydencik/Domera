import React from 'react';
import type { Apartment, Building, ApartmentAccountStatus, ApartmentInvitationMeta } from '../../types';
import { ApartmentCard } from './ApartmentCard';

interface ApartmentListProps {
  apartments: Apartment[];
  buildings: Building[];
  invitationMetaByApartmentId: Record<string, ApartmentInvitationMeta>;
  accountStatusByApartmentId: Record<string, ApartmentAccountStatus>;
  residentEmailByApartmentId: Record<string, string>;
  isManagementCompany: boolean;
  onInfo: (apartment: Apartment) => void;
  onDelete: (apartment: Apartment) => void;
  onSendPasswordReset: (apartment: Apartment) => void;
  deletingApartmentId: string | null;
  sendingPasswordReset: boolean;
}

export const ApartmentList: React.FC<ApartmentListProps> = ({
  apartments,
  buildings,
  invitationMetaByApartmentId,
  accountStatusByApartmentId,
  residentEmailByApartmentId,
  isManagementCompany,
  onInfo,
  onDelete,
  onSendPasswordReset,
  deletingApartmentId,
  sendingPasswordReset,
}) => {
  const getBuildingName = (apartment: Apartment) =>
    buildings.find((b) => b.id === apartment.buildingId)?.name ?? 'Не указан';

  return (
    <div className="grid gap-4">
      {apartments.map((apt) => (
        <ApartmentCard
          key={apt.id}
          apartment={apt}
          buildingName={getBuildingName(apt)}
          invitationMeta={invitationMetaByApartmentId[apt.id]}
          accountStatus={accountStatusByApartmentId[apt.id]}
          residentEmail={residentEmailByApartmentId[apt.id]}
          isManagementCompany={isManagementCompany}
          onInfo={onInfo}
          onDelete={onDelete}
          onSendPasswordReset={onSendPasswordReset}
          deleting={deletingApartmentId === apt.id}
          sendingPasswordReset={sendingPasswordReset}
        />
      ))}
    </div>
  );
};
