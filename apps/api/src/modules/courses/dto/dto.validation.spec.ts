import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCourseDto } from './create-course.dto';
import { CreateSectionDto, UpdateSectionDto } from './create-section.dto';
import { CreateChapterDto, UpdateChapterDto } from './create-chapter.dto';
import { CreateLessonDto, UpdateLessonDto } from './create-lesson.dto';
import { CreateQuizDto, QuizOptionDto, QuizQuestionDto } from './create-quiz.dto';
import { CreateReviewDto } from './create-review.dto';
import { ReorderDto } from './reorder.dto';
import { UpdateTagsDto } from './update-tags.dto';
import { QueryCoursesDto } from './query-courses.dto';
import { QueryReviewsDto } from './query-reviews.dto';

async function validateDto<T extends object>(
  DtoClass: new () => T,
  data: Record<string, unknown>,
): Promise<string[]> {
  const instance = plainToInstance(DtoClass, data);
  const errors = await validate(instance);
  return errors.flatMap((e) => Object.keys(e.constraints || {}));
}

async function expectValid<T extends object>(DtoClass: new () => T, data: Record<string, unknown>) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints).toHaveLength(0);
}

async function expectInvalid<T extends object>(
  DtoClass: new () => T,
  data: Record<string, unknown>,
) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints.length).toBeGreaterThan(0);
}

// ==================== CreateCourseDto ====================
describe('CreateCourseDto', () => {
  const validData = { title: 'NestJS Masterclass' };

  it('should pass with valid title', async () => {
    await expectValid(CreateCourseDto, validData);
  });

  it('should pass with all optional fields', async () => {
    await expectValid(CreateCourseDto, {
      ...validData,
      shortDescription: 'Short desc',
      description: 'A'.repeat(50),
      level: 'INTERMEDIATE',
      language: 'vi',
      price: 499000,
      categoryId: 'clx123',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      tags: ['react', 'javascript'],
    });
  });

  it('should fail with title too short (< 5 chars)', async () => {
    await expectInvalid(CreateCourseDto, { title: 'abc' });
  });

  it('should fail with title too long (> 200 chars)', async () => {
    await expectInvalid(CreateCourseDto, { title: 'A'.repeat(201) });
  });

  it('should fail with description too short (< 50 chars)', async () => {
    await expectInvalid(CreateCourseDto, { ...validData, description: 'Too short' });
  });

  it('should fail with shortDescription too long (> 200 chars)', async () => {
    await expectInvalid(CreateCourseDto, { ...validData, shortDescription: 'A'.repeat(201) });
  });

  it('should fail with invalid level enum', async () => {
    await expectInvalid(CreateCourseDto, { ...validData, level: 'INVALID' });
  });

  it('should fail with negative price', async () => {
    await expectInvalid(CreateCourseDto, { ...validData, price: -100 });
  });

  it('should fail with too many tags (> 10)', async () => {
    const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    await expectInvalid(CreateCourseDto, { ...validData, tags });
  });

  it('should fail with non-string tags', async () => {
    await expectInvalid(CreateCourseDto, { ...validData, tags: [123] });
  });
});

// ==================== CreateSectionDto ====================
describe('CreateSectionDto', () => {
  it('should pass with valid title', async () => {
    await expectValid(CreateSectionDto, { title: 'Getting Started' });
  });

  it('should pass with title and order', async () => {
    await expectValid(CreateSectionDto, { title: 'Getting Started', order: 0 });
  });

  it('should fail with title too short', async () => {
    await expectInvalid(CreateSectionDto, { title: 'A' });
  });

  it('should fail without title', async () => {
    await expectInvalid(CreateSectionDto, {});
  });

  it('should fail with negative order', async () => {
    await expectInvalid(CreateSectionDto, { title: 'Valid', order: -1 });
  });
});

