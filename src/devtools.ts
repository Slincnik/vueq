import { setupDevToolsPlugin } from '@vue/devtools-api';
import type { Plugin } from 'vue';
import { useQueryClient } from '@/composables/QueryClient';

const INSPECTOR_ID = 'vueq-inspector';
const INSPECTOR_LABEL = 'VueQ Inspector';

export const VueQDevtools: Plugin = {
  install(app) {
    if (process.env.NODE_ENV === 'production') return;
    const queryClient = useQueryClient();

    setupDevToolsPlugin(
      {
        id: 'vueq-devtools-plugin',
        label: 'VueQ Plugin',
        packageName: '@slincnik/vueq',
        homepage: 'https://github.com/slincnik/vueq',
        app,
      },
      (api) => {
        api.addInspector({
          id: INSPECTOR_ID,
          label: INSPECTOR_LABEL,
          icon: 'storage',
          treeFilterPlaceholder: 'Filter queries...',
        });

        api.on.getInspectorTree((payload) => {
          if (payload.inspectorId === INSPECTOR_ID) {
            const queries = Object.keys(queryClient.entries);
            const filter = payload.filter?.toLowerCase();

            payload.rootNodes = queries
              .filter((key) => !filter || key.toLowerCase().includes(filter))
              .map((key) => {
                const entry = queryClient.getEntry(key);
                if (!entry) return { id: key, label: key };

                return {
                  id: key,
                  label: key,
                  tags: [
                    {
                      label: entry.status,
                      textColor: 0xffffff,
                      backgroundColor:
                        entry.status === 'success'
                          ? 0x42b883
                          : entry.status === 'error'
                            ? 0xea5e5e
                            : 0xeaae5e,
                    },
                    {
                      label: `sub: ${entry.subscribers}`,
                      textColor: 0x000000,
                      backgroundColor: 0xeeeeee,
                    },
                    ...(entry.fetchStatus === 'fetching'
                      ? [
                          {
                            label: 'fetching',
                            textColor: 0xffffff,
                            backgroundColor: 0x3ba776,
                          },
                        ]
                      : []),
                  ],
                };
              });
          }
        });

        api.on.getInspectorState((payload) => {
          if (payload.inspectorId === INSPECTOR_ID) {
            const entry = queryClient.getEntry(payload.nodeId);

            if (!entry) {
              payload.state = {
                Warning: [{ key: 'message', value: 'Query not found' }],
              };
              return;
            }

            payload.state = {
              State: [
                { key: 'Status', value: entry.status },
                { key: 'Fetch Status', value: entry.fetchStatus },
                { key: 'Subscribers', value: entry.subscribers },
                {
                  key: 'Updated At',
                  value: new Date(entry.updatedAt).toLocaleTimeString(),
                },
                { key: 'Cache Time', value: `${entry.cacheTime}ms` },
              ],
              Data: [{ key: 'data', value: entry.data }],
              Errors: [{ key: 'error', value: entry.error }],
            };
          }
        });

        queryClient.subscribe(() => {
          api.sendInspectorTree(INSPECTOR_ID);
          api.sendInspectorState(INSPECTOR_ID);
        });
      }
    );
  },
};
