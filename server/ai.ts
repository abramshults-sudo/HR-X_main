import { Router, Request, Response } from "express";
import OpenAI from "openai";
import { requireAuth } from "./auth.js";
import { db } from "./db.js";
import { appSettings, users } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import { addLog } from "./admin.js";

async function requirePaid(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Необходима авторизация" });
    return;
  }
  try {
    const [user] = await db.select({ hasPaid: users.hasPaid }).from(users).where(eq(users.id, req.session.userId));
    if (!user || !user.hasPaid) {
      res.status(403).json({ error: "Эта функция доступна после оплаты" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Ошибка проверки доступа" });
  }
}

function getOpenAiKey(): string {
  return process.env.OPENAI_API_KEY || "";
}

async function loadKeyFromDb(): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "OPENAI_API_KEY"));
    if (row?.value) {
      process.env.OPENAI_API_KEY = row.value;
      return row.value;
    }
  } catch {}
  return getOpenAiKey();
}

function buildAdaptPrompt(resumeText: string, vacancyText: string): string {
  return `Ты — профессиональный HR-консультант и эксперт по резюме для российского рынка труда. Твоя задача — адаптировать резюме кандидата под конкретную вакансию.

## Общие принципы адаптации

1. **Краткость**: излагай информацию сжато, без "воды". Один пункт = одна мысль. Избегай причастных и деепричастных оборотов. Резюме должно помещаться на 1-2 страницы.
2. **Конкретность**: заменяй общие фразы на измеримые достижения. Например: "Работал с клиентами" → "Обслуживал 50+ клиентов ежедневно".
3. **Релевантность**: содержание должно соответствовать требованиям вакансии. Нерелевантный опыт можно сократить или убрать. Порядок разделов и пунктов — по важности для вакансии.
4. **Правдивость**: НЕ преувеличивай опыт и навыки. НЕ выдумывай факты, даты, компании. НЕ добавляй то, чего не было.
5. **Деловой стиль**: исключи юмор, сленг, восклицательные знаки. Используй профессиональную лексику. Избегай местоимения "я".

## Алгоритм адаптации

### Шаг 1: Анализ вакансии
- Выдели ключевые требования
- Определи обязательные и желательные навыки
- Запиши ключевые слова (технологии, инструменты, термины)

### Шаг 2: Название должности
- Должно соответствовать или быть близким к названию в вакансии
- Без грейдов (Junior/Middle/Senior), если в вакансии их нет
- Стандартное название, понятное ATS-системам

### Шаг 3: Интеграция ключевых слов
- Естественно встрой ключевые слова из вакансии
- Плотность: 2-3% от объёма текста
- Не переборщи — текст должен читаться естественно

### Шаг 4: Приоритизация опыта
- Релевантные обязанности и проекты — в начало
- Менее релевантные — в конец или убрать
- Используй обратную хронологию

### Шаг 5: Квантификация достижений
- Добавь цифры, проценты, конкретные результаты (только если они есть в оригинале)
- Свяжи с бизнес-результатом
- Используй сильные глаголы: увеличил, сократил, оптимизировал, разработал, внедрил, автоматизировал, управлял, координировал, обучил

### Шаг 6: Удаление лишнего
- Убери информацию, не относящуюся к вакансии
- Удали устаревший опыт (>10 лет назад, если не критичен)
- Сократи очевидное

## Структура адаптированного резюме

1. **Желаемая должность** — одна строка, соответствует вакансии
2. **Профессиональное резюме** — 2-3 предложения: ключевые компетенции, годы опыта, главное достижение
3. **Опыт работы** — обратная хронология, для каждой позиции: компания, должность, период, 3-5 пунктов (обязанности + достижения)
4. **Образование** — вуз, факультет, специальность, год
5. **Ключевые навыки** — только релевантные для вакансии
6. **О себе** — 1-2 предложения (опционально)

## Что НЕ включать
- Семейное положение, возраст, национальность
- Хобби (если не связаны с работой)
- Очевидные навыки: MS Office, "уверенный пользователь ПК", "работа в команде"
- Нерелевантный опыт работы
- Причины увольнения
- Зарплатные ожидания
- "Рекомендации предоставлю по запросу"

## Работа с ATS
- Используй стандартные названия разделов
- Включи ключевые слова из вакансии
- Избегай таблиц, колонок, графики

## КРИТИЧЕСКИ ВАЖНО — ЗАПРЕТ ГАЛЛЮЦИНАЦИЙ
- СТРОГО ЗАПРЕЩЕНО выдумывать факты, компании, должности, проекты или навыки
- СТРОГО ЗАПРЕЩЕНО добавлять образование, сертификаты или курсы, которых нет в оригинале
- СТРОГО ЗАПРЕЩЕНО придумывать метрики и цифры
- Используй ТОЛЬКО информацию из оригинального резюме
- Можно: перефразировать, реструктурировать, приоритизировать
- Нельзя: добавлять то, чего не было в оригинале

## Формат ответа

Ответ СТРОГО в JSON:
{
  "adaptedResume": "полный текст адаптированного резюме",
  "changes": ["изменение 1", "изменение 2", ...],
  "matchScore": число от 0 до 100,
  "matchDetails": {
    "matched": ["совпавшее требование 1", ...],
    "partial": ["частично совпавшее 1", ...],
    "missing": ["отсутствующее требование 1", ...]
  }
}

Где:
- adaptedResume — полный текст адаптированного резюме
- changes — список конкретных изменений, которые ты внёс
- matchScore — процент совпадения резюме с вакансией (объективная оценка)
- matchDetails — детализация: что совпало, что частично, чего не хватает

---

## РЕЗЮМЕ КАНДИДАТА:
${resumeText}

## ВАКАНСИЯ:
${vacancyText}`;
}

