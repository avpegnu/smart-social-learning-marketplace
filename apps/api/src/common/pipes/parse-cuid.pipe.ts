import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

// CUID v1: exactly 25 chars (c + 24 alphanumeric)
// CUID v2: variable length (typically 24-32 chars)
// Support both formats for forward compatibility
const CUID_REGEX = /^c[a-z0-9]{20,32}$/;

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!CUID_REGEX.test(value)) {
      throw new BadRequestException({
        code: 'INVALID_CUID',
        message: 'Invalid ID format',
      });
    }
    return value;
  }
}
