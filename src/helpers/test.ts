import { QueryClient } from '@/composables/QueryClient';
import type { QueryClientConfig } from '@/types';

let activeTestClient = new QueryClient();

export function getTestClient() {
  return activeTestClient;
}

export function setTestClient(config: QueryClientConfig) {
  activeTestClient = new QueryClient(config);
  return activeTestClient;
}

export function resetTestClient() {
  activeTestClient = new QueryClient();
}
