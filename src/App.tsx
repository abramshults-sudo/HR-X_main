import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HrxStateProvider } from "@/context/hrx-state";
import { AuthProvider } from "@/context/auth-context";
import { useTracking } from "@/hooks/use-tracking";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Quiz from "./pages/Quiz";
import Profile from "./pages/Profile";
import Results from "./pages/Results";
import AdaptResult from "./pages/AdaptResult";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Readiness from "./pages/Readiness";
import Guides from "./pages/Guides";

const queryClient = new QueryClient();

function TrackingWrapper({ children }: { children: React.ReactNode }) {
  useTracking();
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <HrxStateProvider>
            <TrackingWrapper>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/results" element={<Results />} />
                <Route path="/results/adapt/:id" element={<AdaptResult />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/readiness" element={<Readiness />} />
                <Route path="/guides" element={<Guides />} />
                <Route path="/guides/:guideId" element={<Guides />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TrackingWrapper>
          </HrxStateProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