function buildHallucinationCheckPrompt(
  originalResume: string,
  adaptedResume: string,
): string {
  return `Ты — детектор галлюцинаций в резюме. Твоя задача — сравнить оригинальное и адаптированное резюме и найти ВЫДУМАННУЮ информацию.

ГАЛЛЮЦИНАЦИИ — это информация в адаптированном резюме, которой НЕТ в оригинале:
- Выдуманные компании, должности, проекты
- Несуществующее образование, сертификаты, курсы
- Придуманные навыки и технологии
- Фальшивые метрики и достижения
- Неправдивые даты работы

НЕ СЧИТАЕТСЯ галлюцинацией:
- Перефразирование существующей информации
- Реструктуризация разделов
- Добавление ключевых слов из вакансии к СУЩЕСТВУЮЩИМ навыкам
- Umbrella-термины (например, NLP вместо "обработка текстов")
- Обобщение опыта

Ответ СТРОГО в JSON:
{
  "score": число от 0 до 100,
  "hallucinations": ["описание галлюцинации 1", ...],
  "verdict": "PASSED" или "FAILED"
}

Где score: 100 = всё из оригинала, 0 = много выдумок.
Verdict: PASSED если score >= 85, иначе FAILED.

---

## ОРИГИНАЛЬНОЕ РЕЗЮМЕ:
${originalResume}

## АДАПТИРОВАННОЕ РЕЗЮМЕ:
${adaptedResume}`;
}

const aiRouter = Router();

