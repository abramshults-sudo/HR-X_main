import { Router, Request, Response } from "express";
import { db } from "./db.js";
import { sql } from "drizzle-orm";
import crypto from "crypto";

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const HH_API = "https://api.hh.ru";
const TV_API = "https://opendata.trudvsem.ru/api/v1";
const TV_API_FALLBACK = "http://opendata.trudvsem.ru/api/v1";
const USER_AGENT = "Mozilla/5.0 (compatible; HRXBot/1.0)";
const FETCH_TIMEOUT_MS = 15000;
const MAX_CACHE_ENTRIES = 500;

interface SearchParams {
  searchText: string;
  notText: string;
  roleIds: number[];
  area: string;
  experience: string;
  salaryMin: number;
  salaryCurrency: string;
  onlyWithSalary: boolean;
  employmentTypes: string[];
  schedules: string[];
  acceptHandicapped: boolean;
  regionId: string;
  trudvsemRegionCode: string;
}

function sanitizeParams(body: any): SearchParams {
  return {
    searchText: typeof body.searchText === "string" ? body.searchText.slice(0, 500) : "",
    notText: typeof body.notText === "string" ? body.notText.slice(0, 1000) : "",
    roleIds: Array.isArray(body.roleIds)
      ? body.roleIds.filter((id: any) => typeof id === "number" && id > 0 && id < 10000).slice(0, 20)
      : [],
    area: typeof body.area === "string" ? body.area.slice(0, 20) : "113",
    experience: typeof body.experience === "string" ? body.experience.slice(0, 30) : "",
    salaryMin: typeof body.salaryMin === "number" && body.salaryMin >= 0 ? Math.min(body.salaryMin, 1000000) : 0,
    salaryCurrency: typeof body.salaryCurrency === "string" ? body.salaryCurrency.slice(0, 5) : "RUR",
    onlyWithSalary: body.onlyWithSalary === true,
    employmentTypes: Array.isArray(body.employmentTypes)
      ? body.employmentTypes.filter((s: any) => typeof s === "string").slice(0, 10).map((s: string) => s.slice(0, 30))
      : [],
    schedules: Array.isArray(body.schedules)
      ? body.schedules.filter((s: any) => typeof s === "string").slice(0, 10).map((s: string) => s.slice(0, 50))
      : [],
    acceptHandicapped: body.acceptHandicapped === true,
    regionId: typeof body.regionId === "string" ? body.regionId.slice(0, 50) : "",
    trudvsemRegionCode: typeof body.trudvsemRegionCode === "string" ? body.trudvsemRegionCode.slice(0, 30) : "",
  };
}

function buildCacheKey(params: SearchParams): string {
  const normalized = {
    t: params.searchText,
    n: params.notText,
    r: [...params.roleIds].sort(),
    a: params.area,
    e: params.experience,
    s: params.salaryMin,
    emp: [...params.employmentTypes].sort(),
    sch: [...params.schedules].sort(),
    h: params.acceptHandicapped,
    reg: params.regionId,
    tv: params.trudvsemRegionCode,
  };
  const str = JSON.stringify(normalized);
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 32);
}

