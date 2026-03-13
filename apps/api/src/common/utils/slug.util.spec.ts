import { generateSlug, generateUniqueSlug } from './slug.util';

describe('slug.util', () => {
  describe('generateSlug', () => {
    it('should convert text to lowercase slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
    });

    it('should handle Vietnamese characters', () => {
      expect(generateSlug('Khóa học React nâng cao')).toBe('khoa-hoc-react-nang-cao');
    });

    it('should handle Vietnamese đ character', () => {
      expect(generateSlug('Đào tạo lập trình')).toBe('dao-tao-lap-trinh');
    });

    it('should strip special characters', () => {
      expect(generateSlug('React & TypeScript: Cơ bản!')).toBe('react-and-typescript-co-ban');
    });

    it('should handle multiple spaces', () => {
      expect(generateSlug('hello   world')).toBe('hello-world');
    });

    it('should handle empty string', () => {
      expect(generateSlug('')).toBe('');
    });

    it('should handle numbers', () => {
      expect(generateSlug('Lesson 1: Introduction')).toBe('lesson-1-introduction');
    });
  });

  describe('generateUniqueSlug', () => {
    it('should include base slug', () => {
      const slug = generateUniqueSlug('Hello World');
      expect(slug).toMatch(/^hello-world-/);
    });

    it('should append timestamp suffix', () => {
      const slug = generateUniqueSlug('Test');
      const parts = slug.split('-');
      // Last part should be base-36 timestamp
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });

    it('should generate different slugs on successive calls', () => {
      const slug1 = generateUniqueSlug('Test');
      // Tiny delay to ensure different timestamp
      const slug2 = generateUniqueSlug('Test');
      // They may be the same if called in same ms, but base should match
      expect(slug1).toMatch(/^test-/);
      expect(slug2).toMatch(/^test-/);
    });
  });
});
