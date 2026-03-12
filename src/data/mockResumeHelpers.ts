import type { QuizState } from "@/types/hrx";

export const mockResumePreview = `
Профессиональный профиль
Организованный специалист с опытом удалённой административной и документной работы.
Уверенно выстраиваю процессы, контролирую сроки и поддерживаю порядок в документах.

Ключевые навыки
• Документооборот и ведение реестров
• Деловая переписка и коммуникация с командами
• Работа с Excel, CRM и электронным документооборотом
`;

export const buildProfileSummary = (quizState: QuizState): string[] => {
  const roles = quizState.targetRoles.slice(0, 3).join(", ") || "административные роли";
  const focus = quizState.activities.slice(0, 2).join(", ") || "поддержка процессов";

  return [
    `Вы ориентированы на удалённую работу в направлении: ${roles}. Готовность по Москве: ${quizState.moscowHours.from}–${quizState.moscowHours.to}.`,
    `Сильный фокус: ${focus}. Опыт по документам: ${quizState.documentTypes.slice(0, 3).join(", ") || "уточняется"}.`,
    `Рабочие условия: ${[...quizState.schedules, ...quizState.employmentTypes].join(", ") || "уточняются"}; желаемый доход: ${quizState.salaryMin || "уточняется"}.`,
  ];
};

function experienceDescription(exp: string): string {
  if (exp === "Нет опыта") return "начинающий специалист (без опыта)";
  if (exp === "От 1 до 3 лет") return "специалист с опытом от 1 до 3 лет";
  if (exp === "От 3 до 6 лет") return "опытный специалист со стажем от 3 до 6 лет";
  if (exp === "Более 6 лет") return "эксперт с многолетним опытом (более 6 лет)";
  return "";
}

function programLevelLabel(level: string): string {
  if (level === "advanced") return "продвинутый уровень";
  if (level === "confident") return "уверенный пользователь";
  if (level === "basic") return "базовый уровень";
  return "";
}

export const buildResumeText = (quizState: QuizState, mode: "regular" | "ats"): string => {
  const sections: string[] = [];

  const regionName = quizState.region?.name ?? "не указан";
  const expDesc = experienceDescription(quizState.totalExperience);
  const rolesText = quizState.targetRoles.join(", ");

  let profileText = "ПРОФЕССИОНАЛЬНЫЙ ПРОФИЛЬ\n\n";
  if (rolesText && expDesc) {
    profileText += `${expDesc.charAt(0).toUpperCase() + expDesc.slice(1)} в области: ${rolesText}. `;
  } else if (rolesText) {
    profileText += `Специалист в области: ${rolesText}. `;
  } else {
    profileText += "Специалист, ориентированный на удалённую работу. ";
  }
  profileText += `Формат работы: исключительно удалённая занятость. Регион: ${regionName}. `;
  profileText += `Доступность по московскому времени: ${quizState.moscowHours.from}–${quizState.moscowHours.to}.`;
  if (quizState.remoteExperience === "some") {
    profileText += `\nИмеется опыт удалённой работы.`;
  }

  if (quizState.activities.length > 0) {
    profileText += `\nОсновные направления деятельности: ${quizState.activities.join(", ").toLowerCase()}.`;
  }

  if (quizState.organizationTypes.length > 0) {
    profileText += `\nОпыт работы в организациях: ${quizState.organizationTypes.join(", ").toLowerCase()}.`;
  }

  sections.push(profileText);

  if (quizState.activities.length > 0 || quizState.documentTypes.length > 0) {
    let expSection = "ОПЫТ И КОМПЕТЕНЦИИ\n";
    if (expDesc) {
      expSection += `\nОбщий стаж: ${quizState.totalExperience}.`;
    }
    if (quizState.activities.length > 0) {
      expSection += "\n\nОсновные задачи:";
      quizState.activities.forEach(a => { expSection += `\n• ${a}`; });
    }
    if (quizState.documentTypes.length > 0) {
      expSection += "\n\nРабота с документами:";
      quizState.documentTypes.forEach(d => { expSection += `\n• ${d}`; });
    }
    sections.push(expSection);
  }

  const programEntries = Object.entries(quizState.programLevels).filter(
    ([, level]) => level !== "none"
  );
  const hasSkills = programEntries.length > 0 || quizState.professionalSkills.length > 0;

  if (hasSkills) {
    let skillsSection = "НАВЫКИ\n";

    if (programEntries.length > 0) {
      skillsSection += "\nПрограммное обеспечение:";
      programEntries.forEach(([prog, level]) => {
        skillsSection += `\n• ${prog} — ${programLevelLabel(level)}`;
      });
    }

    if (quizState.professionalSkills.length > 0) {
      skillsSection += "\n\nПрофессиональные навыки:";
      quizState.professionalSkills.forEach(s => { skillsSection += `\n• ${s}`; });
    }
    sections.push(skillsSection);
  }

  let conditionsSection = "УСЛОВИЯ РАБОТЫ\n";
  conditionsSection += "\n• Формат: только удалённая работа";

  if (quizState.schedules.length > 0) {
    conditionsSection += `\n• График: ${quizState.schedules.join(", ")}`;
  }
  if (quizState.employmentTypes.length > 0) {
    conditionsSection += `\n• Занятость: ${quizState.employmentTypes.join(", ")}`;
  }
  if (quizState.salaryMin) {
    conditionsSection += `\n• Ожидания по доходу: ${quizState.salaryMin}`;
  }
  if (quizState.restrictions.length > 0) {
    conditionsSection += `\n• Ограничения: ${quizState.restrictions.join(", ").toLowerCase()}`;
  }
  sections.push(conditionsSection);

  if (mode === "ats") {
    const atsKeywords = buildAtsKeywords(quizState);
    let atsSection = "КЛЮЧЕВЫЕ СЛОВА (ATS)\n";
    atsSection += `\n${atsKeywords.join(", ")}`;
    sections.push(atsSection);
  }

  return sections.join("\n\n───────────────────────────────\n\n");
};

function buildAtsKeywords(quizState: QuizState): string[] {
  const keywords = new Set<string>();

  keywords.add("удалённая работа");
  keywords.add("remote");

  quizState.targetRoles.forEach(r => keywords.add(r.toLowerCase()));

  quizState.activities.forEach(a => keywords.add(a.toLowerCase()));
  quizState.documentTypes.forEach(d => keywords.add(d.toLowerCase()));

  Object.entries(quizState.programLevels).forEach(([prog, level]) => {
    if (level !== "none") keywords.add(prog);
  });

  quizState.professionalSkills.forEach(s => keywords.add(s.toLowerCase()));

  return Array.from(keywords);
}

export const buildAtsKeywordReport = (quizState: QuizState) => {
  const included = buildAtsKeywords(quizState);

  const missing: string[] = [];
  if (quizState.targetRoles.length === 0) missing.push("названия целевых ролей");
  if (quizState.activities.length === 0) missing.push("описание основных задач");
  if (quizState.professionalSkills.length === 0) missing.push("профессиональные навыки");
  if (Object.values(quizState.programLevels).every(l => l === "none")) missing.push("программное обеспечение");
  missing.push("конкретные достижения и KPI-результаты");
  missing.push("названия компаний-работодателей");

  return { included, missing };
};
