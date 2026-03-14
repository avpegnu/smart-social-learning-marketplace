import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProfileDto } from './update-profile.dto';
import { UpdateNotificationPreferencesDto } from './update-notification-preferences.dto';

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

// ==================== UpdateProfileDto ====================
describe('UpdateProfileDto', () => {
  it('should pass with all valid fields', async () => {
    await expectValid(UpdateProfileDto, {
      fullName: 'Nguyễn Văn A',
      bio: 'Hello world',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
  });

  it('should pass with empty object (all optional)', async () => {
    await expectValid(UpdateProfileDto, {});
  });

  it('should pass with only fullName', async () => {
    await expectValid(UpdateProfileDto, { fullName: 'Test' });
  });

  it('should fail with fullName too short (< 2 chars)', async () => {
    await expectInvalid(UpdateProfileDto, { fullName: 'A' });
  });

  it('should fail with fullName too long (> 100 chars)', async () => {
    await expectInvalid(UpdateProfileDto, { fullName: 'A'.repeat(101) });
  });

  it('should fail with bio too long (> 500 chars)', async () => {
    await expectInvalid(UpdateProfileDto, { bio: 'A'.repeat(501) });
  });

  it('should fail with non-string fullName', async () => {
    await expectInvalid(UpdateProfileDto, { fullName: 123 });
  });

  it('should pass with Vietnamese characters in fullName', async () => {
    await expectValid(UpdateProfileDto, { fullName: 'Trần Đức Thắng' });
  });
});

// ==================== UpdateNotificationPreferencesDto ====================
describe('UpdateNotificationPreferencesDto', () => {
  it('should pass with valid preferences object', async () => {
    await expectValid(UpdateNotificationPreferencesDto, {
      preferences: {
        POST_LIKED: { inApp: true, email: false },
        NEW_FOLLOWER: { inApp: true, email: true },
      },
    });
  });

  it('should fail without preferences', async () => {
    await expectInvalid(UpdateNotificationPreferencesDto, {});
  });

  it('should fail with non-object preferences', async () => {
    await expectInvalid(UpdateNotificationPreferencesDto, { preferences: 'invalid' });
  });
});
