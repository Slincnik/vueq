import { vi, beforeEach } from 'vitest';

import { getTestClient, resetTestClient } from './src/helpers/test';

vi.mock('./src/composables/QueryClient', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./src/composables/QueryClient')>();

  return {
    ...actual,
    useQueryClient: () => getTestClient(),
  };
});

beforeEach(() => {
  resetTestClient();
});
