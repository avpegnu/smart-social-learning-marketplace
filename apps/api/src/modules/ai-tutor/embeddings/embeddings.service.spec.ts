import { EmbeddingsService } from './embeddings.service';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;

  beforeEach(() => {
    service = new EmbeddingsService(null as never, null as never);
  });

  describe('chunkText (private → test via reflection)', () => {
    // Access private method for unit testing
    const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
      return (service as unknown as { chunkText: typeof chunkText }).chunkText(
        text,
        chunkSize,
        overlap,
      );
    };

    it('should split text into chunks with overlap', () => {
      const text = 'A'.repeat(100);
      const chunks = chunkText(text, 40, 10);

      // 100 chars, chunk=40, step=30 → [0-40], [30-70], [60-100]
      expect(chunks.length).toBe(4);
      expect(chunks[0]).toHaveLength(40);
    });

    it('should handle text shorter than chunk size', () => {
      const chunks = chunkText('Hello world', 500, 50);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Hello world');
    });

    it('should handle empty text', () => {
      const chunks = chunkText('', 500, 50);
      expect(chunks).toHaveLength(0);
    });

    it('should trim chunks', () => {
      const chunks = chunkText('  hello  ', 500, 50);
      expect(chunks[0]).toBe('hello');
    });

    it('should skip empty chunks after trim', () => {
      const chunks = chunkText('   ', 500, 50);
      expect(chunks).toHaveLength(0);
    });
  });

  describe('isReady', () => {
    it('should return false before model loading', () => {
      expect(service.isReady()).toBe(false);
    });
  });

  describe('generateEmbedding', () => {
    it('should throw if model not loaded', async () => {
      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'Embeddings model not loaded',
      );
    });
  });
});
