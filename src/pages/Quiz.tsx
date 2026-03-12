import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { OptionCard } from "@/components/OptionCard";
import { SectionCard } from "@/components/SectionCard";
import { StickyQuizNav } from "@/components/StickyQuizNav";
import { StepHeader } from "@/components/StepHeader";
import { RegionPickerModal } from "@/components/RegionPickerModal";
import { AssistantHelpModal } from "@/components/AssistantHelpModal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { regionCatalog } from "@/data/regions";
import {
  activityGroups,
  documentTypes,
  employmentOptions,
  experienceOptions,
  experiencedActivityGroups,
  experiencedRoleGroups,
  experiencedSkillGroups,
  experiencedSoftwareGroups,
  organizationTypes,
  professionalSkillGroups,
  quickExclusionOptions,
  quizSteps,
  restrictionOptions,
  salaryOptions,
  scheduleOptions,
  softwareSkillGroups,
  stepHelpText,
  targetRoleGroups,
} from "@/data/quizData";
import { useHrxState } from "@/context/hrx-state";

const times = Array.from({ length: 25 }, (_, index) => `${String(index).padStart(2, "0")}:00`);

const toLocalHour = (moscowHour: string, offset: number) => {
  const hour = Number.parseInt(moscowHour.split(":")[0], 10);
  const localHour = (hour + offset + 24) % 24;
  return `${String(localHour).padStart(2, "0")}:00`;
};

const toMoscowHour = (localHour: string, offset: number) => {
  const hour = Number.parseInt(localHour.split(":")[0], 10);
  const mskHour = (hour - offset + 24) % 24;
  return `${String(mskHour).padStart(2, "0")}:00`;
};

