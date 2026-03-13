import type { JobItem, QuizState } from "@/types/hrx";
import { hhAreaMap, trudvsemRegionCodeMap } from "./regionMapping";
import { scoreHhVacancy, scoreTrudvsemVacancy } from "./companyScoring";
import {
  findRoleOption,
  restrictionOptions as restrictionData,
  quickExclusionNotKeywords,
  scheduleOptions as scheduleData,
  employmentOptions as employmentData,
  salaryOptions as salaryData,
} from "@/data/quizData";

interface HhVacancy {
  id: string;
  name: string;
  area: { name: string };
  salary: { from: number | null; to: number | null; currency: string; gross: boolean } | null;
  employer: {
    name: string;
    trusted?: boolean;
    logo_urls?: Record<string, string> | null;
    accredited_it_employer?: boolean;
  };
  snippet: { requirement: string | null; responsibility: string | null };
  alternate_url: string;
  schedule: { id: string; name: string } | null;
  work_format?: { id: string; name: string }[];
  has_test?: boolean;
  contacts?: unknown | null;
  description?: string;
  published_at?: string;
  created_at?: string;
}

interface TrudvsemVacancy {
  vacancy: {
    id: string;
    "job-name": string;
    duty?: string;
    requirements?: string;
    region?: { name: string; region_code?: string };
    salary_min?: number;
    salary_max?: number;
    salary?: string;
    company?: { name: string; companycode?: string; inn?: string; ogrn?: string; site?: string };
    vac_url?: string;
    schedule?: string;
    employment?: string;
    contact_list?: { contact_type: string; contact_value: string }[];
    creation_date?: string;
    modify_date?: string;
  };
}

export interface CachedSearchResult {
  jobs: JobItem[];
  cachedAt: string | null;
  fromCache: boolean;
}

function buildSearchText(quiz: QuizState): string {
  const keywords: string[] = [];
  for (const roleTitle of quiz.targetRoles.slice(0, 5)) {
    const role = findRoleOption(roleTitle);
    if (role) {
      keywords.push(...role.searchKeywords.slice(0, 2));
    } else {
      keywords.push(roleTitle);
    }
  }
  const unique = [...new Set(keywords)].slice(0, 8);
  return unique.join(" OR ");
}

function buildNotKeywords(quiz: QuizState): string {
  const notParts: string[] = [];

  for (const restriction of quiz.restrictions) {
    const opt = restrictionData.find(r => r.label === restriction);
    if (opt && opt.notKeywords.length > 0) {
      notParts.push(...opt.notKeywords);
    }
  }

  for (const excl of quiz.excludedRoleQuick) {
    const kws = quickExclusionNotKeywords[excl];
    if (kws) {
      notParts.push(...kws);
    }
  }

  if (quiz.excludedRoles.trim()) {
    const phrases = quiz.excludedRoles
      .split(/[,;،\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 2);
    notParts.push(...phrases);
  }

  const unique = [...new Set(notParts)];
  return unique.map(k => `NOT "${k}"`).join(" ");
}

function matchesExclusions(text: string, quiz: QuizState): boolean {
  const lower = text.toLowerCase();

  for (const restriction of quiz.restrictions) {
    const opt = restrictionData.find(r => r.label === restriction);
    if (opt) {
      for (const kw of opt.notKeywords) {
        if (lower.includes(kw.toLowerCase())) return true;
      }
    }
  }

  for (const excl of quiz.excludedRoleQuick) {
    const kws = quickExclusionNotKeywords[excl];
    if (kws) {
      for (const kw of kws) {
        if (lower.includes(kw.toLowerCase())) return true;
      }
    }
  }

  if (quiz.excludedRoles.trim()) {
    const phrases = quiz.excludedRoles.split(/[,;،\n]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 2);
    for (const phrase of phrases) {
      if (lower.includes(phrase)) return true;
    }
  }

  return false;
}

function collectHhRoleIds(quiz: QuizState): number[] {
  const ids = new Set<number>();
  for (const roleTitle of quiz.targetRoles) {
    const role = findRoleOption(roleTitle);
    if (role) {
      role.hhRoleIds.forEach(id => ids.add(id));
    }
  }
  return [...ids];
}

function mapExperienceToHh(exp: string): string {
  if (exp === "Нет опыта") return "noExperience";
  if (exp === "От 1 до 3 лет") return "between1And3";
  if (exp === "От 3 до 6 лет") return "between3And6";
  if (exp === "Более 6 лет") return "moreThan6";
  return "";
}

function parseSalaryMin(salaryMin: string): number {
  const opt = salaryData.find(s => s.label === salaryMin);
  if (opt && opt.value > 0) return opt.value;
  return 0;
}

function formatSalary(from: number | null, to: number | null, currency: string): string {
  const cur = currency === "RUR" || currency === "RUB" ? "₽" : currency;
  if (from && to) return `${from.toLocaleString("ru-RU")}–${to.toLocaleString("ru-RU")} ${cur}`;
  if (from) return `от ${from.toLocaleString("ru-RU")} ${cur}`;
  if (to) return `до ${to.toLocaleString("ru-RU")} ${cur}`;
  return "Не указана";
}

function stripHtml(str: string | null): string {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, "").trim();
}

