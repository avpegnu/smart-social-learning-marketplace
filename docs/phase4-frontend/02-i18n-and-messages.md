# 2. INTERNATIONALIZATION (i18n) & MESSAGE SYSTEM

> Library: next-intl | Locales: vi (default), en | Backend messages: localized mapping

---

## 2.1 Tổng quan i18n Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     i18n ARCHITECTURE                            │
│                                                                  │
│  ┌─────────────┐     ┌──────────────┐     ┌──────────────────┐  │
│  │ next-intl   │     │ Messages     │     │ Backend API      │  │
│  │ (runtime)   │◄────│ vi.json      │     │ (NestJS)         │  │
│  │             │     │ en.json      │     │                  │  │
│  └──────┬──────┘     └──────────────┘     └────────┬─────────┘  │
│         │                                          │             │
│         ▼                                          ▼             │
│  ┌──────────────┐                        ┌──────────────────┐   │
│  │ UI Texts     │                        │ API Messages     │   │
│  │ (labels,     │                        │ (error codes →   │   │
│  │  buttons,    │                        │  frontend maps   │   │
│  │  placeholders│                        │  to localized    │   │
│  │  tooltips)   │                        │  messages)       │   │
│  └──────────────┘                        └──────────────────┘   │
│                                                                  │
│  Strategy:                                                       │
│  ─ UI text → next-intl (frontend JSON files)                     │
│  ─ Backend validation errors → error code + frontend mapping     │
│  ─ Backend success messages → message key + frontend mapping     │
│  ─ Dynamic content (course titles, posts) → KHÔNG dịch           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2.2 next-intl Setup

### Configuration

```typescript
// packages/i18n/src/config.ts
import { Pathnames, LocalePrefix } from 'next-intl/routing';

export const locales = ['vi', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'vi';

export const localePrefix: LocalePrefix = 'as-needed';
// 'as-needed': /vi/courses → /courses (default, no prefix)
//              /en/courses → /en/courses (non-default, has prefix)

export const pathnames: Pathnames<typeof locales> = {
  '/': '/',
  '/courses': '/courses',
  '/courses/[slug]': '/courses/[slug]',
  '/learning/[courseId]': '/learning/[courseId]',
  '/social': '/social',
  '/chat': '/chat',
  '/profile/[userId]': '/profile/[userId]',
  '/cart': '/cart',
  '/checkout': '/checkout',
  // ... tất cả routes
};
```

### Middleware (Locale Detection)

```typescript
// apps/student-portal/middleware.ts (Next.js 16: proxy.ts)
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale, localePrefix, pathnames } from '@shared/i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix,
  pathnames,
  localeDetection: true, // Detect from Accept-Language header
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

### Layout Integration

```typescript
// apps/student-portal/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales } from '@shared/i18n'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!locales.includes(locale as any)) notFound()
  setRequestLocale(locale)

  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}
