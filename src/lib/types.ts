export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export type TeacherStatus = 'PENDING' | 'APPROVED' | 'REVOKED';

export type AwardCategory = 'PARTICIPATION' | 'HOMEWORK' | 'KINDNESS' | 'IMPROVEMENT';

export type LedgerType = 'AWARD' | 'REDEMPTION' | 'REFUND';

export type RedemptionStatus = 'REQUESTED' | 'READY' | 'COLLECTED' | 'CANCELLED' | 'EXPIRED';

// Provisional pilot limits from the proposal (BR-04/BR-05).
// These are enforced server-side and can later be moved into a policy table.
export const MAX_AWARD_POINTS = 10;
export const STUDENT_DAILY_CAP = 20;
export const COLLECTION_WINDOW_HOURS = 72;

export const AWARD_CATEGORIES: { value: AwardCategory; label: string; emoji: string; defaultPoints: number }[] = [
  { value: 'PARTICIPATION', label: 'Great Participation', emoji: '🙋', defaultPoints: 5 },
  { value: 'HOMEWORK', label: 'Homework Star', emoji: '📚', defaultPoints: 10 },
  { value: 'KINDNESS', label: 'Acts of Kindness', emoji: '🤝', defaultPoints: 10 },
  { value: 'IMPROVEMENT', label: 'Most Improved', emoji: '🚀', defaultPoints: 10 },
];

export const ACTIVE_REDEMPTION_STATUSES: RedemptionStatus[] = ['REQUESTED', 'READY'];

export const REDEMPTION_TRANSITIONS: Record<RedemptionStatus, RedemptionStatus[]> = {
  REQUESTED: ['READY', 'CANCELLED', 'EXPIRED'],
  READY: ['COLLECTED', 'CANCELLED', 'EXPIRED'],
  COLLECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};
