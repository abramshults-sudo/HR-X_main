import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { HrxState, JobItem, JobMatchStatus, JobSortMode, QuizState, QuizStep, RemoteExperience, SwipeDecision, ThemeMode } from "@/types/hrx";
import {
  experiencedRoleGroups,
  experiencedActivityGroups,
  experiencedSoftwareGroups,
  experiencedSkillGroups,
} from "@/data/quizData";

type Action =
  | { type: "SET_THEME"; payload: ThemeMode }
  | { type: "SET_REMOTE_EXPERIENCE"; payload: RemoteExperience }
  | { type: "SET_STEP"; payload: QuizStep }
  | { type: "SET_REGION"; payload: HrxState["quizState"]["region"] }
  | { type: "SET_MOSCOW_HOURS"; payload: { from: string; to: string } }
  | { type: "TOGGLE_TARGET_ROLE"; payload: string }
  | { type: "SET_EXCLUDED_ROLE"; payload: string }
  | { type: "TOGGLE_EXCLUDED_ROLE_QUICK"; payload: string }
  | { type: "SET_CONSIDER_ADJACENT"; payload: string }
  | { type: "TOGGLE_ORGANIZATION_TYPE"; payload: string }
  | { type: "SET_TOTAL_EXPERIENCE"; payload: string }
  | { type: "TOGGLE_ACTIVITY"; payload: string }
  | { type: "TOGGLE_DOCUMENT"; payload: string }
  | { type: "SET_PROGRAM_LEVEL"; payload: { program: string; level: HrxState["quizState"]["programLevels"][string] } }
  | { type: "TOGGLE_PRO_SKILL"; payload: string }
  | { type: "TOGGLE_SCHEDULE"; payload: string }
  | { type: "TOGGLE_EMPLOYMENT_TYPE"; payload: string }
  | { type: "SET_SALARY_MIN"; payload: string }
  | { type: "TOGGLE_RESTRICTION"; payload: string }
  | { type: "SET_ACCEPT_HANDICAPPED"; payload: boolean }
  | { type: "SET_REGION_PICKER_OPEN"; payload: boolean }
  | { type: "SET_ASSISTANT_OPEN"; payload: boolean }
  | { type: "SET_PROFILE_READY"; payload: boolean }
  | { type: "SET_RESUME_MODE"; payload: "regular" | "ats" }
  | { type: "TOGGLE_HIDE_NOT_RECOMMENDED" }
  | { type: "TOGGLE_SHOW_SCORING" }
  | { type: "SET_DATE_FILTER"; payload: "all" | "3" | "7" | "30" }
  | { type: "FILTER_JOBS_BY_STATUS"; payload: JobMatchStatus[] }
  | { type: "SET_JOBS_LOADING"; payload: boolean }
  | { type: "SET_JOBS_ERROR"; payload: string | null }
  | { type: "SET_JOBS"; payload: JobItem[] }
  | { type: "DECIDE_JOB"; payload: { id: string; decision: SwipeDecision } }
  | { type: "DISMISS_JOB"; payload: string }
  | { type: "UNDO_LAST_SWIPE" }
  | { type: "SET_SORT_MODE"; payload: JobSortMode }
  | { type: "LOAD_QUIZ_STATE"; payload: QuizState; targetStep?: QuizState["currentStep"] };