```

---

## 2.3 Translation File Structure

### Vietnamese (vi.json) — Default Locale

```jsonc
// packages/i18n/messages/vi.json
{
  // ============================================================
  // COMMON — Shared across all pages
  // ============================================================
  "common": {
    "appName": "Smart Social Learning",
    "theme": {
      "toggle": "Chuyển đổi giao diện",
      "light": "Sáng",
      "dark": "Tối",
      "system": "Hệ thống",
    },
    "locale": {
      "switch": "Chuyển ngôn ngữ",
      "vi": "Tiếng Việt",
      "en": "English",
    },
    "action": {
      "save": "Lưu",
      "cancel": "Hủy",
      "delete": "Xóa",
      "edit": "Chỉnh sửa",
      "create": "Tạo mới",
      "submit": "Gửi",
      "confirm": "Xác nhận",
      "close": "Đóng",
      "back": "Quay lại",
      "next": "Tiếp theo",
      "previous": "Trước đó",
      "search": "Tìm kiếm",
      "filter": "Lọc",
      "sort": "Sắp xếp",
      "loadMore": "Xem thêm",
      "refresh": "Làm mới",
      "retry": "Thử lại",
      "viewAll": "Xem tất cả",
      "learnMore": "Tìm hiểu thêm",
      "apply": "Áp dụng",
      "reset": "Đặt lại",
      "upload": "Tải lên",
      "download": "Tải xuống",
      "share": "Chia sẻ",
      "copy": "Sao chép",
      "copied": "Đã sao chép",
    },
    "status": {
      "loading": "Đang tải...",
      "saving": "Đang lưu...",
      "processing": "Đang xử lý...",
      "uploading": "Đang tải lên...",
      "success": "Thành công",
      "error": "Có lỗi xảy ra",
      "noResults": "Không tìm thấy kết quả",
      "empty": "Trống",
    },
    "time": {
      "justNow": "Vừa xong",
      "minutesAgo": "{count, plural, one {# phút trước} other {# phút trước}}",
      "hoursAgo": "{count, plural, one {# giờ trước} other {# giờ trước}}",
      "daysAgo": "{count, plural, one {# ngày trước} other {# ngày trước}}",
      "weeksAgo": "{count, plural, one {# tuần trước} other {# tuần trước}}",
    },
    "pagination": {
      "page": "Trang {current} / {total}",
      "showing": "Hiển thị {from}-{to} trong {total}",
      "perPage": "Mỗi trang",
      "first": "Đầu",
      "last": "Cuối",
      "next": "Sau",
      "previous": "Trước",
    },
    "confirm": {
      "title": "Xác nhận",
      "deleteTitle": "Xác nhận xóa",
      "deleteMessage": "Bạn có chắc chắn muốn xóa? Hành động này không thể hoàn tác.",
      "unsavedChanges": "Bạn có thay đổi chưa lưu. Bạn có muốn rời khỏi trang?",
    },
  },

  // ============================================================
  // VALIDATION — Form validation messages
  // ============================================================
  "validation": {
    "required": "Trường này là bắt buộc",
    "email": "Email không hợp lệ",
    "url": "URL không hợp lệ",
    "min": "Tối thiểu {min} ký tự",
    "max": "Tối đa {max} ký tự",
    "minNumber": "Giá trị tối thiểu là {min}",
    "maxNumber": "Giá trị tối đa là {max}",
    "password": {
      "min": "Mật khẩu tối thiểu 8 ký tự",
      "uppercase": "Mật khẩu cần ít nhất 1 chữ hoa",
      "number": "Mật khẩu cần ít nhất 1 chữ số",
      "match": "Mật khẩu xác nhận không khớp",
    },
    "fullName": {
      "min": "Họ tên tối thiểu 2 ký tự",
      "max": "Họ tên tối đa 100 ký tự",
    },
    "file": {
      "tooLarge": "File quá lớn. Tối đa {max}",
      "invalidType": "Định dạng file không được hỗ trợ",
      "uploadFailed": "Tải file lên thất bại",
    },
  },

  // ============================================================
  // AUTH — Authentication pages
  // ============================================================
  "auth": {
    "login": {
      "title": "Đăng nhập",
      "subtitle": "Chào mừng bạn quay trở lại",
      "email": "Email",
      "emailPlaceholder": "Nhập email của bạn",
      "password": "Mật khẩu",
      "passwordPlaceholder": "Nhập mật khẩu",
      "submit": "Đăng nhập",
      "forgotPassword": "Quên mật khẩu?",
      "noAccount": "Chưa có tài khoản?",
      "signUp": "Đăng ký ngay",
      "orContinueWith": "Hoặc tiếp tục với",
      "google": "Đăng nhập với Google",
      "submitting": "Đang đăng nhập...",
    },
    "register": {
      "title": "Đăng ký",
      "subtitle": "Tạo tài khoản để bắt đầu học",
      "fullName": "Họ và tên",
      "fullNamePlaceholder": "Nhập họ và tên",
      "email": "Email",
      "emailPlaceholder": "Nhập email của bạn",
      "password": "Mật khẩu",
      "passwordPlaceholder": "Tạo mật khẩu",
      "confirmPassword": "Xác nhận mật khẩu",
      "confirmPasswordPlaceholder": "Nhập lại mật khẩu",
      "submit": "Đăng ký",
      "hasAccount": "Đã có tài khoản?",
      "signIn": "Đăng nhập",
      "orContinueWith": "Hoặc tiếp tục với",
      "google": "Đăng ký với Google",
      "termsAgree": "Bằng việc đăng ký, bạn đồng ý với",
      "terms": "Điều khoản sử dụng",
      "and": "và",
      "privacy": "Chính sách bảo mật",
      "submitting": "Đang tạo tài khoản...",
    },
    "verifyEmail": {
      "title": "Xác nhận email",
      "message": "Chúng tôi đã gửi email xác nhận đến {email}. Vui lòng kiểm tra hộp thư.",
      "resend": "Gửi lại email xác nhận",
      "resendSuccess": "Đã gửi lại email xác nhận",
      "resendCooldown": "Vui lòng đợi {seconds} giây",
      "verified": "Email đã được xác nhận thành công!",
      "expired": "Link xác nhận đã hết hạn. Vui lòng yêu cầu gửi lại.",
    },
    "forgotPassword": {
      "title": "Quên mật khẩu",
      "subtitle": "Nhập email để nhận link đặt lại mật khẩu",
      "email": "Email",
      "submit": "Gửi link đặt lại",
      "success": "Đã gửi link đặt lại mật khẩu đến email của bạn",
      "backToLogin": "Quay lại đăng nhập",
    },
    "resetPassword": {
      "title": "Đặt lại mật khẩu",
      "newPassword": "Mật khẩu mới",
      "confirmPassword": "Xác nhận mật khẩu mới",
      "submit": "Đặt lại mật khẩu",
      "success": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập.",
      "expired": "Link đặt lại mật khẩu đã hết hạn",
    },
    "logout": "Đăng xuất",
    "sessionExpired": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  },

  // ============================================================
  // NAV — Navigation
  // ============================================================
  "nav": {
    "home": "Trang chủ",
    "courses": "Khóa học",
    "myCourses": "Khóa học của tôi",
    "myLearning": "Học tập",
    "social": "Cộng đồng",
    "feed": "Bảng tin",
    "chat": "Tin nhắn",
    "groups": "Nhóm",
    "qna": "Hỏi đáp",
    "notifications": "Thông báo",
    "cart": "Giỏ hàng",
    "wishlist": "Yêu thích",
    "profile": "Hồ sơ",
    "settings": "Cài đặt",
    "orders": "Đơn hàng",
    "certificates": "Chứng chỉ",
    "aiTutor": "AI Tutor",
    "becomeInstructor": "Trở thành giảng viên",
    "managementPortal": "Cổng quản lý",
    "searchPlaceholder": "Tìm kiếm khóa học, bài viết...",
  },

  // ============================================================
  // HOME — Homepage
  // ============================================================
  "home": {
    "hero": {
      "title": "Học tập thông minh, kết nối cộng đồng",
      "subtitle": "Nền tảng học trực tuyến kết hợp mạng xã hội và AI, giúp bạn học hiệu quả hơn",
      "cta": "Khám phá khóa học",
      "secondaryCta": "Tìm hiểu thêm",
    },
    "featuredCourses": "Khóa học nổi bật",
    "newCourses": "Khóa học mới nhất",
    "popularCourses": "Khóa học phổ biến",
    "recommendedCourses": "Gợi ý cho bạn",
    "categories": "Danh mục",
    "stats": {
      "courses": "Khóa học",
      "students": "Học viên",
      "instructors": "Giảng viên",
      "certificates": "Chứng chỉ",
    },
    "whyUs": {
      "title": "Tại sao chọn chúng tôi?",
      "socialLearning": {
        "title": "Học tập xã hội",
        "description": "Kết nối với cộng đồng học viên, chia sẻ kiến thức và kinh nghiệm",
      },
      "aiPowered": {
        "title": "AI Tutor thông minh",
        "description": "Trợ lý AI giải đáp thắc mắc 24/7, dựa trên nội dung khóa học",
      },
      "qualityCourses": {
        "title": "Khóa học chất lượng",
        "description": "Nội dung được kiểm duyệt bởi đội ngũ chuyên gia",
      },
    },
  },

  // ============================================================
  // COURSES — Course browsing & detail
  // ============================================================
  "courses": {
    "browse": {
      "title": "Khám phá khóa học",
      "searchPlaceholder": "Tìm kiếm khóa học...",
      "filters": "Bộ lọc",
      "category": "Danh mục",
      "allCategories": "Tất cả danh mục",
      "level": "Trình độ",
      "allLevels": "Tất cả trình độ",
      "price": "Giá",
      "priceRange": "Khoảng giá",
      "free": "Miễn phí",
      "paid": "Có phí",
      "rating": "Đánh giá",
      "ratingAbove": "Từ {rating} sao trở lên",
      "sort": {
        "label": "Sắp xếp",
        "popular": "Phổ biến nhất",
        "newest": "Mới nhất",
        "highestRated": "Đánh giá cao nhất",
        "priceLow": "Giá thấp → cao",
        "priceHigh": "Giá cao → thấp",
      },
      "results": "{count} khóa học được tìm thấy",
      "noResults": "Không tìm thấy khóa học phù hợp",
      "clearFilters": "Xóa bộ lọc",
    },
    "card": {
      "by": "bởi",
      "students": "{count} học viên",
      "rating": "{rating} ({count} đánh giá)",
      "free": "Miễn phí",
      "chapters": "{count} chương",
      "lessons": "{count} bài học",
      "hours": "{count} giờ",
      "updated": "Cập nhật {date}",
      "bestSeller": "Bán chạy",
      "new": "Mới",
    },
    "detail": {
      "aboutCourse": "Về khóa học này",
      "whatYouLearn": "Bạn sẽ học được gì",
      "curriculum": "Nội dung khóa học",
      "requirements": "Yêu cầu",
      "instructor": "Giảng viên",
      "reviews": "Đánh giá",
      "faq": "Câu hỏi thường gặp",
      "relatedCourses": "Khóa học liên quan",
      "sectionsCount": "{count} phần",
      "chaptersCount": "{count} chương",
      "lessonsCount": "{count} bài học",
      "totalDuration": "Tổng thời lượng: {duration}",
      "level": {
        "BEGINNER": "Cơ bản",
        "INTERMEDIATE": "Trung cấp",
        "ADVANCED": "Nâng cao",
      },
      "includes": "Khóa học bao gồm",
      "includesItems": {
        "videos": "{count} giờ video",
        "articles": "{count} bài viết",
        "resources": "{count} tài liệu",
        "quizzes": "{count} bài kiểm tra",
        "certificate": "Chứng chỉ hoàn thành",
        "lifetime": "Truy cập trọn đời",
        "mobile": "Học trên mọi thiết bị",
      },
      "pricing": {
        "fullCourse": "Cả khóa học",
        "perChapter": "Theo chương",
        "originalPrice": "Giá gốc",
        "discount": "Giảm {percent}%",
        "buyFull": "Mua cả khóa học",
        "buyChapter": "Mua chương này",
        "addToCart": "Thêm vào giỏ hàng",
        "goToCart": "Đi tới giỏ hàng",
        "enrolled": "Đã đăng ký",
        "continueLearning": "Tiếp tục học",
        "upgradeToFull": "Nâng cấp lên cả khóa",
        "upgradeSave": "Tiết kiệm {amount} khi nâng cấp",
      },
      "preview": "Xem trước",
      "previewVideo": "Video giới thiệu",
    },
    "reviews": {
      "title": "Đánh giá từ học viên",
      "averageRating": "Đánh giá trung bình",
      "totalReviews": "{count} đánh giá",
      "writeReview": "Viết đánh giá",
      "editReview": "Chỉnh sửa đánh giá",
      "yourRating": "Đánh giá của bạn",
      "yourReview": "Nhận xét của bạn",
      "reviewPlaceholder": "Chia sẻ trải nghiệm học tập của bạn...",
      "submitReview": "Gửi đánh giá",
      "reviewRequirement": "Bạn cần hoàn thành ít nhất 30% khóa học để đánh giá",
      "helpful": "Hữu ích ({count})",
      "report": "Báo cáo",
      "stars": {
        "1": "Rất tệ",
        "2": "Tệ",
        "3": "Bình thường",
        "4": "Tốt",
        "5": "Xuất sắc",
      },
    },
  },

  // ============================================================
  // LEARNING — Course player & progress
  // ============================================================
  "learning": {
    "player": {
      "curriculum": "Nội dung",
      "notes": "Ghi chú",
      "qna": "Hỏi đáp",
      "resources": "Tài liệu",
      "aiTutor": "AI Tutor",
      "progress": "Tiến trình: {percent}%",
      "completed": "Đã hoàn thành",
      "markComplete": "Đánh dấu hoàn thành",
      "nextLesson": "Bài tiếp theo",
      "previousLesson": "Bài trước",
      "autoPlay": "Tự động phát",
      "speed": "Tốc độ",
      "quality": "Chất lượng",
      "lessonType": {
        "VIDEO": "Video",
        "TEXT": "Bài viết",
        "QUIZ": "Bài kiểm tra",
      },
    },
    "quiz": {
      "title": "Bài kiểm tra",
      "question": "Câu hỏi {current}/{total}",
      "submit": "Nộp bài",
      "result": "Kết quả",
      "score": "Điểm: {score}/{total}",
      "passed": "Bạn đã vượt qua!",
      "failed": "Chưa đạt. Hãy thử lại!",
      "passScore": "Điểm đạt: {score}%",
      "retake": "Làm lại",
      "explanation": "Giải thích",
      "correct": "Đáp án đúng",
      "incorrect": "Đáp án sai",
      "yourAnswer": "Câu trả lời của bạn",
    },
    "dashboard": {
      "title": "Học tập của tôi",
      "inProgress": "Đang học",
      "completed": "Đã hoàn thành",
      "all": "Tất cả",
      "streak": {
        "title": "Chuỗi ngày học",
        "days": "{count} ngày",
        "current": "Hiện tại",
        "longest": "Dài nhất",
        "keepGoing": "Tiếp tục học để giữ streak!",
      },
      "stats": {
        "coursesInProgress": "Đang học",
        "coursesCompleted": "Hoàn thành",
        "totalHours": "Giờ học",
        "certificates": "Chứng chỉ",
      },
      "continueLearning": "Tiếp tục học",
      "skillsMap": "Bản đồ kỹ năng",
    },
    "certificate": {
      "title": "Chứng chỉ hoàn thành",
      "awarded": "Trao cho",
      "completion": "đã hoàn thành khóa học",
      "date": "Ngày cấp: {date}",
      "id": "Mã chứng chỉ: {id}",
      "verify": "Xác minh chứng chỉ",
      "download": "Tải chứng chỉ",
      "share": "Chia sẻ",
    },
  },

  // ============================================================
  // SOCIAL — Feed, Chat, Groups
  // ============================================================
  "social": {
    "feed": {
      "title": "Bảng tin",
      "createPost": "Bạn đang nghĩ gì?",
      "postPlaceholder": "Chia sẻ kiến thức, câu hỏi hoặc kinh nghiệm...",
      "addImage": "Thêm ảnh",
      "addCode": "Thêm code",
      "post": "Đăng bài",
      "like": "Thích",
      "liked": "Đã thích",
      "comment": "Bình luận",
      "comments": "{count} bình luận",
      "share": "Chia sẻ",
      "bookmark": "Lưu",
      "bookmarked": "Đã lưu",
      "report": "Báo cáo",
      "delete": "Xóa bài viết",
      "edit": "Chỉnh sửa",
      "writeComment": "Viết bình luận...",
      "viewAllComments": "Xem tất cả {count} bình luận",
      "emptyFeed": "Bảng tin trống",
      "emptyFeedSub": "Hãy follow người khác để xem bài viết",
      "exploreUsers": "Khám phá",
    },
    "chat": {
      "title": "Tin nhắn",
      "searchConversation": "Tìm kiếm cuộc trò chuyện...",
      "newMessage": "Tin nhắn mới",
      "typePlaceholder": "Nhập tin nhắn...",
      "sendImage": "Gửi ảnh",
      "sendFile": "Gửi file",
      "sendCode": "Gửi code",
      "typing": "{name} đang nhập...",
      "online": "Đang hoạt động",
      "offline": "Ngoại tuyến",
      "lastSeen": "Hoạt động {time}",
      "read": "Đã xem",
      "delivered": "Đã gửi",
      "noConversations": "Chưa có cuộc trò chuyện",
      "startChat": "Bắt đầu trò chuyện",
    },
    "groups": {
      "title": "Nhóm",
      "myGroups": "Nhóm của tôi",
      "discover": "Khám phá nhóm",
      "create": "Tạo nhóm",
      "groupName": "Tên nhóm",
      "description": "Mô tả",
      "members": "{count} thành viên",
      "join": "Tham gia",
      "leave": "Rời nhóm",
      "joined": "Đã tham gia",
      "admin": "Quản trị viên",
      "posts": "Bài viết",
      "about": "Giới thiệu",
    },
    "profile": {
      "followers": "{count} người theo dõi",
      "following": "{count} đang theo dõi",
      "follow": "Theo dõi",
      "unfollow": "Bỏ theo dõi",
      "message": "Nhắn tin",
      "posts": "Bài viết",
      "courses": "Khóa học",
      "about": "Giới thiệu",
      "skills": "Kỹ năng",
      "editProfile": "Chỉnh sửa hồ sơ",
      "bio": "Giới thiệu bản thân",
      "bioPlaceholder": "Viết vài dòng về bạn...",
      "socialLinks": "Liên kết",
      "joined": "Tham gia từ {date}",
    },
  },

  // ============================================================
  // QNA — Q&A Forum
  // ============================================================
  "qna": {
    "title": "Hỏi đáp",
    "askQuestion": "Đặt câu hỏi",
    "questionTitle": "Tiêu đề câu hỏi",
    "questionTitlePlaceholder": "Câu hỏi của bạn là gì?",
    "questionBody": "Mô tả chi tiết",
    "questionBodyPlaceholder": "Mô tả chi tiết vấn đề của bạn...",
    "tags": "Thẻ",
    "tagsPlaceholder": "Thêm thẻ liên quan...",
    "course": "Khóa học liên quan",
    "submit": "Đăng câu hỏi",
    "answers": "{count} câu trả lời",
    "noAnswers": "Chưa có câu trả lời",
    "beFirstAnswer": "Hãy là người đầu tiên trả lời!",
    "writeAnswer": "Viết câu trả lời...",
    "submitAnswer": "Gửi câu trả lời",
    "bestAnswer": "Câu trả lời tốt nhất",
    "markBestAnswer": "Chọn làm câu trả lời tốt nhất",
    "upvote": "Hữu ích",
    "downvote": "Không hữu ích",
    "votes": "{count} lượt bình chọn",
    "similarQuestions": "Câu hỏi tương tự",
    "views": "{count} lượt xem",
    "solved": "Đã giải quyết",
    "unsolved": "Chưa giải quyết",
  },

  // ============================================================
  // AI — AI Tutor
  // ============================================================
  "ai": {
    "tutor": {
      "title": "AI Tutor",
      "subtitle": "Trợ lý AI thông minh dựa trên nội dung khóa học",
      "askPlaceholder": "Hỏi về nội dung khóa học...",
      "send": "Gửi",
      "thinking": "AI đang suy nghĩ...",
      "sessions": "Lịch sử hội thoại",
      "newSession": "Cuộc hội thoại mới",
      "usage": "{used}/{total} câu hỏi hôm nay",
      "limitReached": "Bạn đã hết lượt hỏi hôm nay. Quay lại vào ngày mai nhé!",
      "selectCourse": "Chọn khóa học để AI tư vấn chính xác hơn",
      "disclaimer": "AI có thể mắc sai sót. Hãy kiểm chứng thông tin quan trọng.",
    },
  },

  // ============================================================
  // ECOMMERCE — Cart, Checkout, Orders
  // ============================================================
  "ecommerce": {
    "cart": {
      "title": "Giỏ hàng",
      "items": "{count} khóa học",
      "empty": "Giỏ hàng trống",
      "emptySub": "Hãy thêm khóa học bạn yêu thích vào giỏ hàng",
      "browseCourses": "Khám phá khóa học",
      "remove": "Xóa",
      "moveToWishlist": "Chuyển vào yêu thích",
      "coupon": {
        "title": "Mã giảm giá",
        "placeholder": "Nhập mã giảm giá",
        "apply": "Áp dụng",
        "applied": "Đã áp dụng mã \"{code}\"",
        "remove": "Xóa mã",
        "invalid": "Mã giảm giá không hợp lệ",
        "expired": "Mã giảm giá đã hết hạn",
        "usageLimit": "Mã giảm giá đã hết lượt sử dụng",
        "minOrder": "Đơn hàng tối thiểu {amount} để áp dụng mã này",
      },
      "summary": {
        "subtotal": "Tạm tính",
        "discount": "Giảm giá",
        "total": "Tổng cộng",
        "checkout": "Thanh toán",
      },
    },
    "checkout": {
      "title": "Thanh toán",
      "orderSummary": "Tóm tắt đơn hàng",
      "paymentMethod": "Phương thức thanh toán",
      "bankTransfer": "Chuyển khoản ngân hàng (QR Code)",
      "placeOrder": "Đặt hàng",
      "processing": "Đang xử lý...",
    },
    "payment": {
      "title": "Thanh toán đơn hàng",
      "scanQR": "Quét mã QR để thanh toán",
      "orderCode": "Mã đơn hàng: {code}",
      "amount": "Số tiền: {amount}",
      "transferContent": "Nội dung chuyển khoản: {content}",
      "important": "Lưu ý quan trọng",
      "importantNote": "Vui lòng nhập đúng nội dung chuyển khoản để đơn hàng được xác nhận tự động",
      "expiresIn": "Đơn hàng hết hạn sau {time}",
      "waiting": "Đang chờ thanh toán...",
      "confirmed": "Thanh toán thành công!",
      "expired": "Đơn hàng đã hết hạn",
      "failed": "Thanh toán thất bại",
    },
    "orders": {
      "title": "Đơn hàng của tôi",
      "orderNumber": "Đơn hàng #{code}",
      "date": "Ngày đặt: {date}",
      "status": {
        "PENDING": "Chờ thanh toán",
        "COMPLETED": "Hoàn thành",
        "EXPIRED": "Hết hạn",
        "REFUNDED": "Đã hoàn tiền",
      },
      "details": "Chi tiết đơn hàng",
      "empty": "Bạn chưa có đơn hàng nào",
      "emptyAction": "Bắt đầu mua khóa học",
    },
    "wishlist": {
      "title": "Khóa học yêu thích",
      "empty": "Chưa có khóa học yêu thích",
      "addToCart": "Thêm vào giỏ hàng",
      "remove": "Xóa khỏi yêu thích",
    },
  },

  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  "notifications": {
    "title": "Thông báo",
    "markAllRead": "Đánh dấu tất cả đã đọc",
    "empty": "Không có thông báo mới",
    "unread": "{count} chưa đọc",
    "preferences": "Tùy chỉnh thông báo",
    "types": {
      "ENROLLMENT": "{user} đã đăng ký khóa học \"{course}\"",
      "NEW_LESSON": "Bài học mới trong \"{course}\": {lesson}",
      "COURSE_APPROVED": "Khóa học \"{course}\" đã được phê duyệt",
      "COURSE_REJECTED": "Khóa học \"{course}\" bị từ chối: {reason}",
      "NEW_REVIEW": "{user} đã đánh giá khóa học \"{course}\"",
      "NEW_FOLLOWER": "{user} đã theo dõi bạn",
      "POST_LIKE": "{user} đã thích bài viết của bạn",
      "POST_COMMENT": "{user} đã bình luận bài viết của bạn",
      "NEW_MESSAGE": "{user} đã gửi tin nhắn cho bạn",
      "ORDER_COMPLETED": "Đơn hàng #{code} đã được xác nhận",
      "WITHDRAWAL_COMPLETED": "Yêu cầu rút tiền {amount} đã hoàn tất",
      "NEW_ANSWER": "{user} đã trả lời câu hỏi của bạn",
      "BEST_ANSWER": "Câu trả lời của bạn được chọn là tốt nhất",
      "CERTIFICATE": "Bạn đã nhận chứng chỉ hoàn thành \"{course}\"",
      "INSTRUCTOR_APPROVED": "Đơn đăng ký giảng viên của bạn đã được duyệt!",
      "INSTRUCTOR_REJECTED": "Đơn đăng ký giảng viên bị từ chối: {reason}",
    },
  },

  // ============================================================
  // INSTRUCTOR — Become instructor (Student Portal)
  // ============================================================
  "instructor": {
    "apply": {
      "title": "Trở thành giảng viên",
      "subtitle": "Chia sẻ kiến thức và tạo thu nhập từ khóa học của bạn",
      "benefits": {
        "title": "Lợi ích khi trở thành giảng viên",
        "earn": "Tạo thu nhập từ khóa học",
        "reach": "Tiếp cận hàng nghìn học viên",
        "community": "Xây dựng cộng đồng học tập",
        "tools": "Công cụ quản lý chuyên nghiệp",
      },
      "form": {
        "expertise": "Lĩnh vực chuyên môn",
        "expertisePlaceholder": "VD: Lập trình Web, Data Science...",
        "experience": "Kinh nghiệm giảng dạy",
        "experiencePlaceholder": "Mô tả kinh nghiệm của bạn...",
        "motivation": "Lý do muốn trở thành giảng viên",
        "motivationPlaceholder": "Tại sao bạn muốn giảng dạy trên nền tảng?",
        "sampleLesson": "Link bài giảng mẫu (tùy chọn)",
        "submit": "Nộp đơn đăng ký",
      },
      "pending": "Đơn đăng ký đang được xem xét",
      "pendingSub": "Chúng tôi sẽ thông báo kết quả qua email trong vòng 3-5 ngày",
    },
  },

  // ============================================================
  // SETTINGS — User settings
  // ============================================================
  "settings": {
    "title": "Cài đặt",
    "profile": {
      "title": "Hồ sơ cá nhân",
      "avatar": "Ảnh đại diện",
      "changeAvatar": "Đổi ảnh đại diện",
      "fullName": "Họ và tên",
      "bio": "Giới thiệu bản thân",
      "phone": "Số điện thoại",
      "socialLinks": "Liên kết mạng xã hội",
      "save": "Lưu thay đổi",
    },
    "account": {
      "title": "Tài khoản",
      "changePassword": "Đổi mật khẩu",
      "currentPassword": "Mật khẩu hiện tại",
      "newPassword": "Mật khẩu mới",
      "confirmPassword": "Xác nhận mật khẩu mới",
      "deleteAccount": "Xóa tài khoản",
      "deleteWarning": "Hành động này không thể hoàn tác. Tất cả dữ liệu sẽ bị xóa vĩnh viễn.",
    },
    "notifications": {
      "title": "Thông báo",
      "email": "Thông báo qua email",
      "push": "Thông báo đẩy",
      "categories": {
        "learning": "Học tập (bài học mới, nhắc học)",
        "social": "Xã hội (like, comment, follow)",
        "ecommerce": "Mua sắm (đơn hàng, giảm giá)",
        "system": "Hệ thống (bảo mật, cập nhật)",
      },
    },
    "appearance": {
      "title": "Giao diện",
      "theme": "Chủ đề",
      "language": "Ngôn ngữ",
    },
  },

  // ============================================================
  // ERROR PAGES
  // ============================================================
  "error": {
    "404": {
      "title": "Không tìm thấy trang",
      "message": "Trang bạn đang tìm không tồn tại hoặc đã bị di chuyển.",
      "goHome": "Về trang chủ",
    },
    "500": {
      "title": "Lỗi hệ thống",
      "message": "Đã xảy ra lỗi. Vui lòng thử lại sau.",
      "retry": "Thử lại",
    },
    "403": {
      "title": "Không có quyền truy cập",
      "message": "Bạn không có quyền truy cập trang này.",
      "goHome": "Về trang chủ",
    },
    "maintenance": {
      "title": "Đang bảo trì",
      "message": "Hệ thống đang được bảo trì. Vui lòng quay lại sau.",
    },
    "offline": {
      "title": "Mất kết nối",
      "message": "Vui lòng kiểm tra kết nối mạng và thử lại.",
      "retry": "Thử lại",
    },
  },

  // ============================================================
  // MANAGEMENT PORTAL — Instructor
  // ============================================================
  "management": {
    "nav": {
      "dashboard": "Bảng điều khiển",
      "courses": "Khóa học",
      "revenue": "Doanh thu",
      "coupons": "Mã giảm giá",
      "qna": "Hỏi đáp",
      "settings": "Cài đặt",
      "backToStudent": "Về Student Portal",
    },
    "dashboard": {
      "title": "Bảng điều khiển",
      "welcome": "Xin chào, {name}!",
      "totalRevenue": "Tổng doanh thu",
      "totalStudents": "Tổng học viên",
      "totalCourses": "Tổng khóa học",
      "averageRating": "Đánh giá TB",
      "revenueChart": "Biểu đồ doanh thu",
      "recentEnrollments": "Đăng ký gần đây",
      "topCourses": "Khóa học bán chạy",
    },
    "courseEditor": {
      "create": "Tạo khóa học mới",
      "edit": "Chỉnh sửa khóa học",
      "steps": {
        "info": "Thông tin cơ bản",
        "curriculum": "Nội dung",
        "pricing": "Định giá",
        "review": "Xem lại",
      },
      "info": {
        "title": "Tên khóa học",
        "titlePlaceholder": "VD: Lập trình React từ cơ bản đến nâng cao",
        "subtitle": "Mô tả ngắn",
        "description": "Mô tả chi tiết",
        "category": "Danh mục",
        "level": "Trình độ",
        "tags": "Thẻ",
        "thumbnail": "Ảnh bìa",
        "previewVideo": "Video giới thiệu",
        "language": "Ngôn ngữ giảng dạy",
        "whatYouLearn": "Học viên sẽ học được gì",
        "requirements": "Yêu cầu tiên quyết",
      },
      "curriculum": {
        "addSection": "Thêm phần",
        "addChapter": "Thêm chương",
        "addLesson": "Thêm bài học",
        "sectionTitle": "Tên phần",
        "chapterTitle": "Tên chương",
        "lessonTitle": "Tên bài học",
        "lessonType": "Loại bài học",
        "video": "Video",
        "text": "Bài viết",
        "quiz": "Bài kiểm tra",
        "uploadVideo": "Tải video lên",
        "textContent": "Nội dung bài viết",
        "isFree": "Miễn phí (preview)",
        "dragToReorder": "Kéo để sắp xếp lại",
      },
      "pricing": {
        "fullPrice": "Giá cả khóa",
        "chapterPricing": "Giá theo chương",
        "chapterPrice": "Giá chương \"{name}\"",
        "sumWarning": "Tổng giá các chương ({sum}) phải lớn hơn giá cả khóa ({full}) để khuyến khích mua cả khóa",
        "free": "Miễn phí",
      },
      "submit": {
        "saveDraft": "Lưu nháp",
        "submitReview": "Gửi duyệt",
        "submitConfirm": "Bạn có chắc chắn muốn gửi khóa học để duyệt?",
        "submitSuccess": "Khóa học đã được gửi duyệt thành công",
      },
      "status": {
        "DRAFT": "Nháp",
        "PENDING_REVIEW": "Chờ duyệt",
        "APPROVED": "Đã duyệt",
        "REJECTED": "Bị từ chối",
        "PUBLISHED": "Đang bán",
      },
    },
    "revenue": {
      "title": "Doanh thu",
      "available": "Số dư khả dụng",
      "pending": "Đang chờ (7 ngày)",
      "withdrawn": "Đã rút",
      "total": "Tổng doanh thu",
      "withdraw": "Yêu cầu rút tiền",
      "withdrawAmount": "Số tiền muốn rút",
      "bankAccount": "Tài khoản ngân hàng",
      "bankName": "Ngân hàng",
      "accountNumber": "Số tài khoản",
      "accountHolder": "Chủ tài khoản",
      "minWithdraw": "Số tiền rút tối thiểu: {amount}",
      "withdrawHistory": "Lịch sử rút tiền",
      "withdrawStatus": {
        "PENDING": "Đang xử lý",
        "COMPLETED": "Hoàn thành",
        "REJECTED": "Bị từ chối",
      },
      "earningsChart": "Biểu đồ thu nhập",
      "earningsByMonth": "Thu nhập theo tháng",
      "earningsByCourse": "Thu nhập theo khóa học",
    },
    "coupons": {
      "title": "Mã giảm giá",
      "create": "Tạo mã giảm giá",
      "code": "Mã",
      "discount": "Giảm giá",
      "type": {
        "PERCENTAGE": "Phần trăm (%)",
        "FIXED": "Cố định (VNĐ)",
      },
      "appliesTo": "Áp dụng cho",
      "allCourses": "Tất cả khóa học",
      "specificCourses": "Khóa học cụ thể",
      "maxUsage": "Giới hạn sử dụng",
      "usageCount": "Đã dùng: {used}/{max}",
      "validFrom": "Hiệu lực từ",
      "validUntil": "Hiệu lực đến",
      "minOrder": "Đơn hàng tối thiểu",
      "active": "Đang hoạt động",
      "expired": "Hết hạn",
      "disabled": "Đã tắt",
    },
  },

  // ============================================================
  // ADMIN — Admin-specific translations
  // ============================================================
  "admin": {
    "nav": {
      "dashboard": "Bảng điều khiển",
      "users": "Quản lý người dùng",
      "approvals": "Phê duyệt",
      "instructorApps": "Đơn giảng viên",
      "courseReviews": "Duyệt khóa học",
      "courses": "Khóa học",
      "categories": "Danh mục",
      "withdrawals": "Rút tiền",
      "reports": "Báo cáo",
      "analytics": "Thống kê",
      "settings": "Cấu hình",
    },
    "dashboard": {
      "title": "Thống kê nền tảng",
      "totalUsers": "Tổng người dùng",
      "totalCourses": "Tổng khóa học",
      "totalRevenue": "Tổng doanh thu",
      "activeUsers": "Người dùng hoạt động",
      "newUsersToday": "Đăng ký hôm nay",
      "pendingApprovals": "Chờ phê duyệt",
      "revenueChart": "Doanh thu theo tháng",
      "userGrowth": "Tăng trưởng người dùng",
      "topCategories": "Danh mục phổ biến",
    },
    "users": {
      "title": "Quản lý người dùng",
      "search": "Tìm kiếm người dùng...",
      "role": "Vai trò",
      "status": "Trạng thái",
      "actions": "Hành động",
      "suspend": "Tạm khóa",
      "unsuspend": "Mở khóa",
      "changeRole": "Đổi vai trò",
      "viewProfile": "Xem hồ sơ",
      "userStatus": {
        "ACTIVE": "Hoạt động",
        "UNVERIFIED": "Chưa xác minh",
        "SUSPENDED": "Bị khóa",
      },
    },
    "approvals": {
      "instructorApps": {
        "title": "Đơn đăng ký giảng viên",
        "approve": "Duyệt",
        "reject": "Từ chối",
        "rejectReason": "Lý do từ chối",
        "rejectReasonPlaceholder": "Nhập lý do từ chối...",
        "pending": "Chờ duyệt",
        "approved": "Đã duyệt",
        "rejected": "Đã từ chối",
      },
      "courseReviews": {
        "title": "Duyệt khóa học",
        "approve": "Phê duyệt",
        "reject": "Từ chối",
        "rejectReason": "Lý do từ chối",
        "checklist": {
          "contentQuality": "Chất lượng nội dung",
          "videoQuality": "Chất lượng video",
          "pricing": "Giá cả hợp lý",
          "description": "Mô tả đầy đủ",
          "noViolation": "Không vi phạm",
        },
      },
    },
    "reports": {
      "title": "Báo cáo vi phạm",
      "type": "Loại",
      "reporter": "Người báo cáo",
      "target": "Đối tượng",
      "reason": "Lý do",
      "status": {
        "PENDING": "Chờ xử lý",
        "RESOLVED": "Đã xử lý",
        "DISMISSED": "Đã bác bỏ",
      },
      "actions": {
        "dismiss": "Bác bỏ",
        "warn": "Cảnh cáo",
        "remove": "Xóa nội dung",
        "suspend": "Tạm khóa tài khoản",
      },
    },
    "categories": {
      "title": "Quản lý danh mục",
      "create": "Tạo danh mục",
      "name": "Tên danh mục",
      "slug": "Slug",
      "icon": "Icon",
      "parent": "Danh mục cha",
      "coursesCount": "Số khóa học",
    },
    "withdrawals": {
      "title": "Yêu cầu rút tiền",
      "approve": "Duyệt & đánh dấu đã chuyển",
      "reject": "Từ chối",
      "rejectReason": "Lý do từ chối",
      "amount": "Số tiền",
      "instructor": "Giảng viên",
      "bankInfo": "Thông tin NH",
      "status": {
        "PENDING": "Chờ xử lý",
        "COMPLETED": "Hoàn thành",
        "REJECTED": "Từ chối",
      },
    },
    "settings": {
      "title": "Cấu hình hệ thống",
      "commission": {
        "title": "Hoa hồng",
        "rate": "Tỷ lệ hoa hồng (%)",
        "description": "Phần trăm nền tảng giữ lại từ mỗi giao dịch",
      },
      "platform": {
        "title": "Thông tin nền tảng",
        "name": "Tên nền tảng",
        "description": "Mô tả",
        "contactEmail": "Email liên hệ",
      },
    },
  },

  // ============================================================
  // FOOTER
  // ============================================================
  "footer": {
    "about": "Giới thiệu",
    "contact": "Liên hệ",
    "terms": "Điều khoản sử dụng",
    "privacy": "Chính sách bảo mật",
    "helpCenter": "Trung tâm trợ giúp",
    "copyright": "© {year} Smart Social Learning. All rights reserved.",
  },
}
```

### English (en.json) — Secondary Locale

```jsonc
// packages/i18n/messages/en.json (excerpt — same structure as vi.json)
{
  "common": {
    "appName": "Smart Social Learning",
    "theme": {
      "toggle": "Toggle theme",
      "light": "Light",
      "dark": "Dark",
      "system": "System",
    },
    "locale": {
      "switch": "Switch language",
      "vi": "Tiếng Việt",
      "en": "English",
    },
    "action": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "create": "Create",
      "submit": "Submit",
      "confirm": "Confirm",
      "close": "Close",
      "back": "Back",
      "next": "Next",
      "previous": "Previous",
      "search": "Search",
      "filter": "Filter",
      "sort": "Sort",
      "loadMore": "Load more",
      "refresh": "Refresh",
      "retry": "Retry",
      "viewAll": "View all",
      "learnMore": "Learn more",
      "apply": "Apply",
      "reset": "Reset",
      "upload": "Upload",
      "download": "Download",
      "share": "Share",
      "copy": "Copy",
      "copied": "Copied",
    },
    "status": {
      "loading": "Loading...",
      "saving": "Saving...",
      "processing": "Processing...",
      "uploading": "Uploading...",
      "success": "Success",
      "error": "Something went wrong",
      "noResults": "No results found",
      "empty": "Empty",
    },
    "time": {
      "justNow": "Just now",
      "minutesAgo": "{count, plural, one {# minute ago} other {# minutes ago}}",
      "hoursAgo": "{count, plural, one {# hour ago} other {# hours ago}}",
      "daysAgo": "{count, plural, one {# day ago} other {# days ago}}",
      "weeksAgo": "{count, plural, one {# week ago} other {# weeks ago}}",
    },
    "pagination": {
      "page": "Page {current} of {total}",
      "showing": "Showing {from}-{to} of {total}",
      "perPage": "Per page",
      "first": "First",
      "last": "Last",
      "next": "Next",
      "previous": "Previous",
    },
    "confirm": {
      "title": "Confirm",
      "deleteTitle": "Confirm deletion",
      "deleteMessage": "Are you sure you want to delete? This action cannot be undone.",
      "unsavedChanges": "You have unsaved changes. Are you sure you want to leave?",
    },
  },

  "validation": {
    "required": "This field is required",
    "email": "Invalid email address",
    "url": "Invalid URL",
    "min": "Minimum {min} characters",
    "max": "Maximum {max} characters",
    "minNumber": "Minimum value is {min}",
    "maxNumber": "Maximum value is {max}",
    "password": {
      "min": "Password must be at least 8 characters",
      "uppercase": "Password must contain at least 1 uppercase letter",
      "number": "Password must contain at least 1 number",
      "match": "Passwords do not match",
    },
    "fullName": {
      "min": "Name must be at least 2 characters",
      "max": "Name must not exceed 100 characters",
    },
    "file": {
      "tooLarge": "File is too large. Maximum {max}",
      "invalidType": "File type not supported",
      "uploadFailed": "File upload failed",
    },
  },

  "auth": {
    "login": {
      "title": "Sign in",
      "subtitle": "Welcome back",
      "email": "Email",
      "emailPlaceholder": "Enter your email",
      "password": "Password",
      "passwordPlaceholder": "Enter your password",
      "submit": "Sign in",
      "forgotPassword": "Forgot password?",
      "noAccount": "Don't have an account?",
      "signUp": "Sign up",
      "orContinueWith": "Or continue with",
      "google": "Sign in with Google",
      "submitting": "Signing in...",
    },
    "register": {
      "title": "Sign up",
      "subtitle": "Create an account to start learning",
      "fullName": "Full name",
      "fullNamePlaceholder": "Enter your full name",
      "email": "Email",
      "emailPlaceholder": "Enter your email",
      "password": "Password",
      "passwordPlaceholder": "Create a password",
      "confirmPassword": "Confirm password",
      "confirmPasswordPlaceholder": "Re-enter your password",
      "submit": "Sign up",
      "hasAccount": "Already have an account?",
      "signIn": "Sign in",
      "orContinueWith": "Or continue with",
      "google": "Sign up with Google",
      "termsAgree": "By signing up, you agree to our",
      "terms": "Terms of Service",
      "and": "and",
      "privacy": "Privacy Policy",
      "submitting": "Creating account...",
    },
    "verifyEmail": {
      "title": "Verify your email",
      "message": "We've sent a verification email to {email}. Please check your inbox.",
      "resend": "Resend verification email",
      "resendSuccess": "Verification email resent",
      "resendCooldown": "Please wait {seconds} seconds",
      "verified": "Email verified successfully!",
      "expired": "Verification link has expired. Please request a new one.",
    },
    "forgotPassword": {
      "title": "Forgot password",
      "subtitle": "Enter your email to receive a password reset link",
      "email": "Email",
      "submit": "Send reset link",
      "success": "Password reset link sent to your email",
      "backToLogin": "Back to sign in",
    },
    "resetPassword": {
      "title": "Reset password",
      "newPassword": "New password",
      "confirmPassword": "Confirm new password",
      "submit": "Reset password",
      "success": "Password reset successfully. Please sign in.",
      "expired": "Password reset link has expired",
    },
    "logout": "Sign out",
    "sessionExpired": "Your session has expired. Please sign in again.",
  },

  "nav": {
    "home": "Home",
    "courses": "Courses",
    "myCourses": "My Courses",
    "myLearning": "My Learning",
    "social": "Community",
    "feed": "Feed",
    "chat": "Messages",
    "groups": "Groups",
    "qna": "Q&A",
    "notifications": "Notifications",
    "cart": "Cart",
    "wishlist": "Wishlist",
    "profile": "Profile",
    "settings": "Settings",
    "orders": "Orders",
    "certificates": "Certificates",
    "aiTutor": "AI Tutor",
    "becomeInstructor": "Become an Instructor",
    "managementPortal": "Management Portal",
    "searchPlaceholder": "Search courses, posts...",
  },

  // ... (same structure for courses, learning, social, qna, ai, ecommerce,
  //      notifications, instructor, settings, management, admin, footer, error)
  // Mỗi key tương ứng 1:1 với vi.json nhưng text tiếng Anh
}
```

---

## 2.4 Backend API Message Mapping

### Strategy: Error Code → Frontend Translation Key

```
Backend Response Format:
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "EMAIL_ALREADY_EXISTS",    ← Error code (machine-readable)
  "details": { "field": "email" }        ← Optional context
}