// ==================== UpdateSectionDto ====================
describe('UpdateSectionDto', () => {
  it('should pass with empty object (all optional)', async () => {
    await expectValid(UpdateSectionDto, {});
  });

  it('should pass with valid title', async () => {
    await expectValid(UpdateSectionDto, { title: 'Updated Title' });
  });

  it('should fail with title too short', async () => {
    await expectInvalid(UpdateSectionDto, { title: 'A' });
  });
});

// ==================== CreateChapterDto ====================
describe('CreateChapterDto', () => {
  it('should pass with valid title', async () => {
    await expectValid(CreateChapterDto, { title: 'Introduction' });
  });

  it('should pass with all fields', async () => {
    await expectValid(CreateChapterDto, {
      title: 'Introduction',
      description: 'Chapter description',
      order: 0,
      price: 79000,
      isFreePreview: true,
    });
  });

  it('should fail without title', async () => {
    await expectInvalid(CreateChapterDto, {});
  });

  it('should fail with negative price', async () => {
    await expectInvalid(CreateChapterDto, { title: 'Valid', price: -1 });
  });
});

// ==================== UpdateChapterDto ====================
describe('UpdateChapterDto', () => {
  it('should pass with empty object', async () => {
    await expectValid(UpdateChapterDto, {});
  });

  it('should pass with partial fields', async () => {
    await expectValid(UpdateChapterDto, { price: 99000, isFreePreview: false });
  });
});

// ==================== CreateLessonDto ====================
describe('CreateLessonDto', () => {
  it('should pass with valid title and type', async () => {
    await expectValid(CreateLessonDto, { title: 'What is React?', type: 'VIDEO' });
  });

  it('should pass with all fields', async () => {
    await expectValid(CreateLessonDto, {
      title: 'What is React?',
      type: 'TEXT',
      order: 0,
      textContent: '<p>Hello</p>',
      estimatedDuration: 600,
    });
  });

  it('should fail without title', async () => {
    await expectInvalid(CreateLessonDto, { type: 'VIDEO' });
  });

  it('should fail without type', async () => {
    await expectInvalid(CreateLessonDto, { title: 'Valid Title' });
  });

  it('should fail with invalid type', async () => {
    await expectInvalid(CreateLessonDto, { title: 'Valid', type: 'INVALID' });
  });

  it('should fail with negative duration', async () => {
    await expectInvalid(CreateLessonDto, { title: 'Valid', type: 'VIDEO', estimatedDuration: -1 });
  });
});

// ==================== UpdateLessonDto ====================
describe('UpdateLessonDto', () => {
  it('should pass with empty object', async () => {
    await expectValid(UpdateLessonDto, {});
  });

  it('should pass with partial update', async () => {
    await expectValid(UpdateLessonDto, { title: 'Updated', estimatedDuration: 300 });
  });
});

// ==================== CreateQuizDto ====================
describe('CreateQuizDto', () => {
  const validQuestion = {
    question: 'Which hook manages state?',
    options: [
      { text: 'useState', isCorrect: true },
      { text: 'useEffect', isCorrect: false },
    ],
  };

  it('should pass with valid quiz', async () => {
    await expectValid(CreateQuizDto, {
      questions: [validQuestion],
    });
  });

  it('should pass with all optional fields', async () => {
    await expectValid(CreateQuizDto, {
      passingScore: 70,
      maxAttempts: 3,
      timeLimitSeconds: 600,
      questions: [validQuestion],
    });
  });

  it('should fail with passingScore > 100', async () => {
    await expectInvalid(CreateQuizDto, {
      passingScore: 101,
      questions: [validQuestion],
    });
  });

  it('should fail with passingScore < 0', async () => {
    await expectInvalid(CreateQuizDto, {
      passingScore: -1,
      questions: [validQuestion],
    });
  });

  it('should fail without questions', async () => {
    await expectInvalid(CreateQuizDto, {});
  });
});

// ==================== QuizOptionDto ====================
describe('QuizOptionDto', () => {
  it('should pass with valid option', async () => {
    await expectValid(QuizOptionDto, { text: 'Option A', isCorrect: true });
  });

  it('should fail without text', async () => {
    await expectInvalid(QuizOptionDto, { isCorrect: true });
  });

  it('should fail without isCorrect', async () => {
    await expectInvalid(QuizOptionDto, { text: 'Option A' });
  });
});

