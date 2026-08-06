import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

/**
 * React Query is configured here for the live Backend integration (see
 * `src/api/client.ts`). Retries are disabled because the Backend already
 * retries upstream calls internally — a second retry layer here would only
 * multiply the wait a user sees.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