aiRouter.post("/adapt", requirePaid, async (req: Request, res: Response) => {
  try {
    let apiKey = getOpenAiKey();
    if (!apiKey) {
      apiKey = await loadKeyFromDb();
    }
    if (!apiKey) {
      res.status(400).json({
        error:
          "API-ключ OpenAI не настроен. Попросите администратора добавить ключ в панели управления.",
      });
      return;
    }

    const { resumeText, vacancyText, vacancyTitle, companyName } = req.body;

    if (
      !resumeText ||
      typeof resumeText !== "string" ||
      !vacancyText ||
      typeof vacancyText !== "string"
    ) {
      res.status(400).json({ error: "Текст резюме и описание вакансии обязательны" });
      return;
    }

    if (resumeText.length > 15000 || vacancyText.length > 15000) {
      res.status(400).json({ error: "Текст слишком длинный (максимум 15000 символов)" });
      return;
    }

    const vacancyFull = [
      vacancyTitle ? `Должность: ${vacancyTitle}` : "",
      companyName ? `Компания: ${companyName}` : "",
      vacancyText,
    ]
      .filter(Boolean)
      .join("\n");

    const openai = new OpenAI({ apiKey });

    const adaptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: buildAdaptPrompt(resumeText, vacancyFull),
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const adaptContent = adaptResponse.choices[0]?.message?.content;
    if (!adaptContent) {
      res.status(500).json({ error: "Пустой ответ от ИИ" });
      return;
    }

    let adaptResult: any;
    try {
      adaptResult = JSON.parse(adaptContent);
    } catch {
      res
        .status(500)
        .json({ error: "Ошибка парсинга ответа ИИ" });
      return;
    }

    const checkResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: buildHallucinationCheckPrompt(
            resumeText,
            adaptResult.adaptedResume || "",
          ),
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const checkContent = checkResponse.choices[0]?.message?.content;
    let hallucinationCheck: any = { score: 0, hallucinations: [], verdict: "UNKNOWN" };
    if (checkContent) {
      try {
        hallucinationCheck = JSON.parse(checkContent);
      } catch {}
    }

    if (hallucinationCheck.verdict === "FAILED" && hallucinationCheck.hallucinations?.length > 0) {
      const fixPrompt = `Ты адаптировал резюме, но проверка обнаружила галлюцинации (выдуманную информацию). Удали все выдуманные данные и верни исправленный вариант.

Обнаруженные галлюцинации:
${hallucinationCheck.hallucinations.map((h: string, i: number) => `${i + 1}. ${h}`).join("\n")}

Оригинальное резюме:
${resumeText}

Адаптированное резюме с галлюцинациями:
${adaptResult.adaptedResume}

Верни исправленное резюме в JSON:
{
  "adaptedResume": "исправленный текст без галлюцинаций",
  "removedHallucinations": ["что было удалено 1", ...]
}`;

      const fixResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: fixPrompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const fixContent = fixResponse.choices[0]?.message?.content;
      if (fixContent) {
        try {
          const fixResult = JSON.parse(fixContent);
          if (fixResult.adaptedResume) {
            adaptResult.adaptedResume = fixResult.adaptedResume;
            adaptResult.changes = [
              ...(adaptResult.changes || []),
              "Автоматическое исправление: убраны неточности",
            ];
            hallucinationCheck.verdict = "FIXED";
            hallucinationCheck.removedHallucinations =
              fixResult.removedHallucinations || [];
          }
        } catch {}
      }
    }

    const tokensUsed =
      (adaptResponse.usage?.total_tokens || 0) +
      (checkResponse.usage?.total_tokens || 0);

    addLog(
      "ai",
      "resume_adapted",
      {
        userId: req.session.userId,
        vacancyTitle: vacancyTitle || null,
        matchScore: adaptResult.matchScore,
        hallucinationVerdict: hallucinationCheck.verdict,
        tokensUsed,
      },
      req.ip,
      req.session.userId,
    );

    res.json({
      adaptedResume: adaptResult.adaptedResume || "",
      changes: adaptResult.changes || [],
      matchScore: adaptResult.matchScore || 0,
      matchDetails: adaptResult.matchDetails || {
        matched: [],
        partial: [],
        missing: [],
      },
      hallucinationCheck: {
        score: hallucinationCheck.score || 0,
        verdict: hallucinationCheck.verdict || "UNKNOWN",
        hallucinations: hallucinationCheck.hallucinations || [],
      },
    });
  } catch (err: any) {
    console.error("AI adapt error:", err);

    if (err?.status === 401 || err?.code === "invalid_api_key") {
      res.status(400).json({ error: "Неверный API-ключ OpenAI" });
      return;
    }
    if (err?.status === 429) {
      res.status(429).json({ error: "Превышен лимит запросов OpenAI. Попробуйте позже." });
      return;
    }
    if (err?.status === 402 || err?.code === "insufficient_quota") {
      res.status(402).json({ error: "Недостаточно средств на аккаунте OpenAI" });
      return;
    }

    res.status(500).json({ error: "Ошибка генерации. Попробуйте позже." });
  }
});