Frontend maps error code → localized message:
  "EMAIL_ALREADY_EXISTS" → t('apiErrors.EMAIL_ALREADY_EXISTS')
                         → "Email này đã được sử dụng" (vi)
                         → "This email is already in use" (en)
```

### API Error Code Mapping

```jsonc
// Thêm vào vi.json / en.json

// Vietnamese
{
  "apiErrors": {
    // Auth
    "EMAIL_ALREADY_EXISTS": "Email này đã được sử dụng",
    "INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng",
    "ACCOUNT_NOT_VERIFIED": "Tài khoản chưa được xác minh. Vui lòng kiểm tra email.",
    "ACCOUNT_SUSPENDED": "Tài khoản đã bị tạm khóa. Liên hệ admin để biết thêm.",
    "TOKEN_EXPIRED": "Phiên đăng nhập đã hết hạn",
    "INVALID_TOKEN": "Link không hợp lệ hoặc đã hết hạn",
    "TOO_MANY_ATTEMPTS": "Quá nhiều lần thử. Vui lòng đợi {minutes} phút.",
    "GOOGLE_AUTH_FAILED": "Đăng nhập Google thất bại. Vui lòng thử lại.",
    "NOT_INSTRUCTOR": "Bạn không có quyền truy cập cổng quản lý",
    "OTT_EXPIRED": "Link chuyển portal đã hết hạn. Vui lòng thử lại.",

    // User
    "USER_NOT_FOUND": "Không tìm thấy người dùng",
    "CANNOT_FOLLOW_SELF": "Bạn không thể tự theo dõi chính mình",
    "ALREADY_FOLLOWING": "Bạn đã theo dõi người dùng này rồi",

    // Course
    "COURSE_NOT_FOUND": "Không tìm thấy khóa học",
    "COURSE_NOT_PUBLISHED": "Khóa học này chưa được công bố",
    "ALREADY_ENROLLED": "Bạn đã đăng ký khóa học này rồi",
    "NOT_ENROLLED": "Bạn chưa đăng ký khóa học này",
    "COURSE_NOT_OWNED": "Bạn không phải chủ sở hữu khóa học này",
    "CANNOT_DELETE_PUBLISHED": "Không thể xóa khóa học đã được công bố",
    "INVALID_PRICING": "Tổng giá các chương phải lớn hơn giá cả khóa",

    // Ecommerce
    "CART_EMPTY": "Giỏ hàng trống",
    "ITEM_ALREADY_IN_CART": "Khóa học đã có trong giỏ hàng",
    "COUPON_NOT_FOUND": "Mã giảm giá không hợp lệ",
    "COUPON_EXPIRED": "Mã giảm giá đã hết hạn",
    "COUPON_USAGE_LIMIT": "Mã giảm giá đã hết lượt sử dụng",
    "COUPON_MIN_ORDER": "Đơn hàng chưa đạt giá trị tối thiểu {amount}",
    "ORDER_NOT_FOUND": "Không tìm thấy đơn hàng",
    "ORDER_EXPIRED": "Đơn hàng đã hết hạn thanh toán",
    "PAYMENT_AMOUNT_MISMATCH": "Số tiền thanh toán không khớp",

    // Learning
    "LESSON_LOCKED": "Bạn chưa mua chương chứa bài học này",
    "QUIZ_ALREADY_SUBMITTED": "Bạn đã nộp bài kiểm tra này rồi",
    "REVIEW_MIN_PROGRESS": "Bạn cần hoàn thành ít nhất 30% khóa học để đánh giá",
    "ALREADY_REVIEWED": "Bạn đã đánh giá khóa học này rồi",

    // Social
    "POST_NOT_FOUND": "Không tìm thấy bài viết",
    "COMMENT_NOT_FOUND": "Không tìm thấy bình luận",
    "GROUP_NOT_FOUND": "Không tìm thấy nhóm",
    "ALREADY_MEMBER": "Bạn đã là thành viên nhóm này",
    "NOT_GROUP_MEMBER": "Bạn không phải thành viên nhóm này",
    "CANNOT_LEAVE_OWN_GROUP": "Chủ nhóm không thể rời nhóm",

    // Q&A
    "QUESTION_NOT_FOUND": "Không tìm thấy câu hỏi",
    "ANSWER_NOT_FOUND": "Không tìm thấy câu trả lời",
    "NOT_QUESTION_OWNER": "Chỉ người hỏi mới có thể chọn câu trả lời tốt nhất",

    // AI
    "AI_DAILY_LIMIT": "Bạn đã hết lượt hỏi AI hôm nay ({limit} câu/ngày)",
    "AI_SERVICE_UNAVAILABLE": "AI Tutor đang bận. Vui lòng thử lại sau.",

    // Instructor
    "APPLICATION_ALREADY_EXISTS": "Bạn đã nộp đơn đăng ký giảng viên rồi",
    "INSUFFICIENT_BALANCE": "Số dư không đủ để rút tiền",
    "MIN_WITHDRAWAL": "Số tiền rút tối thiểu là {amount}",
    "WITHDRAWAL_PENDING": "Bạn đang có yêu cầu rút tiền chưa xử lý",

    // Upload
    "FILE_TOO_LARGE": "File quá lớn. Tối đa {max}MB",
    "INVALID_FILE_TYPE": "Định dạng file không được hỗ trợ",
    "UPLOAD_FAILED": "Tải lên thất bại. Vui lòng thử lại.",

    // Generic
    "FORBIDDEN": "Bạn không có quyền thực hiện hành động này",
    "NOT_FOUND": "Không tìm thấy tài nguyên",
    "RATE_LIMITED": "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
    "SERVER_ERROR": "Lỗi hệ thống. Vui lòng thử lại sau.",
    "VALIDATION_FAILED": "Dữ liệu không hợp lệ"
  }
}

