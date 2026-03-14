import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateApplicationDto } from './create-application.dto';
import { UpdateInstructorProfileDto } from './update-instructor-profile.dto';

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

// ==================== CreateApplicationDto ====================
describe('CreateApplicationDto', () => {
  const validData = {
    expertise: ['React', 'Node.js'],
    experience: 'A'.repeat(50),
    motivation: 'Want to teach programming',
  };

  it('should pass with valid data', async () => {
    await expectValid(CreateApplicationDto, validData);
  });

  it('should pass with only expertise (other fields optional)', async () => {
    await expectValid(CreateApplicationDto, { expertise: ['JavaScript'] });
  });

  it('should fail without expertise', async () => {
    await expectInvalid(CreateApplicationDto, { experience: 'A'.repeat(50) });
  });

  it('should fail with empty expertise array', async () => {
    await expectInvalid(CreateApplicationDto, { expertise: [] });
  });

  it('should fail with non-string items in expertise', async () => {
    await expectInvalid(CreateApplicationDto, { expertise: [123, 456] });
  });

  it('should fail with experience too short (< 50 chars)', async () => {
    await expectInvalid(CreateApplicationDto, { expertise: ['React'], experience: 'short' });
  });

  it('should pass with experience exactly 50 chars', async () => {
    await expectValid(CreateApplicationDto, { expertise: ['React'], experience: 'A'.repeat(50) });
  });

  it('should pass with certificateUrls as string array', async () => {
    await expectValid(CreateApplicationDto, {
      expertise: ['React'],
      certificateUrls: ['https://example.com/cert1.pdf'],
    });
  });

  it('should fail with non-string items in certificateUrls', async () => {
    await expectInvalid(CreateApplicationDto, {
      expertise: ['React'],
      certificateUrls: [123],
    });
  });
});

// ==================== UpdateInstructorProfileDto ====================
describe('UpdateInstructorProfileDto', () => {
  it('should pass with all valid fields', async () => {
    await expectValid(UpdateInstructorProfileDto, {
      headline: 'Senior React Developer',
      biography: 'Experienced developer',
      expertise: ['React', 'TypeScript'],
      experience: '5 years',
      socialLinks: { github: 'https://github.com/test' },
    });
  });

  it('should pass with empty object (all optional)', async () => {
    await expectValid(UpdateInstructorProfileDto, {});
  });

  it('should pass with only headline', async () => {
    await expectValid(UpdateInstructorProfileDto, { headline: 'Dev' });
  });

  it('should fail with non-string headline', async () => {
    await expectInvalid(UpdateInstructorProfileDto, { headline: 123 });
  });

  it('should fail with non-string items in expertise', async () => {
    await expectInvalid(UpdateInstructorProfileDto, { expertise: [123] });
  });

  it('should pass with valid qualifications array', async () => {
    await expectValid(UpdateInstructorProfileDto, {
      qualifications: [{ name: 'AWS', institution: 'Amazon', year: '2023' }],
    });
  });

  it('should pass with qualifications without optional year', async () => {
    await expectValid(UpdateInstructorProfileDto, {
      qualifications: [{ name: 'AWS', institution: 'Amazon' }],
    });
  });
});
