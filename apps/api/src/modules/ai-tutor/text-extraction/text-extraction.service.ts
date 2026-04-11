import { Injectable, Logger } from '@nestjs/common';

const SUPPORTED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'text/plain',
  'text/markdown',
]);

@Injectable()
export class TextExtractionService {
  private readonly logger = new Logger(TextExtractionService.name);

  canExtract(mimeType: string): boolean {
    return SUPPORTED_MIME_TYPES.has(mimeType);
  }

  /**
   * Download file from URL and extract plain text.
   * File is loaded into memory (Buffer) only during extraction — never saved to disk.
   * Returns empty string on unsupported type or error (graceful degradation).
   */
  async extract(url: string, mimeType: string): Promise<string> {
    if (!this.canExtract(mimeType)) return '';

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching file`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
      ) {
        return await this.extractDocx(buffer);
      }
      if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        return buffer.toString('utf-8').trim();
      }
      return '';
    } catch (error) {
      this.logger.warn(`Text extraction failed for ${url}: ${String(error)}`);
      return ''; // lesson still works for viewing — just won't appear in RAG
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
}
