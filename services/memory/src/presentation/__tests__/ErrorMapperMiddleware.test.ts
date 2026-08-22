import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorMiddleware } from '../middleware/ErrorMapper.js';

vi.mock('@vedmoulya/core', () => ({
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

describe('errorMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next and does nothing when no error is thrown', async () => {
    const mockJson = vi.fn().mockReturnValue('response');
    const mockContext = { json: mockJson } as never;
    const next = vi.fn().mockResolvedValue(undefined);

    await errorMiddleware(mockContext, next);
    expect(next).toHaveBeenCalled();
    expect(mockJson).not.toHaveBeenCalled();
  });

  it('catches AppError thrown by next and maps it', async () => {
    const { AppError } = await import('@vedmoulya/core');
    const mockJson = vi.fn().mockReturnValue('response');
    const mockContext = { json: mockJson } as never;
    const next = vi.fn().mockRejectedValue(new AppError('TEST_ERROR', 'test message', 422));

    await errorMiddleware(mockContext, next);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TEST_ERROR' }),
      }),
      422,
    );
  });

  it('catches standard Error thrown by next and maps it to 500', async () => {
    const mockJson = vi.fn().mockReturnValue('response');
    const mockContext = { json: mockJson } as never;
    const next = vi.fn().mockRejectedValue(new Error('something broke'));

    await errorMiddleware(mockContext, next);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
      500,
    );
  });

  it('catches non-Error thrown by next and maps it to unknown error', async () => {
    const mockJson = vi.fn().mockReturnValue('response');
    const mockContext = { json: mockJson } as never;
    const next = vi.fn().mockRejectedValue('string error');

    await errorMiddleware(mockContext, next);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNKNOWN_ERROR' }),
      }),
      500,
    );
  });
});