// ==================== QuizQuestionDto ====================
describe('QuizQuestionDto', () => {
  it('should pass with valid question', async () => {
    await expectValid(QuizQuestionDto, {
      question: 'What is React?',
      options: [
        { text: 'A library', isCorrect: true },
        { text: 'A framework', isCorrect: false },
      ],
    });
  });

  it('should fail without question text', async () => {
    await expectInvalid(QuizQuestionDto, {
      options: [{ text: 'A', isCorrect: true }],
    });
  });
});

// ==================== CreateReviewDto ====================
describe('CreateReviewDto', () => {
  it('should pass with valid rating', async () => {
    await expectValid(CreateReviewDto, { rating: 5 });
  });

  it('should pass with rating and comment', async () => {
    await expectValid(CreateReviewDto, { rating: 4, comment: 'Great course!' });
  });

  it('should fail with rating < 1', async () => {
    await expectInvalid(CreateReviewDto, { rating: 0 });
  });

  it('should fail with rating > 5', async () => {
    await expectInvalid(CreateReviewDto, { rating: 6 });
  });

  it('should fail without rating', async () => {
    await expectInvalid(CreateReviewDto, {});
  });

  it('should fail with non-integer rating', async () => {
    await expectInvalid(CreateReviewDto, { rating: 4.5 });
  });

  it('should fail with comment too long (> 2000)', async () => {
    await expectInvalid(CreateReviewDto, { rating: 5, comment: 'A'.repeat(2001) });
  });
});

// ==================== ReorderDto ====================
describe('ReorderDto', () => {
  it('should pass with valid IDs', async () => {
    await expectValid(ReorderDto, { orderedIds: ['id1', 'id2', 'id3'] });
  });

  it('should fail with empty array', async () => {
    await expectInvalid(ReorderDto, { orderedIds: [] });
  });

  it('should fail without orderedIds', async () => {
    await expectInvalid(ReorderDto, {});
  });

  it('should fail with non-string IDs', async () => {
    await expectInvalid(ReorderDto, { orderedIds: [123, 456] });
  });
});

// ==================== UpdateTagsDto ====================
describe('UpdateTagsDto', () => {
  it('should pass with valid tag IDs', async () => {
    await expectValid(UpdateTagsDto, { tagIds: ['tag1', 'tag2'] });
  });

  it('should fail without tagIds', async () => {
    await expectInvalid(UpdateTagsDto, {});
  });

  it('should fail with too many tags (> 10)', async () => {
    const tagIds = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    await expectInvalid(UpdateTagsDto, { tagIds });
  });
});

// ==================== QueryCoursesDto ====================
describe('QueryCoursesDto', () => {
  it('should pass with empty query', async () => {
    await expectValid(QueryCoursesDto, {});
  });

  it('should pass with all filters', async () => {
    await expectValid(QueryCoursesDto, {
      search: 'react',
      categorySlug: 'web-development',
      level: 'INTERMEDIATE',
      language: 'vi',
      sort: 'newest',
    });
  });

  it('should fail with invalid level', async () => {
    await expectInvalid(QueryCoursesDto, { level: 'INVALID' });
  });

  it('should fail with invalid sort', async () => {
    await expectInvalid(QueryCoursesDto, { sort: 'invalid_sort' });
  });

  it('should fail with minRating > 5', async () => {
    await expectInvalid(QueryCoursesDto, { minRating: 6 });
  });
});

// ==================== QueryReviewsDto ====================
describe('QueryReviewsDto', () => {
  it('should pass with empty query', async () => {
    await expectValid(QueryReviewsDto, {});
  });

  it('should pass with valid sort', async () => {
    await expectValid(QueryReviewsDto, { sort: 'highest' });
  });

  it('should fail with invalid sort', async () => {
    await expectInvalid(QueryReviewsDto, { sort: 'invalid' });
  });
});
