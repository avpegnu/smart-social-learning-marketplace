// ============================================================
// USER
// ============================================================

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  avatarUrl: string | null;
  status: UserStatus;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  createdAt: string;
  updatedAt: string;
}

export enum Role {
  STUDENT = 'STUDENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  UNVERIFIED = 'UNVERIFIED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

// ============================================================
// COURSE
// ============================================================

export interface Course {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  price: number;
  level: CourseLevel;
  language: string;
  status: CourseStatus;
  totalStudents: number;
  avgRating: number;
  reviewCount: number;
  totalDuration: number;
  totalLessons: number;
  learningOutcomes: string[] | null;
  prerequisites: string[] | null;
  instructor: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
  category: { id: string; name: string; slug: string };
}

export interface Section {
  id: string;
  title: string;
  order: number;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  title: string;
  description: string | null;
  order: number;
  price: number | null;
  isFreePreview: boolean;
  lessonsCount: number;
  totalDuration: number;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  order: number;
  estimatedDuration: number | null;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  userId: string;
  user: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
  createdAt: string;
}

export enum CourseLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export enum CourseStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum LessonType {
  VIDEO = 'VIDEO',
  TEXT = 'TEXT',
  QUIZ = 'QUIZ',
}

// ============================================================
// CART & ECOMMERCE
// ============================================================

export interface CartItem {
  courseId: string;
  title: string;
  instructorName: string;
  thumbnailUrl: string;
  price: number;
  type: 'FULL_COURSE' | 'CHAPTER';
  chapterId?: string;
}

export interface Order {
  id: string;
  orderCode: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: OrderStatus;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

export enum EnrollmentType {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
}

// ============================================================
// SOCIAL
// ============================================================

export interface Post {
  id: string;
  content: string;
  type: PostType;
  images: string[] | null;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  author: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
  createdAt: string;
}

export interface Comment {
  id: string;
  content: string;
  author: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
  createdAt: string;
}

export enum PostType {
  TEXT = 'TEXT',
  ARTICLE = 'ARTICLE',
  ACHIEVEMENT = 'ACHIEVEMENT',
}

// ============================================================
// CHAT
// ============================================================

export interface Conversation {
  id: string;
  isGroup: boolean;
  name: string | null;
  lastMessage: Message | null;
  participants: Pick<User, 'id' | 'fullName' | 'avatarUrl'>[];
  updatedAt: string;
}

export interface Message {
  id: string;
  content: string;
  type: MessageType;
  senderId: string;
  sender: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
  createdAt: string;
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
}

// ============================================================
// Q&A
// ============================================================

export interface Question {
  id: string;
  title: string;
  content: string;
  voteCount: number;
  answerCount: number;
  isSolved: boolean;
  author: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
  tags: { id: string; name: string }[];
  createdAt: string;
}

export interface Answer {
  id: string;
  content: string;
  voteCount: number;
  isBestAnswer: boolean;
  author: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
  createdAt: string;
}

// ============================================================
// NOTIFICATION
// ============================================================

export interface Notification {
  id: string;
  type: NotificationType;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export enum NotificationType {
  COURSE_APPROVED = 'COURSE_APPROVED',
  COURSE_REJECTED = 'COURSE_REJECTED',
  NEW_ENROLLMENT = 'NEW_ENROLLMENT',
  NEW_REVIEW = 'NEW_REVIEW',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  WITHDRAWAL_COMPLETED = 'WITHDRAWAL_COMPLETED',
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  POST_LIKED = 'POST_LIKED',
  NEW_COMMENT = 'NEW_COMMENT',
  NEW_ANSWER = 'NEW_ANSWER',
  ANSWER_ACCEPTED = 'ANSWER_ACCEPTED',
  APPLICATION_REVIEWED = 'APPLICATION_REVIEWED',
}

// ============================================================
// CATEGORY & TAG
// ============================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  courseCount: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  courseCount: number;
}

// ============================================================
// GROUP
// ============================================================

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  privacy: GroupPrivacy;
  memberCount: number;
  courseId: string | null;
  owner: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
}

export enum GroupPrivacy {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum GroupRole {
  MEMBER = 'MEMBER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

// ============================================================
// LEARNING
// ============================================================

export interface LessonProgress {
  lessonId: string;
  watchedPercent: number;
  isCompleted: boolean;
}

export interface Certificate {
  id: string;
  courseId: string;
  courseTitle: string;
  certificateUrl: string;
  verifyCode: string;
  createdAt: string;
}

// ============================================================
// INSTRUCTOR
// ============================================================

export interface InstructorProfile {
  id: string;
  userId: string;
  headline: string | null;
  biography: string | null;
  expertise: string[];
  experience: string | null;
}

export enum ApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum CouponType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum EarningStatus {
  PENDING = 'PENDING',
  AVAILABLE = 'AVAILABLE',
  WITHDRAWN = 'WITHDRAWN',
}

// ============================================================
// MEDIA
// ============================================================

export enum MediaType {
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  ATTACHMENT = 'ATTACHMENT',
}

export enum MediaStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

// ============================================================
// REPORT
// ============================================================

export enum ReportTargetType {
  POST = 'POST',
  COMMENT = 'COMMENT',
  USER = 'USER',
  COURSE = 'COURSE',
  QUESTION = 'QUESTION',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  ACTION_TAKEN = 'ACTION_TAKEN',
  DISMISSED = 'DISMISSED',
}

// ============================================================
// API RESPONSE
// ============================================================

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  field?: string;
}
