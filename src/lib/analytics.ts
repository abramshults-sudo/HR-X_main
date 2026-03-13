declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: any[]) => void;
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export type AnalyticsEvent =
  | "quiz_complete"
  | "payment_success"
  | "resume_generate"
  | "resume_adapt"
  | "registration"
  | "promo_applied"
  | "access_granted_view"
  | "quiz_step"
  | "job_search"
  | "resume_download";

const GA_EVENTS: Record<AnalyticsEvent, string> = {
  quiz_complete: "quiz_complete",
  payment_success: "purchase",
  resume_generate: "resume_generate",
  resume_adapt: "resume_adapt",
  registration: "sign_up",
  promo_applied: "promo_applied",
  access_granted_view: "access_granted",
  quiz_step: "quiz_step",
  job_search: "job_search",
  resume_download: "resume_download",
};

const YM_GOALS: Record<AnalyticsEvent, string> = {
  quiz_complete: "quiz-complete",
  payment_success: "payment-success",
  resume_generate: "resume-generate",
  resume_adapt: "resume-adapt",
  registration: "registration",
  promo_applied: "promo-applied",
  access_granted_view: "access-granted",
  quiz_step: "quiz-step",
  job_search: "job-search",
  resume_download: "resume-download",
};

export function trackEvent(event: AnalyticsEvent, params?: Record<string, any>) {
  try {
    if (window.ym && window.__ymId) {
      window.ym(window.__ymId, "reachGoal", YM_GOALS[event], params);
    }
  } catch {}

  try {
    if (window.gtag) {
      window.gtag("event", GA_EVENTS[event], params);
    }
  } catch {}
}

export function trackPageView(path: string) {
  try {
    if (window.ym && window.__ymId) {
      window.ym(window.__ymId, "hit", path);
    }
  } catch {}

  try {
    if (window.gtag && window.__gaId) {
      window.gtag("event", "page_view", { page_path: path });
    }
  } catch {}
}

declare global {
  interface Window {
    __ymId?: number;
    __gaId?: string;
  }
}
