import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "./App.tsx"
import { ErrorBoundary } from "@/components/error-boundary"
import { AuthProvider } from "@/context/auth-context"
import { ScanRealtime } from "@/components/scans/scan-realtime"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api"
import { ThemeProvider } from "@/lib/theme"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry client errors (4xx); retry transient failures twice.
      retry: (count, err) => !(err instanceof ApiError && err.status && err.status < 500) && count < 2,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={200}>
          <ErrorBoundary>
            <AuthProvider>
              <ScanRealtime />
              <App />
            </AuthProvider>
          </ErrorBoundary>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