const initialState: HrxState = {
  quizState: {
    currentStep: 1,
    remoteExperience: "",
    region: null,
    moscowHours: { from: "09:00", to: "18:00" },
    targetRoles: [],
    excludedRoles: "",
    excludedRoleQuick: [],
    considerAdjacentRoles: "Да, если задачи похожи",
    organizationTypes: [],
    totalExperience: "",
    activities: [],
    documentTypes: [],
    programLevels: {
      "Microsoft Excel": "basic",
      "Google Docs / Sheets / Slides": "basic",
    },
    professionalSkills: [],
    schedules: [],
    employmentTypes: [],
    salaryMin: "",
    restrictions: [],
    acceptHandicapped: false,
  },
  profileState: {
    profileReady: false,
    isPaidUnlocked: false,
  },
  resumeState: {
    resumeMode: "regular",
  },
  jobsState: {
    jobs: [],
    decisions: {},
    decisionHistory: [],
    dismissedJobIds: [],
    sortMode: "list",
    hideNotRecommended: false,
    showScoring: true,
    dateFilter: "all",
    isLoading: false,
    error: null,
    searchCompleted: false,
  },
  uiState: {
    theme: "light",
    isRegionPickerOpen: false,
    isAssistantOpen: false,
  },
};

const toggleInArray = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const reducer = (state: HrxState, action: Action): HrxState => {
  switch (action.type) {
    case "SET_THEME":
      return { ...state, uiState: { ...state.uiState, theme: action.payload } };
    case "SET_REMOTE_EXPERIENCE": {
      const newQuiz = { ...state.quizState, remoteExperience: action.payload };
      if (action.payload !== "some") {
        const expRoleTitles = new Set(experiencedRoleGroups.flatMap(g => g.roles.map(r => r.title)));
        const expActivities = new Set(experiencedActivityGroups.flatMap(g => g.items));
        const expSoftware = new Set(experiencedSoftwareGroups.flatMap(g => g.items));
        const expSkills = new Set(experiencedSkillGroups.flatMap(g => g.items));
        newQuiz.targetRoles = newQuiz.targetRoles.filter(r => !expRoleTitles.has(r));
        newQuiz.activities = newQuiz.activities.filter(a => !expActivities.has(a));
        newQuiz.professionalSkills = newQuiz.professionalSkills.filter(s => !expSkills.has(s));
        const cleanedLevels = { ...newQuiz.programLevels };
        for (const prog of expSoftware) delete cleanedLevels[prog];
        newQuiz.programLevels = cleanedLevels;
      }
      return { ...state, quizState: newQuiz };
    }
    case "SET_STEP":
      return { ...state, quizState: { ...state.quizState, currentStep: action.payload } };
    case "SET_REGION":
      return {
        ...state,
        quizState: { ...state.quizState, region: action.payload },
        jobsState: { ...state.jobsState, searchCompleted: false },
      };
    case "SET_MOSCOW_HOURS":
      return { ...state, quizState: { ...state.quizState, moscowHours: action.payload } };
    case "TOGGLE_TARGET_ROLE":
      return {
        ...state,
        quizState: { ...state.quizState, targetRoles: toggleInArray(state.quizState.targetRoles, action.payload) },
        jobsState: { ...state.jobsState, searchCompleted: false },
      };
    case "SET_EXCLUDED_ROLE":
      return { ...state, quizState: { ...state.quizState, excludedRoles: action.payload } };
    case "TOGGLE_EXCLUDED_ROLE_QUICK":
      return {
        ...state,
        quizState: { ...state.quizState, excludedRoleQuick: toggleInArray(state.quizState.excludedRoleQuick, action.payload) },
        jobsState: { ...state.jobsState, searchCompleted: false },
      };
    case "SET_CONSIDER_ADJACENT":
      return { ...state, quizState: { ...state.quizState, considerAdjacentRoles: action.payload } };
    case "TOGGLE_ORGANIZATION_TYPE":
      return {
        ...state,
        quizState: { ...state.quizState, organizationTypes: toggleInArray(state.quizState.organizationTypes, action.payload) },
      };
    case "SET_TOTAL_EXPERIENCE":
      return {
        ...state,
        quizState: { ...state.quizState, totalExperience: action.payload },
        jobsState: { ...state.jobsState, searchCompleted: false },
      };
    case "TOGGLE_ACTIVITY":
      return { ...state, quizState: { ...state.quizState, activities: toggleInArray(state.quizState.activities, action.payload) } };
    case "TOGGLE_DOCUMENT":
      return { ...state, quizState: { ...state.quizState, documentTypes: toggleInArray(state.quizState.documentTypes, action.payload) } };
    case "SET_PROGRAM_LEVEL":
      return {
        ...state,
        quizState: {
          ...state.quizState,
          programLevels: { ...state.quizState.programLevels, [action.payload.program]: action.payload.level },
        },
      };
    case "TOGGLE_PRO_SKILL":
      return {
        ...state,
        quizState: {
          ...state.quizState,
          professionalSkills: toggleInArray(state.quizState.professionalSkills, action.payload),
        },
      };
    case "TOGGLE_SCHEDULE":
      return {
        ...state,
        quizState: { ...state.quizState, schedules: toggleInArray(state.quizState.schedules, action.payload) },
        jobsState: { ...state.jobsState, searchCompleted: false },
      };
    case "TOGGLE_EMPLOYMENT_TYPE":
      return {
        ...state,
        quizState: { ...state.quizState, employmentTypes: toggleInArray(state.quizState.employmentTypes, action.payload) },
        jobsState: { ...state.jobsState, searchCompleted: false },
      };
    case "SET_SALARY_MIN":
      return {
        ...state,
        quizState: { ...state.quizState, salaryMin: state.quizState.salaryMin === action.payload ? "" : action.payload },
        jobsState: { ...state.jobsState, searchCompleted: false },
      };
    case "TOGGLE_RESTRICTION":
      return { ...state, quizState: { ...state.quizState, restrictions: toggleInArray(state.quizState.restrictions, action.payload) } };
    case "SET_ACCEPT_HANDICAPPED":
      return {
        ...state,
        quizState: { ...state.quizState, acceptHandicapped: action.payload },
        jobsState: { ...state.jobsState, searchCompleted: false },
      };
    case "SET_REGION_PICKER_OPEN":
      return { ...state, uiState: { ...state.uiState, isRegionPickerOpen: action.payload } };
    case "SET_ASSISTANT_OPEN":
      return { ...state, uiState: { ...state.uiState, isAssistantOpen: action.payload } };
    case "SET_PROFILE_READY":
      return { ...state, profileState: { ...state.profileState, profileReady: action.payload } };
    case "SET_RESUME_MODE":
      return { ...state, resumeState: { ...state.resumeState, resumeMode: action.payload } };
    case "TOGGLE_HIDE_NOT_RECOMMENDED":
      return { ...state, jobsState: { ...state.jobsState, hideNotRecommended: !state.jobsState.hideNotRecommended } };
    case "TOGGLE_SHOW_SCORING":
      return { ...state, jobsState: { ...state.jobsState, showScoring: !state.jobsState.showScoring } };
    case "SET_DATE_FILTER":
      return { ...state, jobsState: { ...state.jobsState, dateFilter: action.payload } };
    case "FILTER_JOBS_BY_STATUS":
      return {
        ...state,
        jobsState: {
          ...state.jobsState,
          jobs: state.jobsState.jobs.filter((job) => action.payload.includes(job.status)),
        },
      };
    case "SET_JOBS_LOADING":
      return { ...state, jobsState: { ...state.jobsState, isLoading: action.payload, error: null } };
    case "SET_JOBS_ERROR":
      return { ...state, jobsState: { ...state.jobsState, error: action.payload, isLoading: false } };
    case "SET_JOBS":
      return { ...state, jobsState: { ...state.jobsState, jobs: action.payload, decisions: {}, decisionHistory: [], dismissedJobIds: [], isLoading: false, searchCompleted: true } };
    case "DECIDE_JOB": {
      const { id, decision } = action.payload;
      return {
        ...state,
        jobsState: {
          ...state.jobsState,
          decisions: { ...state.jobsState.decisions, [id]: decision },
          decisionHistory: [...state.jobsState.decisionHistory, id],
        },
      };
    }
    case "DISMISS_JOB":
      return {
        ...state,
        jobsState: {
          ...state.jobsState,
          dismissedJobIds: state.jobsState.dismissedJobIds.includes(action.payload)
            ? state.jobsState.dismissedJobIds
            : [...state.jobsState.dismissedJobIds, action.payload],
        },
      };
    case "UNDO_LAST_SWIPE": {
      if (state.jobsState.decisionHistory.length === 0) return state;
      const lastId = state.jobsState.decisionHistory[state.jobsState.decisionHistory.length - 1];
      const newDecisions = { ...state.jobsState.decisions };
      delete newDecisions[lastId];
      return {
        ...state,
        jobsState: {
          ...state.jobsState,
          decisions: newDecisions,
          decisionHistory: state.jobsState.decisionHistory.slice(0, -1),
        },
      };
    }
    case "SET_SORT_MODE":
      return { ...state, jobsState: { ...state.jobsState, sortMode: action.payload } };
    case "LOAD_QUIZ_STATE":
      return {
        ...state,
        quizState: { ...action.payload, remoteExperience: action.payload.remoteExperience || "", currentStep: action.targetStep ?? 1 },
        jobsState: { ...state.jobsState, searchCompleted: false },
      };
    default:
      return state;
  }
};

