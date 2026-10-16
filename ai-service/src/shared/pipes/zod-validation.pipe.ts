import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { formatZodIssues } from '../zod/format-zod-issues';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new BadRequestException(formatZodIssues(result.error));
  }
}