aiRouter.post("/generate", requirePaid, async (req: Request, res: Response) => {
  try {
    let apiKey = getOpenAiKey();
    if (!apiKey) {
      apiKey = await loadKeyFromDb();
    }
    if (!apiKey) {
      res.status(400).json({
        error: "API-ключ OpenAI не настроен. Попросите администратора добавить ключ в панели управления.",
      });
      return;
    }

    const { quizData, mode } = req.body;

    if (!quizData || typeof quizData !== "object") {
      res.status(400).json({ error: "Данные квиза обязательны" });
      return;
    }

    const prompt = buildGeneratePrompt(quizData, mode || "regular");

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      res.status(500).json({ error: "Пустой ответ от ИИ" });
      return;
    }

    let result: any;
    try {
      result = JSON.parse(content);
    } catch {
      res.status(500).json({ error: "Ошибка парсинга ответа ИИ" });
      return;
    }

    addLog(
      "ai",
      "resume_generated",
      {
        userId: req.session.userId,
        mode,
        tokensUsed: response.usage?.total_tokens || 0,
      },
      req.ip,
      req.session.userId,
    );

    res.json({
      resumeText: result.resumeText || "",
      sections: result.sections || [],
      tips: result.tips || [],
    });
  } catch (err: any) {
    console.error("AI generate error:", err);

    if (err?.status === 401 || err?.code === "invalid_api_key") {
      res.status(400).json({ error: "Неверный API-ключ OpenAI" });
      return;
    }
    if (err?.status === 429) {
      res.status(429).json({ error: "Превышен лимит запросов OpenAI. Попробуйте позже." });
      return;
    }
    if (err?.status === 402 || err?.code === "insufficient_quota") {
      res.status(402).json({ error: "Недостаточно средств на аккаунте OpenAI" });
      return;
    }

    res.status(500).json({ error: "Ошибка генерации. Попробуйте позже." });
  }
});

function buildCoverLetterPrompt(resumeText: string, vacancyText: string): string {
  return `Ты — профессиональный карьерный консультант. Напиши сопроводительное письмо к вакансии на основе резюме кандидата.

ДАННЫЕ КАНДИДАТА:
${resumeText}

ВАКАНСИЯ:
${vacancyText}

ТРЕБОВАНИЯ К ПИСЬМУ:
- Длина: строго до 1000 символов включая пробелы
- Структура: приветствие → 1-2 предложения о себе → почему эта компания/вакансия → конкретный опыт, релевантный этой должности → призыв к действию → подпись
- Тон: профессиональный, но живой — не сухой канцелярит и не заискивающий
- Начинать с «Здравствуйте» или «Добрый день», НЕ с «Уважаемые господа»
- НЕ использовать клише: «целеустремлённый», «коммуникабельный», «стрессоустойчивый», «командный игрок»
- Заканчивать конкретно: «Готов(а) пройти собеседование в удобное для вас время»
- Писать от первого лица, без пафоса

САМОСТОЯТЕЛЬНОСТЬ ТЕКСТА:
- Письмо — это не пересказ резюме и не пересказ вакансии, а самостоятельный текст
- Резюме и вакансия используются как источники информации для размышления, а не как материал для копирования или парафраза
- Нельзя брать формулировки из вакансии и возвращать их кандидату в виде «я умею то, что вы ищете»
- Нельзя перечислять обязанности из вакансии, даже своими словами
- Вместо этого: найти точку пересечения между тем, что нужно работодателю, и тем, что есть у кандидата — и написать об этом пересечении своими словами, конкретно и по существу

РАБОТА С ОПЫТОМ КАНДИДАТА:
- Весь упомянутый опыт должен быть основан исключительно на данных из резюме — не придумывать должности, компании, навыки или достижения, которых там нет
- Допускается лёгкое акцентирование: подать имеющийся опыт чуть увереннее, выбрать наиболее выгодные формулировки, расставить акценты на том, что релевантно вакансии
- Недопустимо: менять суть опыта, добавлять годы стажа, приписывать руководящие функции, называть конкретные цифры и результаты, которых нет в резюме
- Если опыт кандидата частично не совпадает с требованиями — сделать акцент на том, что совпадает, о пробелах умолчать

Верни только текст письма, без пояснений и комментариев.`;
}

