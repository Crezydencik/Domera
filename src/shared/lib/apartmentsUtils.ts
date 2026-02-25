import type { Invitation } from '@/shared/types';

export function resolveInvitationCreatedAt(invitation: Invitation): number {
  const raw = invitation.createdAt as unknown;
  if (raw instanceof Date) {
    return raw.getTime();
  }
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'toDate' in raw &&
    typeof (raw as { toDate: () => Date }).toDate === 'function'
  ) {
    return (raw as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof raw === 'string') {
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function formatInvitationDateTime(timestamp: number): string {
  if (!timestamp) return 'Неизвестно';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
