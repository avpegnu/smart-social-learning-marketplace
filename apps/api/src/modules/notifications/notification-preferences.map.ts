// Maps UI preference keys → NotificationType enum values
export const PREFERENCE_TYPE_MAP: Record<string, string[]> = {
  // Student preferences
  socialUpdates: ['POST_LIKE', 'POST_COMMENT'],
  newFollowers: ['FOLLOW'],
  orderUpdates: ['ORDER_COMPLETED', 'ORDER_EXPIRED'],
  reviewResponses: ['QUESTION_ANSWERED', 'ANSWER_VOTED'],
  systemAnnouncements: ['SYSTEM', 'REPORT_RESOLVED'],

  // Instructor preferences
  newEnrollment: ['COURSE_ENROLLED'],
  courseApproval: ['COURSE_APPROVED', 'COURSE_REJECTED'],
  payoutCompleted: ['WITHDRAWAL_COMPLETED', 'WITHDRAWAL_REJECTED'],
};

// Reverse map: NotificationType → preference key
export const TYPE_TO_PREFERENCE: Record<string, string> = {};
for (const [pref, types] of Object.entries(PREFERENCE_TYPE_MAP)) {
  for (const type of types) {
    TYPE_TO_PREFERENCE[type] = pref;
  }
}

// Types that are ALWAYS delivered (no opt-out)
export const ALWAYS_DELIVER_TYPES = new Set([
  'COURSE_PENDING_REVIEW',
  'WITHDRAWAL_PENDING',
  'NEW_REPORT',
  'NEW_APPLICATION',
]);