const NON_RUSSIA_LOCATIONS = [
  "беларусь", "белоруссия", "минск", "казахстан", "астана", "алматы",
  "узбекистан", "ташкент", "кыргызстан", "бишкек", "таджикистан",
  "туркменистан", "армения", "ереван", "грузия", "тбилиси",
  "азербайджан", "баку", "молдова", "кишинёв", "кишинев",
  "украина", "киев", "другие регионы",
];

function isRussianLocation(location?: string): boolean {
  if (!location) return true;
  const lower = location.toLowerCase();
  return !NON_RUSSIA_LOCATIONS.some(loc => lower.includes(loc));
}

function isStrictlyRemoteHh(v: HhVacancy): boolean {
  if (v.schedule?.id === "remote") return true;
  if (v.work_format?.some(wf => wf.id === "REMOTE")) return true;
  return false;
}

const REMOTE_SCHEDULE_VALUES = [
  "удаленная работа",
  "удалённая работа",
  "дистанционная работа",
];

function isRemoteTrudvsem(v: TrudvsemVacancy): boolean {
  const schedule = (v.vacancy.schedule || "").toLowerCase().trim();
  if (REMOTE_SCHEDULE_VALUES.some(rs => schedule.includes(rs))) return true;

  const name = (v.vacancy["job-name"] || "").toLowerCase();
  const duty = (v.vacancy.duty || "").toLowerCase();
  const hasRemoteInName = /\b(удал[её]нн|дистанционн|remote)\b/.test(name);
  const hasRemoteInDuty = /\b(удал[её]нн|дистанционн|remote)\b/.test(duty);
  return hasRemoteInName || hasRemoteInDuty;
}

function normalizeHhVacancy(v: HhVacancy): JobItem {
  const salary = v.salary
    ? formatSalary(v.salary.from, v.salary.to, v.salary.currency)
    : "Не указана";

  const description = [
    stripHtml(v.snippet.responsibility),
    stripHtml(v.snippet.requirement),
  ]
    .filter(Boolean)
    .join(". ");

  const companyScore = scoreHhVacancy({
    employer: v.employer,
    salary: v.salary,
    has_test: v.has_test,
    contacts: v.contacts,
    description: v.description,
    snippet: v.snippet,
  });

  let status: JobItem["status"] = "review";
  if (companyScore.level === "risky") status = "not_recommended";
  else if (companyScore.level === "trusted") status = "fit";

  return {
    id: `hh-${v.id}`,
    title: v.name,
    company: v.employer.name,
    salary,
    status,
    description: description || "Описание не указано",
    reason: companyScore.positives.slice(0, 2).join(". "),
    redFlags: companyScore.flags,
    source: "hh.ru",
    url: v.alternate_url,
    schedule: v.schedule?.name || "",
    location: v.area.name,
    companyScore,
    publishedAt: v.published_at || v.created_at || undefined,
  };
}

function normalizeTrudvsemVacancy(item: TrudvsemVacancy): JobItem {
  const v = item.vacancy;
  const salary =
    v.salary_min || v.salary_max
      ? formatSalary(v.salary_min || null, v.salary_max || null, "RUR")
      : v.salary || "Не указана";

  const descParts = [v.duty, v.requirements].filter(Boolean).map(s => stripHtml(s!));

  const companyScore = scoreTrudvsemVacancy({
    company: v.company,
    salary_min: v.salary_min,
    salary_max: v.salary_max,
    duty: v.duty,
    requirements: v.requirements,
    contact_list: v.contact_list,
  });

  let status: JobItem["status"] = "review";
  if (companyScore.level === "risky") status = "not_recommended";
  else if (companyScore.level === "trusted") status = "fit";

  return {
    id: `tv-${v.id}`,
    title: v["job-name"],
    company: v.company?.name || "Не указан",
    salary,
    status,
    description: descParts.join(". ") || "Описание не указано",
    reason: companyScore.positives.slice(0, 2).join(". "),
    redFlags: companyScore.flags,
    source: "trudvsem.ru",
    url: v.vac_url || `https://trudvsem.ru/vacancy/card/${v.company?.companycode || ""}/${v.id}`,
    schedule: [v.schedule, v.employment].filter(Boolean).join(", "),
    location: v.region?.name || "",
    companyScore,
    publishedAt: v.modify_date || v.creation_date || undefined,
  };
}