// English
{
  "apiErrors": {
    "EMAIL_ALREADY_EXISTS": "This email is already in use",
    "INVALID_CREDENTIALS": "Invalid email or password",
    "ACCOUNT_NOT_VERIFIED": "Account not verified. Please check your email.",
    "ACCOUNT_SUSPENDED": "Account suspended. Contact admin for more info.",
    "TOKEN_EXPIRED": "Session expired",
    "INVALID_TOKEN": "Invalid or expired link",
    "TOO_MANY_ATTEMPTS": "Too many attempts. Please wait {minutes} minutes.",
    "GOOGLE_AUTH_FAILED": "Google sign-in failed. Please try again.",
    "NOT_INSTRUCTOR": "You don't have access to the management portal",
    "OTT_EXPIRED": "Portal redirect link expired. Please try again.",
    "USER_NOT_FOUND": "User not found",
    "CANNOT_FOLLOW_SELF": "You cannot follow yourself",
    "ALREADY_FOLLOWING": "You are already following this user",
    "COURSE_NOT_FOUND": "Course not found",
    "COURSE_NOT_PUBLISHED": "This course is not published",
    "ALREADY_ENROLLED": "You are already enrolled in this course",
    "NOT_ENROLLED": "You are not enrolled in this course",
    "COURSE_NOT_OWNED": "You do not own this course",
    "CANNOT_DELETE_PUBLISHED": "Cannot delete a published course",
    "INVALID_PRICING": "Total chapter prices must be greater than full course price",
    "CART_EMPTY": "Cart is empty",
    "ITEM_ALREADY_IN_CART": "Course is already in cart",
    "COUPON_NOT_FOUND": "Invalid coupon code",
    "COUPON_EXPIRED": "Coupon has expired",
    "COUPON_USAGE_LIMIT": "Coupon usage limit reached",
    "COUPON_MIN_ORDER": "Order does not meet minimum amount of {amount}",
    "ORDER_NOT_FOUND": "Order not found",
    "ORDER_EXPIRED": "Order payment has expired",
    "PAYMENT_AMOUNT_MISMATCH": "Payment amount does not match",
    "LESSON_LOCKED": "You have not purchased the chapter containing this lesson",
    "QUIZ_ALREADY_SUBMITTED": "You have already submitted this quiz",
    "REVIEW_MIN_PROGRESS": "You need at least 30% progress to review this course",
    "ALREADY_REVIEWED": "You have already reviewed this course",
    "POST_NOT_FOUND": "Post not found",
    "COMMENT_NOT_FOUND": "Comment not found",
    "GROUP_NOT_FOUND": "Group not found",
    "ALREADY_MEMBER": "You are already a member of this group",
    "NOT_GROUP_MEMBER": "You are not a member of this group",
    "CANNOT_LEAVE_OWN_GROUP": "Group owner cannot leave the group",
    "QUESTION_NOT_FOUND": "Question not found",
    "ANSWER_NOT_FOUND": "Answer not found",
    "NOT_QUESTION_OWNER": "Only the question author can select the best answer",
    "AI_DAILY_LIMIT": "You've reached the AI daily limit ({limit} questions/day)",
    "AI_SERVICE_UNAVAILABLE": "AI Tutor is busy. Please try again later.",
    "APPLICATION_ALREADY_EXISTS": "You have already submitted an instructor application",
    "INSUFFICIENT_BALANCE": "Insufficient balance for withdrawal",
    "MIN_WITHDRAWAL": "Minimum withdrawal amount is {amount}",
    "WITHDRAWAL_PENDING": "You have a pending withdrawal request",
    "FILE_TOO_LARGE": "File too large. Maximum {max}MB",
    "INVALID_FILE_TYPE": "File type not supported",
    "UPLOAD_FAILED": "Upload failed. Please try again.",
    "FORBIDDEN": "You don't have permission to perform this action",
    "NOT_FOUND": "Resource not found",
    "RATE_LIMITED": "Too many requests. Please try again later.",
    "SERVER_ERROR": "System error. Please try again later.",
    "VALIDATION_FAILED": "Invalid data"
  }
}
```

### Frontend Error Handler

```typescript
// packages/api-client/src/error-handler.ts
import { useTranslations } from 'next-intl';