aiRouter.post("/cover-letter", requirePaid, async (req: Request, res: Response) => {
  try {
    let apiKey = getOpenAiKey();
    if (!apiKey) {
      apiKey = await loadKeyFromDb();
    }
    if (!apiKey) {
      res.status(400).json({
        error: "API-ключ OpenAI не настроен. Попросите администратора добавить ключ в панели управления.",
      });
      return;
    }

    const { resumeText, vacancyText, vacancyTitle, companyName } = req.body;

    if (!resumeText || typeof resumeText !== "string" || !vacancyText || typeof vacancyText !== "string") {
      res.status(400).json({ error: "Текст резюме и описание вакансии обязательны" });
      return;
    }

    if (resumeText.length > 15000 || vacancyText.length > 15000) {
      res.status(400).json({ error: "Текст слишком длинный (максимум 15000 символов)" });
      return;
    }

    const vacancyFull = [
      vacancyTitle ? `Должность: ${vacancyTitle}` : "",
      companyName ? `Компания: ${companyName}` : "",
      vacancyText,
    ]
      .filter(Boolean)
      .join("\n");

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: buildCoverLetterPrompt(resumeText, vacancyFull),
        },
      ],
      temperature: 0.5,
      max_tokens: 600,
    });

    let content = response.choices[0]?.message?.content;
    if (!content) {
      res.status(500).json({ error: "Пустой ответ от ИИ" });
      return;
    }

    content = content.trim();
    if (content.length > 1200) {
      content = content.slice(0, 1000);
      const lastDot = content.lastIndexOf(".");
      if (lastDot > 800) content = content.slice(0, lastDot + 1);
    }

    addLog(
      "ai",
      "cover_letter_generated",
      {
        userId: req.session.userId,
        vacancyTitle: vacancyTitle || null,
        tokensUsed: response.usage?.total_tokens || 0,
      },
      req.ip,
      req.session.userId,
    );

    res.json({ coverLetter: content.trim() });
  } catch (err: any) {
    console.error("AI cover letter error:", err);

    if (err?.status === 401 || err?.code === "invalid_api_key") {
      res.status(400).json({ error: "Неверный API-ключ OpenAI" });
      return;
    }
    if (err?.status === 429) {
      res.status(429).json({ error: "Превышен лимит запросов OpenAI. Попробуйте позже." });
      return;
    }
    if (err?.status === 402 || err?.code === "insufficient_quota") {
      res.status(402).json({ error: "Недостаточно средств на аккаунте OpenAI" });
      return;
    }

    res.status(500).json({ error: "Ошибка генерации. Попробуйте позже." });
  }
});

