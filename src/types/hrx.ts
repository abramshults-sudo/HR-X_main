export type ThemeMode = "light" | "dark";

export type QuizStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface RegionItem {
  id: string;
  name: string;
  timezoneOffset: number;
}

export type RemoteExperience = "" | "none" | "some";

export interface QuizState {
  currentStep: QuizStep;
  remoteExperience: RemoteExperience;
  region: RegionItem | null;
  moscowHours: {
    from: string;
    to: string;
  };
  targetRoles: string[];
  excludedRoles: string;
  excludedRoleQuick: string[];
  considerAdjacentRoles: string;
  organizationTypes: string[];
  totalExperience: string;
  activities: string[];
  documentTypes: string[];
  programLevels: Record<string, "none" | "basic" | "confident" | "advanced">;
  professionalSkills: string[];
  schedules: string[];
  employmentTypes: string[];
  salaryMin: string;
  restrictions: string[];
  acceptHandicapped: boolean;
}

export interface ProfileState {
  profileReady: boolean;
  isPaidUnlocked: boolean;
}

export interface ResumeState {
  resumeMode: "regular" | "ats";
}

export type JobMatchStatus = "fit" | "review" | "not_recommended";

export interface CompanyScore {
  total: number;
  level: "trusted" | "normal" | "suspicious" | "risky";
  flags: string[];
  positives: string[];
}

export interface JobItem {
  id: string;
  title: string;
  company: string;
  salary: string;
  status: JobMatchStatus;
  description: string;
  reason: string;
  redFlags: string[];
  source: string;
  url?: string;
  schedule?: string;
  location?: string;
  companyScore?: CompanyScore;
  publishedAt?: string;
  requirements?: string;
}

export type JobSortMode = "swipe" | "list";
export type SwipeDecision = "saved" | "archived";

export interface JobsState {
  jobs: JobItem[];
  decisions: Record<string, SwipeDecision>;
  decisionHistory: string[];
  sortMode: JobSortMode;
  hideNotRecommended: boolean;
  showScoring: boolean;
  dateFilter: "all" | "3" | "7" | "30";
  isLoading: boolean;
  error: string | null;
  searchCompleted: boolean;
}

export interface UIState {
  theme: ThemeMode;
  isRegionPickerOpen: boolean;
  isAssistantOpen: boolean;
}

export interface HrxState {
  quizState: QuizState;
  profileState: ProfileState;
  resumeState: ResumeState;
  jobsState: JobsState;
  uiState: UIState;
}