async function fetchWithRetry(url: string, headers: Record<string, string> = {}, retries = 2, delay = 1500): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("json")) {
        return await res.json();
      }
      if (res.ok && !ct.includes("json")) {
        console.warn(`[VacancyCache] attempt ${attempt + 1}: unexpected content-type "${ct}"`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`Unexpected content-type: ${ct}`);
      }
      if (!res.ok) {
        console.warn(`[VacancyCache] attempt ${attempt + 1}: status ${res.status}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`API error: ${res.status}`);
      }
    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === "AbortError") {
        console.warn(`[VacancyCache] attempt ${attempt + 1}: timeout after ${FETCH_TIMEOUT_MS}ms`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error("Request timed out");
      }
      if (attempt < retries && (err instanceof TypeError || err?.code === "ECONNRESET")) {
        console.warn(`[VacancyCache] attempt ${attempt + 1}: network error, retrying...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed after retries");
}

async function fetchHhVacancies(params: SearchParams): Promise<any[]> {
  const fullText = params.notText ? `${params.searchText} ${params.notText}` : params.searchText;

  const baseParams = new URLSearchParams({
    text: fullText,
    per_page: "100",
    page: "0",
    schedule: "remote",
    area: params.area || "113",
  });

  params.roleIds.forEach(id => baseParams.append("professional_role", String(id)));

  if (params.experience) baseParams.set("experience", params.experience);
  if (params.salaryMin > 0) {
    baseParams.set("salary", String(params.salaryMin));
    baseParams.set("currency", params.salaryCurrency || "RUR");
    baseParams.set("only_with_salary", "true");
  }
  params.employmentTypes.forEach(emp => baseParams.append("employment", emp));
  params.schedules.forEach(sch => baseParams.append("work_schedule_by_days", sch));
  if (params.acceptHandicapped) baseParams.append("label", "accept_handicapped");

  const url = `${HH_API}/vacancies?${baseParams.toString()}`;
  console.log("[VacancyCache:HH] fetching:", url.substring(0, 200) + "...");
  let data = await fetchWithRetry(url, { "User-Agent": USER_AGENT });
  let items = data.items || [];
  let successParams = baseParams;
  let successPages = data.pages || 1;

  if (items.length === 0 && (params.experience || params.salaryMin > 0)) {
    console.log("[VacancyCache:HH] strict search returned 0, relaxing...");
    const relaxed = new URLSearchParams({
      text: fullText,
      per_page: "100",
      page: "0",
      schedule: "remote",
      area: "113",
    });
    params.roleIds.forEach(id => relaxed.append("professional_role", String(id)));
    params.employmentTypes.forEach(emp => relaxed.append("employment", emp));
    params.schedules.forEach(sch => relaxed.append("work_schedule_by_days", sch));
    if (params.acceptHandicapped) relaxed.append("label", "accept_handicapped");

    const relaxedUrl = `${HH_API}/vacancies?${relaxed.toString()}`;
    data = await fetchWithRetry(relaxedUrl, { "User-Agent": USER_AGENT });
    items = data.items || [];
    successParams = relaxed;
    successPages = data.pages || 1;
    console.log("[VacancyCache:HH] relaxed found:", items.length);
  }

  let allItems = [...items];
  const maxPages = Math.min(successPages, 20);
  for (let page = 1; page < maxPages; page++) {
    const nextParams = new URLSearchParams(successParams);
    nextParams.set("page", String(page));
    try {
      const nextUrl = `${HH_API}/vacancies?${nextParams.toString()}`;
      const nextData = await fetchWithRetry(nextUrl, { "User-Agent": USER_AGENT });
      const nextItems = nextData.items || [];
      if (nextItems.length === 0) break;
      allItems.push(...nextItems);
      console.log(`[VacancyCache:HH] page ${page + 1}: +${nextItems.length}, total: ${allItems.length}`);
    } catch (e) {
      console.warn(`[VacancyCache:HH] page ${page + 1} failed, stopping`);
      break;
    }
  }

  console.log(`[VacancyCache:HH] total fetched: ${allItems.length}`);
  return allItems;
}

async function fetchTvVacancies(params: SearchParams): Promise<any[]> {
  const fullSearchText = `${params.searchText} удалённая`;
  const qp = new URLSearchParams({ text: fullSearchText, offset: "0", limit: "100" });

  let basePath = "/vacancies";
  if (params.trudvsemRegionCode) {
    basePath = `/vacancies/region/${params.trudvsemRegionCode}`;
  }

  async function tryTvFetch(apiBase: string, path: string, params: URLSearchParams): Promise<any> {
    const url = `${apiBase}${path}?${params.toString()}`;
    console.log("[VacancyCache:TV] fetching:", url.substring(0, 200));
    return await fetchWithRetry(url, {}, 1, 1000);
  }

  let data: any;
  try {
    data = await tryTvFetch(TV_API, basePath, qp);
  } catch (e) {
    console.warn("[VacancyCache:TV] HTTPS failed, trying HTTP fallback...");
    data = await tryTvFetch(TV_API_FALLBACK, basePath, qp);
  }

  let vacancies = data.results?.vacancies || [];

  if (vacancies.length === 0 && params.trudvsemRegionCode) {
    console.log("[VacancyCache:TV] regional returned 0, trying without region...");
    try {
      data = await tryTvFetch(TV_API, "/vacancies", qp);
    } catch (e) {
      data = await tryTvFetch(TV_API_FALLBACK, "/vacancies", qp);
    }
    vacancies = data.results?.vacancies || [];
    basePath = "/vacancies";
  }

  const totalAvailable = data.meta?.total || 0;
  if (totalAvailable > 100 && vacancies.length >= 50) {
    const maxOffset = Math.min(totalAvailable, 1000);
    for (let offset = 100; offset < maxOffset; offset += 100) {
      const nextQp = new URLSearchParams({ text: fullSearchText, offset: String(offset), limit: "100" });
      try {
        let nextData: any;
        try {
          nextData = await tryTvFetch(TV_API, basePath, nextQp);
        } catch {
          nextData = await tryTvFetch(TV_API_FALLBACK, basePath, nextQp);
        }
        const nextVacancies = nextData.results?.vacancies || [];
        if (nextVacancies.length === 0) break;
        vacancies.push(...nextVacancies);
        console.log(`[VacancyCache:TV] offset ${offset}: +${nextVacancies.length}, total: ${vacancies.length}`);
      } catch (e) {
        console.warn(`[VacancyCache:TV] offset ${offset} failed, stopping`);
        break;
      }
    }
  }

  console.log(`[VacancyCache:TV] total fetched: ${vacancies.length}`);
  return vacancies;
}

async function cleanupStaleCache() {
  try {
    const deleted = await db.execute(sql`
      DELETE FROM vacancy_cache
      WHERE cached_at < NOW() - INTERVAL '24 hours'
    `);
    const count = await db.execute(sql`SELECT COUNT(*) as cnt FROM vacancy_cache`);
    const total = Number((count.rows[0] as any)?.cnt || 0);
    if (total > MAX_CACHE_ENTRIES) {
      await db.execute(sql`
        DELETE FROM vacancy_cache
        WHERE id NOT IN (
          SELECT id FROM vacancy_cache ORDER BY cached_at DESC LIMIT ${MAX_CACHE_ENTRIES}
        )
      `);
      console.log(`[VacancyCache] cleanup: trimmed to ${MAX_CACHE_ENTRIES} entries`);
    }
  } catch (err) {
    console.error("[VacancyCache] cleanup error:", err);
  }
}

setInterval(cleanupStaleCache, 60 * 60 * 1000);
setTimeout(cleanupStaleCache, 30000);

const vacancyRouter = Router();

vacancyRouter.post("/search", async (req: Request, res: Response) => {
  try {
    const params = sanitizeParams(req.body);
    if (!params.searchText) {
      res.status(400).json({ error: "searchText is required" });
      return;
    }

    const cacheKey = buildCacheKey(params);
    const forceRefresh = req.query.refresh === "true";

    if (!forceRefresh) {
      const cached = await db.execute(sql`
        SELECT hh_items, tv_items, cached_at
        FROM vacancy_cache
        WHERE cache_key = ${cacheKey}
          AND cached_at > NOW() - INTERVAL '3 hours'
        LIMIT 1
      `);

      if (cached.rows && cached.rows.length > 0) {
        const row = cached.rows[0] as any;
        console.log(`[VacancyCache] HIT for key ${cacheKey.slice(0, 8)}...`);
        res.json({
          hhItems: row.hh_items,
          tvItems: row.tv_items,
          cachedAt: row.cached_at,
          fromCache: true,
        });
        return;
      }
    }

    console.log(`[VacancyCache] MISS for key ${cacheKey.slice(0, 8)}..., fetching from APIs...`);

    const [hhItems, tvItems] = await Promise.allSettled([
      fetchHhVacancies(params),
      fetchTvVacancies(params),
    ]);

    const hhResult = hhItems.status === "fulfilled" ? hhItems.value : [];
    const tvResult = tvItems.status === "fulfilled" ? tvItems.value : [];

    if (hhItems.status === "rejected") console.error("[VacancyCache] hh.ru failed:", hhItems.reason);
    if (tvItems.status === "rejected") console.error("[VacancyCache] trudvsem.ru failed:", tvItems.reason);

    if (hhResult.length === 0 && tvResult.length === 0 && hhItems.status === "rejected" && tvItems.status === "rejected") {
      res.status(502).json({ error: "Не удалось загрузить вакансии. Серверы hh.ru и trudvsem.ru временно недоступны. Попробуйте через несколько минут." });
      return;
    }

    const hhJson = JSON.stringify(hhResult);
    const tvJson = JSON.stringify(tvResult);

    await db.execute(sql`
      INSERT INTO vacancy_cache (cache_key, search_params, hh_items, tv_items, hh_count, tv_count, cached_at)
      VALUES (${cacheKey}, ${JSON.stringify(params)}::jsonb, ${hhJson}::jsonb, ${tvJson}::jsonb, ${hhResult.length}, ${tvResult.length}, NOW())
      ON CONFLICT (cache_key)
      DO UPDATE SET
        hh_items = ${hhJson}::jsonb,
        tv_items = ${tvJson}::jsonb,
        hh_count = ${hhResult.length},
        tv_count = ${tvResult.length},
        cached_at = NOW()
    `);

    console.log(`[VacancyCache] stored: hh=${hhResult.length}, tv=${tvResult.length}`);

    res.json({
      hhItems: hhResult,
      tvItems: tvResult,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    });
  } catch (err) {
    console.error("[VacancyCache] search error:", err);
    res.status(500).json({ error: "Ошибка при поиске вакансий" });
  }
});

vacancyRouter.get("/cache-stats", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE cached_at > NOW() - INTERVAL '3 hours') as fresh_entries,
        COALESCE(SUM(hh_count), 0) as total_hh,
        COALESCE(SUM(tv_count), 0) as total_tv,
        MIN(cached_at) as oldest,
        MAX(cached_at) as newest
      FROM vacancy_cache
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[VacancyCache] stats error:", err);
    res.status(500).json({ error: "Ошибка" });
  }
});

export { vacancyRouter };
