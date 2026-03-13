import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { ForgotPasswordDto } from './forgot-password.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { VerifyEmailDto } from './verify-email.dto';
import { ValidateOttDto } from './validate-ott.dto';

// Helper: create DTO instance and validate
async function validateDto<T extends object>(
  DtoClass: new () => T,
  data: Record<string, unknown>,
): Promise<string[]> {
  const instance = plainToInstance(DtoClass, data);
  const errors = await validate(instance);
  return errors.flatMap((e) => Object.keys(e.constraints || {}));
}

// Helper: expect no validation errors
async function expectValid<T extends object>(DtoClass: new () => T, data: Record<string, unknown>) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints).toHaveLength(0);
}

// Helper: expect validation errors
async function expectInvalid<T extends object>(
  DtoClass: new () => T,
  data: Record<string, unknown>,
) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints.length).toBeGreaterThan(0);
}

// ==================== RegisterDto ====================
describe('RegisterDto', () => {
  const validData = {
    email: 'test@example.com',
    password: 'Password123',
    fullName: 'Test User',
  };

  it('should pass with valid data', async () => {
    await expectValid(RegisterDto, validData);
  });

  it('should fail with invalid email', async () => {
    await expectInvalid(RegisterDto, { ...validData, email: 'not-email' });
  });

  it('should fail with empty email', async () => {
    await expectInvalid(RegisterDto, { ...validData, email: '' });
  });

  it('should fail with short password (< 8 chars)', async () => {
    await expectInvalid(RegisterDto, { ...validData, password: 'Pass1' });
  });

  it('should fail with password missing uppercase', async () => {
    await expectInvalid(RegisterDto, { ...validData, password: 'password123' });
  });

  it('should fail with password missing number', async () => {
    await expectInvalid(RegisterDto, { ...validData, password: 'Password' });
  });

  it('should fail with short fullName (< 2 chars)', async () => {
    await expectInvalid(RegisterDto, { ...validData, fullName: 'A' });
  });

  it('should fail with long fullName (> 100 chars)', async () => {
    await expectInvalid(RegisterDto, { ...validData, fullName: 'A'.repeat(101) });
  });

  it('should pass with Vietnamese full name', async () => {
    await expectValid(RegisterDto, { ...validData, fullName: 'Nguyễn Văn An' });
  });

  it('should fail with missing fields', async () => {
    await expectInvalid(RegisterDto, {});
  });
});

// ==================== LoginDto ====================
describe('LoginDto', () => {
  const validData = { email: 'test@example.com', password: 'Password123' };

  it('should pass with valid data', async () => {
    await expectValid(LoginDto, validData);
  });

  it('should fail with invalid email', async () => {
    await expectInvalid(LoginDto, { ...validData, email: 'bad' });
  });

  it('should pass with empty password (no @IsNotEmpty on password)', async () => {
    await expectValid(LoginDto, { ...validData, password: '' });
  });

  it('should fail with missing email', async () => {
    await expectInvalid(LoginDto, { password: 'x' });
  });
});

// ==================== ForgotPasswordDto ====================
describe('ForgotPasswordDto', () => {
  it('should pass with valid email', async () => {
    await expectValid(ForgotPasswordDto, { email: 'user@test.com' });
  });

  it('should fail with invalid email', async () => {
    await expectInvalid(ForgotPasswordDto, { email: 'not-email' });
  });

  it('should fail with missing email', async () => {
    await expectInvalid(ForgotPasswordDto, {});
  });
});

// ==================== ResetPasswordDto ====================
describe('ResetPasswordDto', () => {
  const validData = {
    token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    newPassword: 'NewPassword123',
  };

  it('should pass with valid data', async () => {
    await expectValid(ResetPasswordDto, validData);
  });

  it('should fail with short newPassword', async () => {
    await expectInvalid(ResetPasswordDto, { ...validData, newPassword: 'Ab1' });
  });

  it('should fail with newPassword missing uppercase', async () => {
    await expectInvalid(ResetPasswordDto, { ...validData, newPassword: 'password123' });
  });

  it('should fail with newPassword missing number', async () => {
    await expectInvalid(ResetPasswordDto, { ...validData, newPassword: 'Passwordx' });
  });

  it('should fail with missing token', async () => {
    await expectInvalid(ResetPasswordDto, { newPassword: 'NewPass123' });
  });
});

// ==================== VerifyEmailDto ====================
describe('VerifyEmailDto', () => {
  it('should pass with valid token', async () => {
    await expectValid(VerifyEmailDto, { token: 'some-uuid-token' });
  });

  it('should pass with empty token (no @IsNotEmpty on token)', async () => {
    await expectValid(VerifyEmailDto, { token: '' });
  });

  it('should fail with missing token', async () => {
    await expectInvalid(VerifyEmailDto, {});
  });
});

// ==================== ValidateOttDto ====================
describe('ValidateOttDto', () => {
  it('should pass with valid ott', async () => {
    await expectValid(ValidateOttDto, { ott: 'some-uuid-ott' });
  });

  it('should pass with empty ott (no @IsNotEmpty on ott)', async () => {
    await expectValid(ValidateOttDto, { ott: '' });
  });

  it('should fail with missing ott', async () => {
    await expectInvalid(ValidateOttDto, {});
  });
});