function buildGeneratePrompt(quizData: any, mode: string): string {
  const roles = (quizData.targetRoles || []).join(", ") || "не указаны";
  const experience = quizData.totalExperience || "не указан";
  const region = quizData.region?.name || "не указан";
  const moscowHours = quizData.moscowHours
    ? `${quizData.moscowHours.from}–${quizData.moscowHours.to}`
    : "не указаны";
  const activities = (quizData.activities || []).join(", ") || "не указаны";
  const orgTypes = (quizData.organizationTypes || []).join(", ") || "не указаны";
  const documentTypes = (quizData.documentTypes || []).join(", ") || "не указаны";
  const professionalSkills = (quizData.professionalSkills || []).join(", ") || "не указаны";
  const schedules = (quizData.schedules || []).join(", ") || "не указаны";
  const employmentTypes = (quizData.employmentTypes || []).join(", ") || "не указаны";
  const salaryMin = quizData.salaryMin || "не указана";
  const restrictions = (quizData.restrictions || []).join(", ") || "нет";

  const programEntries = Object.entries(quizData.programLevels || {})
    .filter(([, level]) => level !== "none")
    .map(([prog, level]) => {
      const labels: Record<string, string> = {
        advanced: "продвинутый",
        confident: "уверенный",
        basic: "базовый",
      };
      return `${prog} (${labels[level as string] || level})`;
    });
  const programs = programEntries.length > 0 ? programEntries.join(", ") : "не указаны";

  const atsInstruction = mode === "ats"
    ? `\n\nДОПОЛНИТЕЛЬНО ДЛЯ ATS-ВЕРСИИ:
- Добавь в конец раздел "КЛЮЧЕВЫЕ СЛОВА" со списком всех релевантных ключевых слов через запятую
- Используй стандартные названия разделов: "Профессиональный профиль", "Опыт и компетенции", "Навыки", "Условия работы"
- Максимально насыщай текст ключевыми словами для поисковых систем (hh.ru, SuperJob)`
    : "";

  return `Ты — профессиональный HR-консультант и карьерный коуч. Твоя задача — составить профессиональное резюме на основе данных кандидата.

## Принципы составления резюме

1. **Живой язык**: пиши естественным деловым языком, не механическим перечислением. Резюме должно производить впечатление написанного живым профессионалом, а не сгенерированного шаблоном.
2. **Конкретность**: вместо общих фраз используй конкретные формулировки. Формула: [Глагол действия] + [Что сделал] + [Результат/контекст].
3. **Структурированность**: чёткие разделы, лёгкое визуальное восприятие, маркированные списки.
4. **Деловой стиль**: без юмора, сленга, восклицаний. Профессиональная лексика. Без местоимения "я".
5. **Краткость**: один пункт = одна мысль. Избегай "воды" и канцеляризмов.

## Данные кандидата

- Целевые должности: ${roles}
- Общий опыт: ${experience}
- Регион: ${region}
- Доступность по МСК: ${moscowHours}
- Формат: исключительно удалённая работа
- Опыт удалённой работы: ${quizData.remoteExperience === "some" ? "есть (начальный уровень)" : "нет"}
- Направления деятельности: ${activities}
- Типы организаций: ${orgTypes}
- Работа с документами: ${documentTypes}
- Программное обеспечение: ${programs}
- Профессиональные навыки: ${professionalSkills}
- График: ${schedules}
- Тип занятости: ${employmentTypes}
- Ожидания по доходу: ${salaryMin}
- Ограничения: ${restrictions}

## Сильные глаголы для достижений
Увеличил, сократил, оптимизировал, разработал, внедрил, автоматизировал, управлял, координировал, руководил, проанализировал, исследовал, выявил, обучил, организовал, контролировал, обеспечил.

## ВАЖНЫЕ ПРАВИЛА
- Используй ТОЛЬКО данные, предоставленные выше. НЕ выдумывай компании, даты, проекты или метрики.
- Если данных мало — напиши качественно то, что есть, и укажи в tips, что стоит дополнить.
- Формулируй опыт и навыки так, чтобы они звучали профессионально, но оставались правдивыми.
- Для российского рынка: используй формат дат мм.гггг, полные названия, деловой русский.
- ОБЯЗАТЕЛЬНО укажи в разделе «Условия работы» или «Профессиональный профиль» доступность кандидата по московскому времени: ${moscowHours}. Это критически важно для удалённой работы.
${atsInstruction}

## Формат ответа — СТРОГО JSON:
{
  "resumeText": "Полный текст резюме, готовый к использованию. Разделы разделены двойными переносами строк. Используй маркеры • для списков.",
  "sections": [
    {"title": "Название раздела", "content": "Содержимое раздела"}
  ],
  "tips": ["Совет по улучшению 1", "Совет по улучшению 2"]
}

Где:
- resumeText — полный текст резюме единым блоком
- sections — тот же текст, но разбитый по разделам (для интерфейса)
- tips — 2-5 конкретных рекомендаций, что кандидат может добавить или улучшить (например, "Добавьте конкретные KPI из опыта работы", "Укажите названия компаний и периоды работы")`;
}

export { aiRouter };