function buildSearchParams(quiz: QuizState) {
  const searchText = buildSearchText(quiz);
  const notText = buildNotKeywords(quiz);
  const roleIds = collectHhRoleIds(quiz);
  const experience = mapExperienceToHh(quiz.totalExperience);
  const salaryMin = parseSalaryMin(quiz.salaryMin);

  let area = "113";
  if (quiz.region) {
    const areaId = hhAreaMap[quiz.region.id];
    if (areaId) area = String(areaId);
  }

  let trudvsemRegionCode = "";
  if (quiz.region) {
    const code = trudvsemRegionCodeMap[quiz.region.id];
    if (code) trudvsemRegionCode = code;
  }

  const employmentTypes: string[] = [];
  for (const emp of quiz.employmentTypes) {
    const opt = employmentData.find(e => e.label === emp);
    if (opt) employmentTypes.push(opt.hhValue);
  }

  const schedules: string[] = [];
  for (const sch of quiz.schedules) {
    const opt = scheduleData.find(s => s.label === sch);
    if (opt) schedules.push(opt.hhValue);
  }

  return {
    searchText,
    notText,
    roleIds,
    area,
    experience,
    salaryMin,
    salaryCurrency: "RUR",
    onlyWithSalary: salaryMin > 0,
    employmentTypes,
    schedules,
    acceptHandicapped: quiz.acceptHandicapped,
    regionId: quiz.region?.id || "",
    trudvsemRegionCode,
  };
}

export async function searchAllVacancies(quiz: QuizState, forceRefresh = false): Promise<CachedSearchResult> {
  const searchText = buildSearchText(quiz);
  if (!searchText) return { jobs: [], cachedAt: null, fromCache: false };

  const params = buildSearchParams(quiz);
  const url = forceRefresh ? "/api/vacancies/search?refresh=true" : "/api/vacancies/search";

  console.log("[JobApi] sending search request to backend...");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Поиск вакансий занял слишком много времени. Попробуйте ещё раз или упростите параметры поиска.");
    }
    throw new Error("Не удалось подключиться к серверу. Проверьте интернет-соединение и попробуйте ещё раз.");
  }
  clearTimeout(timeout);

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Слишком много запросов. Подождите минуту и попробуйте снова.");
    }
    if (res.status >= 500) {
      throw new Error("Сервер временно недоступен. Попробуйте через несколько минут.");
    }
    const errBody = await res.json().catch(() => ({ error: "Ошибка сервера" }));
    throw new Error(errBody.error || `Ошибка: ${res.status}`);
  }

  const data = await res.json();
  const { hhItems, tvItems, cachedAt, fromCache } = data;

  console.log(`[JobApi] received: hh=${(hhItems || []).length}, tv=${(tvItems || []).length}, fromCache=${fromCache}`);

  const hhFiltered = (hhItems || []).filter(isStrictlyRemoteHh);
  const hhNormalized = hhFiltered.map(normalizeHhVacancy).filter(j => isRussianLocation(j.location));

  const tvFiltered = (tvItems || []).filter(isRemoteTrudvsem);
  const tvNormalized = tvFiltered.map(normalizeTrudvsemVacancy).filter(j => isRussianLocation(j.location));

  let allJobs = [
    ...hhNormalized.filter(j => !matchesExclusions(`${j.title} ${j.description}`, quiz)),
    ...tvNormalized.filter(j => !matchesExclusions(`${j.title} ${j.description}`, quiz)),
  ];

  allJobs.sort((a, b) => {
    const aRisky = a.companyScore?.level === "risky" ? 1 : 0;
    const bRisky = b.companyScore?.level === "risky" ? 1 : 0;
    if (aRisky !== bRisky) return aRisky - bRisky;
    return 0;
  });

  return {
    jobs: allJobs,
    cachedAt: cachedAt || null,
    fromCache: fromCache || false,
  };
}
