import type { z } from 'zod';

export const formatZodIssues = (error: z.ZodError): string[] =>
  error.issues.map(
    (issue) =>
      `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`,
  );
