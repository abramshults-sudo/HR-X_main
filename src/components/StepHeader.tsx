import { useState, useEffect } from "react";
import { quizSteps, stepHelpText } from "@/data/quizData";
import { ProgressBar } from "@/components/ProgressBar";
import { HelpCircle, X } from "lucide-react";

interface StepHeaderProps {
  step: number;
}

export const StepHeader = ({ step }: StepHeaderProps) => {
  const title = quizSteps[step - 1];
  const total = quizSteps.length;
  const helpText = stepHelpText[step];
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    setShowTip(false);
  }, [step]);

  return (
    <div className="sticky top-0 z-30 -mx-4 space-y-3 bg-background/95 px-4 pb-3 pt-3 backdrop-blur-sm md:-mx-0 md:px-0">
      <ProgressBar current={step} total={total} />
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground" data-testid="text-step-indicator">
          Шаг {step} из 6: {title}
        </p>
        {helpText && (
          <button
            type="button"
            onClick={() => setShowTip(!showTip)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            title="Зачем этот шаг?"
            data-testid="button-step-tooltip"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showTip && helpText && (
        <div className="flex items-start gap-2 rounded-card border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground animate-step-in">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="flex-1">{helpText}</p>
          <button type="button" onClick={() => setShowTip(false)} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
