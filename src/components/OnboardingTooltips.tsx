import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface TooltipStep {
  targetSelector: string;
  text: string;
  position: "top" | "bottom";
}

const ONBOARDING_STEPS: TooltipStep[] = [
  {
    targetSelector: '[data-testid="tab-resume"]',
    text: "Здесь ваше резюме — сгенерированное ИИ или по шаблону. Можно скачать в PDF, DOCX или TXT.",
    position: "bottom",
  },
  {
    targetSelector: '[data-testid="tab-jobs"]',
    text: "Вакансии подобраны по вашему профилю. Нажмите «ИИ адаптация» — и резюме подстроится под конкретную вакансию.",
    position: "bottom",
  },
  {
    targetSelector: '[data-testid="tab-more"]',
    text: "Экспортируйте профиль и список вакансий на устройство, чтобы ничего не потерять.",
    position: "bottom",
  },
];

const STORAGE_KEY = "hrx_onboarding_shown";

export const OnboardingTooltips = () => {
  const [currentStep, setCurrentStep] = useState(-1);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {}

    const timer = setTimeout(() => {
      const el = document.querySelector(ONBOARDING_STEPS[0].targetSelector);
      if (el) {
        setCurrentStep(0);
        setTargetRect(el.getBoundingClientRect());
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentStep < 0 || currentStep >= ONBOARDING_STEPS.length) return;
    const step = ONBOARDING_STEPS[currentStep];
    const el = document.querySelector(step.targetSelector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    }
  }, [currentStep]);

  const dismiss = () => {
    setCurrentStep(-1);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  };

  const next = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      dismiss();
    }
  };

  if (currentStep < 0 || !targetRect) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const isBottom = step.position === "bottom";

  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - 150, window.innerWidth - 316)),
    ...(isBottom
      ? { top: targetRect.bottom + 12 }
      : { bottom: window.innerHeight - targetRect.top + 12 }),
    width: 300,
    zIndex: 9999,
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/30"
        onClick={dismiss}
      />
      <div
        style={tooltipStyle}
        className="rounded-xl border border-primary/30 bg-white p-4 shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-relaxed text-foreground">{step.text}</p>
          <button
            onClick={dismiss}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} / {ONBOARDING_STEPS.length}
          </span>
          <button
            onClick={next}
            className="min-h-[36px] rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            {currentStep < ONBOARDING_STEPS.length - 1 ? "Далее" : "Понятно"}
          </button>
        </div>
      </div>
    </>
  );
};