interface ApiError {
  statusCode: number;
  error: string;
  message: string; // Error code: "EMAIL_ALREADY_EXISTS"
  details?: Record<string, unknown>;
}

/**
 * Maps API error code to localized user-friendly message
 */
export function useApiErrorMessage() {
  const t = useTranslations('apiErrors');

  return function getErrorMessage(error: ApiError): string {
    const code = error.message;

    // Check if we have a translation for this error code
    try {
      // Interpolate dynamic values from details
      return t(code, error.details ?? {});
    } catch {
      // Fallback: generic error by status code
      if (error.statusCode === 401) return t('TOKEN_EXPIRED');
      if (error.statusCode === 403) return t('FORBIDDEN');
      if (error.statusCode === 404) return t('NOT_FOUND');
      if (error.statusCode === 429) return t('RATE_LIMITED');
      return t('SERVER_ERROR');
    }
  };
}

// Usage in components:
function SomeComponent() {
  const getErrorMessage = useApiErrorMessage();

  async function handleSubmit() {
    try {
      await api.post('/auth/register', data);
    } catch (err) {
      const message = getErrorMessage(err as ApiError);
      toast.error(message); // "Email này đã được sử dụng"
    }
  }
}
```

---

## 2.5 Backend Integration — Error Code Convention

### Backend (NestJS) — Trả error code thay vì message text

```typescript
// Backend phải trả error code KHÔNG phải message text
// Frontend sẽ map code → localized message

