import { config } from './config.ts';

type ErrorContextState = {
  errorThrown: boolean;
  error: unknown;
};

let context: ErrorContextState | null = null;

export const errorContext = (callback: () => void): void => {
  if (config.useDeprecatedSynchronousErrorHandling) {
    const isRoot = context === null;
    if (isRoot) {
      context = { errorThrown: false, error: null };
    }

    callback();

    if (isRoot) {
      const current = context;
      context = null;
      if (current?.errorThrown) {
        throw current.error;
      }
    }
  } else {
    callback();
  }
};

export const captureError = (error: unknown): void => {
  if (config.useDeprecatedSynchronousErrorHandling && context) {
    context.errorThrown = true;
    context.error = error;
  }
};
