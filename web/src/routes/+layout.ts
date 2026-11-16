import { browser } from "$app/environment";
import { QueryClient } from "@tanstack/svelte-query";
import type { LayoutLoad } from "./$types";

let browserClient: QueryClient;

function getQueryClient() {
  if (browser) {
    if (!browserClient) {
      browserClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
          },
        },
      });
    }
    return browserClient;
  }

  return new QueryClient({
    defaultOptions: {
      queries: {
        enabled: false,
        staleTime: 60_000,
      },
    },
  });
}

export const load: LayoutLoad = async ({ data }) => {
  const queryClient = getQueryClient();
  return { ...data, queryClient };
};