// ❌ SAI — Backend trả message text
throw new ConflictException('Email này đã được sử dụng');

// ✅ ĐÚNG — Backend trả error code + optional details
throw new ConflictException({
  statusCode: 409,
  error: 'Conflict',
  message: 'EMAIL_ALREADY_EXISTS',
  details: { field: 'email' },
});

// Helper class cho backend:
class ApiException extends HttpException {
  constructor(status: number, code: string, details?: Record<string, unknown>) {
    super(
      {
        statusCode: status,
        error: HttpStatus[status],
        message: code, // Machine-readable error code
        details, // Optional context for interpolation
      },
      status,
    );
  }
}

// Usage:
throw new ApiException(409, 'EMAIL_ALREADY_EXISTS', { field: 'email' });
throw new ApiException(400, 'COUPON_MIN_ORDER', { amount: '200,000₫' });
throw new ApiException(429, 'AI_DAILY_LIMIT', { limit: 10 });
throw new ApiException(400, 'MIN_WITHDRAWAL', { amount: '200,000₫' });
```

### Backend Success Messages — Cũng dùng code

```typescript
// Backend success response:
{
  "data": { ... },
  "message": "REGISTER_SUCCESS"    // Optional success code
}

// Frontend maps:
{
  "apiSuccess": {
    "REGISTER_SUCCESS": "Đăng ký thành công. Vui lòng kiểm tra email.",
    "LOGIN_SUCCESS": "Đăng nhập thành công",
    "PROFILE_UPDATED": "Cập nhật hồ sơ thành công",
    "PASSWORD_CHANGED": "Đổi mật khẩu thành công",
    "REVIEW_SUBMITTED": "Đánh giá đã được gửi",
    "ORDER_CREATED": "Đơn hàng đã được tạo",
    "WITHDRAWAL_REQUESTED": "Yêu cầu rút tiền đã được gửi",
    "COURSE_SUBMITTED": "Khóa học đã được gửi duyệt",
    "APPLICATION_SUBMITTED": "Đơn đăng ký giảng viên đã được gửi",
    "REPORT_SUBMITTED": "Báo cáo đã được gửi"
  }
}
```

---

## 2.6 Locale Switcher Component

```typescript
// packages/ui/src/components/ui/locale-switcher.tsx
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@shared/i18n/navigation'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Globe } from 'lucide-react'
import { locales, type Locale } from '@shared/i18n'