const Quiz = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useHrxState();
  const { quizState } = state;
  const isExperienced = quizState.remoteExperience === "some";
  const [activeGroup, setActiveGroup] = useState<string>(targetRoleGroups[0].group);

  const allRoleGroups = useMemo(() =>
    isExperienced ? [...targetRoleGroups, ...experiencedRoleGroups] : targetRoleGroups,
  [isExperienced]);
  const allActivityGroups = useMemo(() =>
    isExperienced ? [...activityGroups, ...experiencedActivityGroups] : activityGroups,
  [isExperienced]);
  const allSoftwareGroups = useMemo(() =>
    isExperienced ? [...softwareSkillGroups, ...experiencedSoftwareGroups] : softwareSkillGroups,
  [isExperienced]);
  const allSkillGroups = useMemo(() =>
    isExperienced ? [...professionalSkillGroups, ...experiencedSkillGroups] : professionalSkillGroups,
  [isExperienced]);

  const isLastStep = quizState.currentStep === 6;
  const canGoNext = quizState.currentStep !== 1 || Boolean(quizState.region);

  const localFrom = useMemo(() => {
    if (!quizState.region) return quizState.moscowHours.from;
    return toLocalHour(quizState.moscowHours.from, quizState.region.timezoneOffset);
  }, [quizState.region, quizState.moscowHours.from]);

  const localTo = useMemo(() => {
    if (!quizState.region) return quizState.moscowHours.to;
    return toLocalHour(quizState.moscowHours.to, quizState.region.timezoneOffset);
  }, [quizState.region, quizState.moscowHours.to]);

  const moscowHoursHint = useMemo(() => {
    if (!quizState.region || quizState.region.timezoneOffset === 0) return "";
    return `По Москве: ${quizState.moscowHours.from}–${quizState.moscowHours.to}`;
  }, [quizState.region, quizState.moscowHours]);

  const goNext = () => {
    if (isLastStep) {
      dispatch({ type: "SET_PROFILE_READY", payload: true });
      navigate("/results");
      return;
    }

    dispatch({ type: "SET_STEP", payload: (quizState.currentStep + 1) as typeof quizState.currentStep });
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (quizState.currentStep === 1) {
      dispatch({ type: "SET_REMOTE_EXPERIENCE", payload: "" });
      window.scrollTo(0, 0);
      return;
    }
    dispatch({ type: "SET_STEP", payload: (quizState.currentStep - 1) as typeof quizState.currentStep });
    window.scrollTo(0, 0);
  };

  if (!quizState.remoteExperience) {
    return (
      <AppLayout>
        <div className="space-y-6 pb-36 md:space-y-8 md:pb-8">
          <div className="animate-step-in">
            <SectionCard title="Ваш опыт удалённой работы">
              <p className="text-sm text-muted-foreground">
                Это поможет подобрать подходящие вопросы и варианты. Выберите то, что ближе к вашей ситуации.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SET_REMOTE_EXPERIENCE", payload: "none" })}
                  className="flex flex-col items-start gap-2 rounded-card border-2 border-border bg-card p-5 text-left transition-colors hover:border-primary/50"
                  data-testid="button-experience-none"
                >
                  <span className="text-2xl">🌱</span>
                  <span className="text-lg font-bold">Нет опыта удалёнки</span>
                  <span className="text-sm text-muted-foreground">
                    Никогда не работал(а) удалённо или только начинаю разбираться
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SET_REMOTE_EXPERIENCE", payload: "some" })}
                  className="flex flex-col items-start gap-2 rounded-card border-2 border-border bg-card p-5 text-left transition-colors hover:border-primary/50"
                  data-testid="button-experience-some"
                >
                  <span className="text-2xl">💼</span>
                  <span className="text-lg font-bold">Уже работал(а) удалённо</span>
                  <span className="text-sm text-muted-foreground">
                    Есть опыт удалённой работы — пусть даже небольшой или на простых задачах
                  </span>
                </button>
              </div>
            </SectionCard>
          </div>
        </div>

        <StickyQuizNav
          onBack={() => navigate("/")}
          onHint={() => {}}
          onNext={() => {}}
          disableBack={false}
          disableNext={true}
          nextLabel="Дальше"
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 pb-36 md:space-y-8 md:pb-8">
        <StepHeader step={quizState.currentStep} />

        <div key={quizState.currentStep} className="animate-step-in">
        {quizState.currentStep === 1 ? (
          <SectionCard title={quizSteps[0]}>
            <Button variant="outline" className="w-full justify-between" onClick={() => dispatch({ type: "SET_REGION_PICKER_OPEN", payload: true })}>
              <span>{quizState.region?.name ?? "Выберите регион"}</span>
              <span className="text-muted-foreground">{quizState.region ? `МСК${quizState.region.timezoneOffset >= 0 ? `+${quizState.region.timezoneOffset}` : quizState.region.timezoneOffset}` : ""}</span>
            </Button>

            <p className="text-[17px] font-bold">В какие часы по вашему местному времени вы готовы работать?</p>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={localFrom}
                onChange={(event) => {
                  const offset = quizState.region?.timezoneOffset ?? 0;
                  dispatch({ type: "SET_MOSCOW_HOURS", payload: { ...quizState.moscowHours, from: toMoscowHour(event.target.value, offset) } });
                }}
                className="min-h-[56px] rounded-button border border-input bg-card px-4 text-foreground"
              >
                {times.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              <select
                value={localTo}
                onChange={(event) => {
                  const offset = quizState.region?.timezoneOffset ?? 0;
                  dispatch({ type: "SET_MOSCOW_HOURS", payload: { ...quizState.moscowHours, to: toMoscowHour(event.target.value, offset) } });
                }}
                className="min-h-[56px] rounded-button border border-input bg-card px-4 text-foreground"
              >
                {times.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            {moscowHoursHint && <p className="text-sm text-muted-foreground">{moscowHoursHint}</p>}
          </SectionCard>
        ) : null}

        {quizState.currentStep === 2 ? (
          <SectionCard title={quizSteps[1]}>
            <Accordion type="single" collapsible value={activeGroup} onValueChange={(value) => value && setActiveGroup(value)}>
              {allRoleGroups.map((group) => {
                const selectedInGroup = group.roles.filter((role) => quizState.targetRoles.includes(role.title)).length;
                return (
                  <AccordionItem key={group.group} value={group.group}>
                    <AccordionTrigger className="text-base no-underline hover:no-underline">
                      <span className="flex-1 text-left">{group.group}</span>
                      <span className="mr-3 rounded-full border border-border px-2 py-0.5 text-sm text-muted-foreground">{selectedInGroup}</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      {group.roles.map((role) => (
                        <OptionCard
                          key={role.title}
                          title={role.title}
                          selected={quizState.targetRoles.includes(role.title)}
                          onClick={() => dispatch({ type: "TOGGLE_TARGET_ROLE", payload: role.title })}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            <div className="space-y-2">
              <span className="text-[17px] font-bold">Быстрые исключения</span>
              <p className="text-sm text-muted-foreground">Отметьте, если хотите исключить из поиска:</p>
              {quickExclusionOptions.map((opt) => (
                <OptionCard
                  key={opt}
                  title={opt}
                  selected={quizState.excludedRoleQuick.includes(opt)}
                  onClick={() => dispatch({ type: "TOGGLE_EXCLUDED_ROLE_QUICK", payload: opt })}
                  data-testid={`option-excl-${opt}`}
                />
              ))}
            </div>

            <label className="space-y-2">
              <span className="text-[17px] font-bold">Есть должности, на которые вы точно НЕ хотите?</span>
              <textarea
                value={quizState.excludedRoles}
                onChange={(event) => dispatch({ type: "SET_EXCLUDED_ROLE", payload: event.target.value })}
                placeholder="Например: холодные продажи, ночная поддержка"
                className="min-h-[96px] w-full rounded-card border border-input bg-card p-4"
              />
            </label>

            <div className="space-y-2">
              <span className="text-[17px] font-bold">Готовы рассмотреть смежные роли?</span>
              {["Да, если задачи похожи", "Да, но только в моём направлении", "Нет, только выбранные роли"].map((opt) => (
                <OptionCard
                  key={opt}
                  title={opt}
                  selected={quizState.considerAdjacentRoles === opt}
                  onClick={() => dispatch({ type: "SET_CONSIDER_ADJACENT", payload: opt })}
                  data-testid={`option-adjacent-${opt}`}
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {quizState.currentStep === 3 ? (
          <SectionCard title={quizSteps[2]}>
            <div className="space-y-2">
              <p className="text-[17px] font-bold">В каких организациях вы работали?</p>
              <div className="space-y-2">
                {organizationTypes.map((option) => (
                  <OptionCard
                    key={option}
                    title={option}
                    selected={quizState.organizationTypes.includes(option)}
                    onClick={() => dispatch({ type: "TOGGLE_ORGANIZATION_TYPE", payload: option })}
                  />
                ))}
              </div>
            </div>

            <label className="space-y-2">
              <span className="text-[17px] font-bold">Какой у вас общий стаж?</span>
              <select
                value={quizState.totalExperience}
                onChange={(event) => dispatch({ type: "SET_TOTAL_EXPERIENCE", payload: event.target.value })}
                className="min-h-[56px] w-full rounded-button border border-input bg-card px-4"
              >
                <option value="">Выберите стаж</option>
                {experienceOptions.map((opt) => (
                  <option key={opt.label} value={opt.label}>{opt.label}</option>
                ))}
              </select>
            </label>

            <p className="text-[17px] font-bold pt-2">С какими задачами вы знакомы?</p>
            <Accordion type="multiple" className="space-y-2">
              {allActivityGroups.map((group) => (
                <AccordionItem key={group.group} value={group.group} className="rounded-card border border-border px-4">
                  <AccordionTrigger className="text-base no-underline hover:no-underline">
                    <span className="flex-1 text-left">{group.group}</span>
                    <span className="mr-3 rounded-full border border-border px-2 py-0.5 text-sm text-muted-foreground">
                      {group.items.filter(i => quizState.activities.includes(i)).length}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {group.items.map((option) => (
                      <OptionCard
                        key={option}
                        title={option}
                        selected={quizState.activities.includes(option)}
                        onClick={() => dispatch({ type: "TOGGLE_ACTIVITY", payload: option })}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
              <AccordionItem value="docs" className="rounded-card border border-border px-4">
                <AccordionTrigger className="text-base no-underline hover:no-underline">
                  <span className="flex-1 text-left">С какими документами работали</span>
                  <span className="mr-3 rounded-full border border-border px-2 py-0.5 text-sm text-muted-foreground">
                    {quizState.documentTypes.length}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {documentTypes.map((option) => (
                    <OptionCard
                      key={option}
                      title={option}
                      selected={quizState.documentTypes.includes(option)}
                      onClick={() => dispatch({ type: "TOGGLE_DOCUMENT", payload: option })}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </SectionCard>
        ) : null}

        {quizState.currentStep === 4 ? (
          <SectionCard title={quizSteps[3]}>
            <div className="space-y-3">
              <p className="text-[17px] font-bold">Программы и уровень</p>
              <p className="text-sm text-muted-foreground">Откройте нужную категорию и выберите уровень для каждой программы.</p>
              <Accordion type="multiple" className="space-y-2">
                {allSoftwareGroups.map((group) => {
                  const filledCount = group.items.filter(p => quizState.programLevels[p] && quizState.programLevels[p] !== "none").length;
                  return (
                    <AccordionItem key={group.group} value={group.group} className="rounded-card border border-border px-4">
                      <AccordionTrigger className="text-base no-underline hover:no-underline">
                        <span className="flex-1 text-left">{group.group}</span>
                        <span className="mr-3 rounded-full border border-border px-2 py-0.5 text-sm text-muted-foreground">{filledCount}</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        {group.items.map((program) => (
                          <div key={program} className="space-y-2">
                            <p className="text-sm font-semibold">{program}</p>
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                              {(["none", "basic", "confident", "advanced"] as const).map((level) => (
                                <button
                                  type="button"
                                  key={level}
                                  onClick={() => dispatch({ type: "SET_PROGRAM_LEVEL", payload: { program, level } })}
                                  className={`min-h-[44px] rounded-button border px-3 text-sm ${
                                    quizState.programLevels[program] === level
                                      ? "border-2 border-primary bg-primary/10"
                                      : "border-border bg-card"
                                  }`}
                                  data-testid={`button-level-${program}-${level}`}
                                >
                                  {level === "none" ? "—" : level === "basic" ? "Базовый" : level === "confident" ? "Уверенный" : "Продвинутый"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            <div className="space-y-3">
              <p className="text-[17px] font-bold">Профессиональные навыки</p>
              <Accordion type="multiple" className="space-y-2">
                {allSkillGroups.map((group) => {
                  const selectedCount = group.items.filter(s => quizState.professionalSkills.includes(s)).length;
                  return (
                    <AccordionItem key={group.group} value={group.group} className="rounded-card border border-border px-4">
                      <AccordionTrigger className="text-base no-underline hover:no-underline">
                        <span className="flex-1 text-left">{group.group}</span>
                        <span className="mr-3 rounded-full border border-border px-2 py-0.5 text-sm text-muted-foreground">{selectedCount}</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        {group.items.map((skill) => (
                          <OptionCard
                            key={skill}
                            title={skill}
                            selected={quizState.professionalSkills.includes(skill)}
                            onClick={() => dispatch({ type: "TOGGLE_PRO_SKILL", payload: skill })}
                          />
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </SectionCard>
        ) : null}

        {quizState.currentStep === 5 ? (
          <SectionCard title={quizSteps[4]}>
            <div className="space-y-2">
              <p className="text-[17px] font-bold">График дней</p>
              {scheduleOptions.map((option) => (
                <OptionCard
                  key={option.label}
                  title={option.label}
                  selected={quizState.schedules.includes(option.label)}
                  onClick={() => dispatch({ type: "TOGGLE_SCHEDULE", payload: option.label })}
                />
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[17px] font-bold">Тип занятости</p>
              {employmentOptions.map((option) => (
                <OptionCard
                  key={option.label}
                  title={option.label}
                  selected={quizState.employmentTypes.includes(option.label)}
                  onClick={() => dispatch({ type: "TOGGLE_EMPLOYMENT_TYPE", payload: option.label })}
                />
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[17px] font-bold">Минимальная зарплата</p>
              <p className="text-sm text-muted-foreground">Выберите одно значение — вакансии ниже этой суммы не будут показаны.</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {salaryOptions.map((option) => (
                  <button
                    type="button"
                    key={option.label}
                    onClick={() => dispatch({ type: "SET_SALARY_MIN", payload: option.label })}
                    className={`min-h-[48px] rounded-button border px-3 text-sm ${
                      quizState.salaryMin === option.label
                        ? "border-2 border-primary bg-primary/10 font-semibold"
                        : "border-border bg-card"
                    }`}
                    data-testid={`button-salary-${option.value}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-card border border-border bg-card p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quizState.acceptHandicapped}
                  onChange={(e) => dispatch({ type: "SET_ACCEPT_HANDICAPPED", payload: e.target.checked })}
                  className="h-5 w-5 shrink-0 accent-primary"
                  data-testid="checkbox-accept-handicapped"
                />
                <div>
                  <p className="text-[17px] font-bold">Доступно для людей с инвалидностью</p>
                  <p className="text-sm text-muted-foreground">Показывать только вакансии, которые работодатель отметил как подходящие</p>
                </div>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-[17px] font-bold">Что вам точно НЕ подходит?</p>
              {restrictionOptions.map((option) => (
                <OptionCard
                  key={option.label}
                  title={option.label}
                  selected={quizState.restrictions.includes(option.label)}
                  onClick={() => dispatch({ type: "TOGGLE_RESTRICTION", payload: option.label })}
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {quizState.currentStep === 6 ? (
          <SectionCard title={quizSteps[5]}>
            <div className="space-y-3">
              <SummaryBlock
                title="Уровень"
                value={isExperienced ? "Есть опыт удалёнки" : "Без опыта удалёнки"}
                onEdit={() => dispatch({ type: "SET_REMOTE_EXPERIENCE", payload: "" })}
              />
              <SummaryBlock title="Локация" value={`${quizState.region?.name ?? "Не выбрано"} · ${quizState.moscowHours.from}–${quizState.moscowHours.to} МСК`} onEdit={() => dispatch({ type: "SET_STEP", payload: 1 })} />
              <SummaryBlock title="Целевые роли" value={quizState.targetRoles.join(", ") || "Пока не выбрано"} onEdit={() => dispatch({ type: "SET_STEP", payload: 2 })} />
              <SummaryBlock title="Опыт" value={quizState.totalExperience || "Пока не заполнено"} onEdit={() => dispatch({ type: "SET_STEP", payload: 3 })} />
              <SummaryBlock title="Навыки" value={quizState.professionalSkills.slice(0, 3).join(", ") || "Пока не выбрано"} onEdit={() => dispatch({ type: "SET_STEP", payload: 4 })} />
              <SummaryBlock
                title="Условия"
                value={[...quizState.schedules, ...quizState.employmentTypes, quizState.salaryMin].filter(Boolean).join(", ") || "Пока не выбрано"}
                onEdit={() => dispatch({ type: "SET_STEP", payload: 5 })}
              />
            </div>

            <div className="rounded-card border border-border bg-secondary p-4 space-y-2">
              <p className="text-[17px] font-bold">Как мы будем искать</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Источники: hh.ru, Работа России</li>
                <li>Роли: {quizState.targetRoles.slice(0, 5).join(", ") || "не выбраны"}</li>
                <li>Мин. зарплата: {quizState.salaryMin || "не указана"}</li>
                {quizState.region ? (
                  <li>Часовой пояс: МСК{quizState.region.timezoneOffset >= 0 ? `+${quizState.region.timezoneOffset}` : quizState.region.timezoneOffset}</li>
                ) : null}
                {quizState.restrictions.length > 0 ? (
                  <li>Ограничения: {quizState.restrictions.slice(0, 3).join(", ")}</li>
                ) : null}
                {quizState.excludedRoleQuick.length > 0 ? (
                  <li>Исключено: {quizState.excludedRoleQuick.slice(0, 3).join(", ")}</li>
                ) : null}
                {quizState.excludedRoles.trim() ? (
                  <li>Свои исключения: {quizState.excludedRoles.trim().slice(0, 60)}{quizState.excludedRoles.trim().length > 60 ? "…" : ""}</li>
                ) : null}
                {quizState.acceptHandicapped ? (
                  <li>Фильтр: доступно для людей с инвалидностью</li>
                ) : null}
              </ul>
            </div>

            {quizState.targetRoles.length < 2 ? (
              <div className="rounded-card border border-warning/40 bg-accent/20 p-4 text-sm">
                Пока мало данных: добавьте больше целевых ролей для точной подборки вакансий.
              </div>
            ) : null}

          </SectionCard>
        ) : null}
        </div>
      </div>

      <RegionPickerModal
        open={state.uiState.isRegionPickerOpen}
        regions={regionCatalog}
        selectedRegion={quizState.region}
        onClose={() => dispatch({ type: "SET_REGION_PICKER_OPEN", payload: false })}
        onConfirm={(region) => {
          dispatch({ type: "SET_REGION", payload: region });
          dispatch({ type: "SET_REGION_PICKER_OPEN", payload: false });
        }}
      />

      <AssistantHelpModal
        open={state.uiState.isAssistantOpen}
        onClose={() => dispatch({ type: "SET_ASSISTANT_OPEN", payload: false })}
        text={stepHelpText[quizState.currentStep]}
      />

      <StickyQuizNav
        onBack={goBack}
        onHint={() => dispatch({ type: "SET_ASSISTANT_OPEN", payload: true })}
        onNext={goNext}
        disableBack={false}
        disableNext={!canGoNext}
        nextLabel={isLastStep ? "Подтвердить" : "Дальше"}
      />
    </AppLayout>
  );
};

const SummaryBlock = ({ title, value, onEdit }: { title: string; value: string; onEdit: () => void }) => (
  <div className="rounded-card border border-border bg-card p-4">
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="font-semibold">{title}</p>
      <button type="button" onClick={onEdit} className="text-sm font-semibold text-primary">
        Изменить
      </button>
    </div>
    <p className="text-sm text-muted-foreground">{value}</p>
  </div>
);

export default Quiz;
