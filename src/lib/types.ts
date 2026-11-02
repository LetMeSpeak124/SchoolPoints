export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type TeacherStatus = 'PENDING' | 'APPROVED' | 'REVOKED';

export type AwardCategory = 'PARTICIPATION' | 'HOMEWORK' | 'KINDNESS' | 'IMPROVEMENT';

export type LedgerType = 'AWARD' | 'REDEMPTION' | 'REFUND';

export type RedemptionStatus = 'REQUESTED' | 'READY' | 'COLLECTED' | 'CANCELLED';

export const AWARD_CATEGORIES: { value: AwardCategory; label: string; emoji: string; defaultPoints: number }[] = [
  { value: 'PARTICIPATION', label: 'Great Participation', emoji: '🙋', defaultPoints: 5 },
  { value: 'HOMEWORK', label: 'Homework Star', emoji: '📚', defaultPoints: 10 },
  { value: 'KINDNESS', label: 'Acts of Kindness', emoji: '🤝', defaultPoints: 10 },
  { value: 'IMPROVEMENT', label: 'Most Improved', emoji: '🚀', defaultPoints: 15 },
];