const HrxStateContext = createContext<{ state: HrxState; dispatch: React.Dispatch<Action> } | null>(null);

const QUIZ_STORAGE_KEY = "hrx_quiz_state";
const QUIZ_EXPIRY_DAYS = 7;

function saveQuizToStorage(quizState: import("@/types/hrx").QuizState) {
  try {
    const payload = {
      data: quizState,
      savedAt: Date.now(),
    };
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

export function loadQuizFromStorage(): import("@/types/hrx").QuizState | null {
  try {
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const age = Date.now() - (parsed.savedAt || 0);
    if (age > QUIZ_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(QUIZ_STORAGE_KEY);
      return null;
    }
    const data = parsed.data;
    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(data.targetRoles) ||
      typeof data.currentStep !== "number" ||
      !data.remoteExperience
    ) {
      localStorage.removeItem(QUIZ_STORAGE_KEY);
      return null;
    }
    return {
      ...initialState.quizState,
      ...data,
      targetRoles: Array.isArray(data.targetRoles) ? data.targetRoles : [],
      activities: Array.isArray(data.activities) ? data.activities : [],
      professionalSkills: Array.isArray(data.professionalSkills) ? data.professionalSkills : [],
      schedules: Array.isArray(data.schedules) ? data.schedules : [],
      restrictions: Array.isArray(data.restrictions) ? data.restrictions : [],
      documentTypes: Array.isArray(data.documentTypes) ? data.documentTypes : [],
      organizationTypes: Array.isArray(data.organizationTypes) ? data.organizationTypes : [],
      employmentTypes: Array.isArray(data.employmentTypes) ? data.employmentTypes : [],
      excludedRoleQuick: Array.isArray(data.excludedRoleQuick) ? data.excludedRoleQuick : [],
      programLevels: data.programLevels && typeof data.programLevels === "object" ? data.programLevels : {},
    };
  } catch {
    localStorage.removeItem(QUIZ_STORAGE_KEY);
    return null;
  }
}

export function clearQuizStorage() {
  localStorage.removeItem(QUIZ_STORAGE_KEY);
}

export const HrxStateProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.uiState.theme === "dark");
  }, [state.uiState.theme]);

  useEffect(() => {
    if (state.quizState.remoteExperience) {
      saveQuizToStorage(state.quizState);
    }
  }, [state.quizState]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <HrxStateContext.Provider value={value}>{children}</HrxStateContext.Provider>;
};

export const useHrxState = () => {
  const context = useContext(HrxStateContext);
  if (!context) {
    throw new Error("useHrxState must be used within HrxStateProvider");
  }
  return context;
};
