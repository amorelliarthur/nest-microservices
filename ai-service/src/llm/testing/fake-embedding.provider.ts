import type {
  EmbeddingProvider,
  EmbeddingPurpose,
} from '../domain/embedding-provider.port';

export type FakeEmbeddingReply = number[][] | Error;

export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly calls: { texts: string[]; purpose: EmbeddingPurpose }[] = [];

  constructor(
    private readonly replies: FakeEmbeddingReply[] = [],
    readonly model = 'fake-embedding',
    readonly dimensions = 3,
  ) {}

  embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]> {
    this.calls.push({ texts, purpose });
    const reply = this.replies.shift() ?? texts.map(() => [0, 0, 0]);
    return reply instanceof Error
      ? Promise.reject(reply)
      : Promise.resolve(reply);
  }
}
