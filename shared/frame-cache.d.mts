export class FrameCache {
  constructor(options: { count: number; load: (index: number, signal: AbortSignal) => Promise<ImageBitmap>; capacity?: number; concurrency?: number; onChange?: (index: number) => void; onError?: (index: number, error: unknown) => void });
  images: Map<number, ImageBitmap>;
  pending: Map<number, AbortController>;
  window(center: number): void;
  get(index: number): ImageBitmap | undefined;
  pause(paused: boolean): void;
  close(): void;
}
