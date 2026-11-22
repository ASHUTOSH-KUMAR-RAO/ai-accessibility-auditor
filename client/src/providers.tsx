import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ErrorBoundary } from "@/components/error-boundary"
import { ScanRealtime } from "@/components/scans/scan-realtime"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/context/auth-context"
import { ApiError } from "@/lib/api"
import { ThemeProvider } from "@/lib/theme"

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Don't retry client errors (4xx); retry transient failures twice.
        retry: (count, err) => !(err instanceof ApiError && err.status && err.status < 500) && count < 2,
      },
    },
  })

/** The provider stack. Browser entry and build-time prerender use this exact component, so their trees (and useId values) match. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient) // per instance: never shared between server renders
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={200}>
          <ErrorBoundary>
            <AuthProvider>
              <ScanRealtime />
              {children}
            </AuthProvider>
          </ErrorBoundary>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