const localeLabels: Record<Locale, string> = {
  vi: '🇻🇳 Tiếng Việt',
  en: '🇬🇧 English',
}

export function LocaleSwitcher() {
  const t = useTranslations('common.locale')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function switchLocale(newLocale: Locale) {
    router.replace(pathname, { locale: newLocale })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe className="h-4 w-4" />
          <span className="sr-only">{t('switch')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={locale === loc ? 'bg-accent' : ''}
          >
            {localeLabels[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## 2.7 Number & Date Formatting

```typescript
// packages/utils/src/format.ts
import { useFormatter } from 'next-intl';

// Price formatting (VNĐ)
export function useFormatPrice() {
  const format = useFormatter();
  return (amount: number) =>
    format.number(amount, {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0, // VNĐ không có số lẻ
    });
  // vi: "299.000 ₫"
  // en: "₫299,000"
}

// Date formatting
export function useFormatDate() {
  const format = useFormatter();
  return {
    short: (date: Date) =>
      format.dateTime(date, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    // vi: "13/03/2026" | en: "03/13/2026"

    long: (date: Date) =>
      format.dateTime(date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    // vi: "13 tháng 3, 2026" | en: "March 13, 2026"

    relative: (date: Date) => format.relativeTime(date),
    // vi: "2 giờ trước" | en: "2 hours ago"
  };
}

// Duration formatting (for video/course duration)
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Number formatting
export function useFormatNumber() {
  const format = useFormatter();
  return (num: number) => format.number(num);
  // vi: "1.234" | en: "1,234"
}
```

---

## 2.8 i18n Checklist — Đảm bảo đầy đủ

```
✅ UI Elements:
  [x] Navigation labels
  [x] Button text
  [x] Form labels & placeholders
  [x] Validation messages
  [x] Empty states
  [x] Error pages (404, 500, 403)
  [x] Toast messages
  [x] Confirmation dialogs
  [x] Tooltips
  [x] Status badges
  [x] Pagination text

✅ Backend Messages:
  [x] Error codes → frontend mapping (50+ error codes)
  [x] Success codes → frontend mapping (10+ success codes)
  [x] Notification templates (16 notification types)

✅ Formatting:
  [x] Price (VNĐ format)
  [x] Dates (locale-specific format)
  [x] Relative time ("2 giờ trước")
  [x] Numbers (thousands separator)
  [x] Duration (video length)
  [x] Pluralization (ICU MessageFormat)

✅ Dynamic Content (KHÔNG dịch):
  [ ] Course titles & descriptions (user-generated)
  [ ] Post content (user-generated)
  [ ] Chat messages (user-generated)
  [ ] Q&A content (user-generated)
  [ ] User names (user-generated)
  → Giữ nguyên ngôn ngữ gốc do instructor/user tạo

✅ SEO:
  [x] <html lang="vi"> / <html lang="en">
  [x] <link rel="alternate" hreflang="vi" />
  [x] <link rel="alternate" hreflang="en" />
  [x] URL prefix: /en/courses (non-default locale)
  [x] Meta title & description translated
```
