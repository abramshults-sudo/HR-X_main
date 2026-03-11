import { useRef, useState, useCallback } from "react";
import { ExternalLink, MapPin, Briefcase, RussianRuble, Building2 } from "lucide-react";
import type { JobItem } from "@/types/hrx";
import { CompanyScoreBadge } from "@/components/CompanyScoreBadge";
import { StatusBadge } from "@/components/StatusBadge";

interface SwipeJobCardProps {
  job: JobItem;
  onSave: () => void;
  onArchive: () => void;
  isAnimating: boolean;
  animationDirection: "left" | "right" | null;
  showScoring?: boolean;
}

export const SwipeJobCard = ({ job, onSave, onArchive, isAnimating, animationDirection, showScoring = false }: SwipeJobCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ startX: 0, currentX: 0, isDragging: false });

  const offsetX = drag.isDragging ? drag.currentX - drag.startX : 0;
  const rotation = offsetX * 0.04;
  const opacity = Math.max(0.5, 1 - Math.abs(offsetX) / 400);
  const threshold = 80;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("a")) return;
    cardRef.current?.setPointerCapture(e.pointerId);
    setDrag({ startX: e.clientX, currentX: e.clientX, isDragging: true });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.isDragging) return;
    setDrag((prev) => ({ ...prev, currentX: e.clientX }));
  }, [drag.isDragging]);

  const handlePointerUp = useCallback(() => {
    if (!drag.isDragging) return;
    if (offsetX > threshold) {
      onSave();
    } else if (offsetX < -threshold) {
      onArchive();
    }
    setDrag({ startX: 0, currentX: 0, isDragging: false });
  }, [drag.isDragging, offsetX, onSave, onArchive]);

  const animClass = isAnimating
    ? animationDirection === "right"
      ? "translate-x-[120%] rotate-12 opacity-0"
      : "-translate-x-[120%] -rotate-12 opacity-0"
    : "";

  const showSaveHint = offsetX > 30;
  const showArchiveHint = offsetX < -30;

  return (
    <div
      ref={cardRef}
      className={`relative select-none touch-none rounded-2xl border border-border bg-card shadow-lg transition-transform ${isAnimating ? "duration-300 ease-out" : drag.isDragging ? "duration-0" : "duration-200"} ${animClass}`}
      style={
        !isAnimating
          ? {
              transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
              opacity,
            }
          : undefined
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-testid={`swipe-card-${job.id}`}
    >
      {showSaveHint && (
        <div className="absolute left-4 top-4 z-10 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-2 text-lg font-bold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" data-testid="hint-save">
          ОСТАВИТЬ ✓
        </div>
      )}
      {showArchiveHint && (
        <div className="absolute right-4 top-4 z-10 rounded-xl border-2 border-red-500 bg-red-50 px-4 py-2 text-lg font-bold text-red-600 dark:bg-red-950 dark:text-red-400" data-testid="hint-archive">
          В АРХИВ ✗
        </div>
      )}

      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold leading-tight line-clamp-2" data-testid={`text-swipe-title-${job.id}`}>{job.title}</h3>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              data-testid={`link-swipe-external-${job.id}`}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground line-clamp-1" data-testid={`text-swipe-company-${job.id}`}>{job.company}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5">
            <RussianRuble className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-semibold line-clamp-1" data-testid={`text-swipe-salary-${job.id}`}>{job.salary}</span>
          </div>
          {job.location && (
            <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm line-clamp-1">{job.location}</span>
            </div>
          )}
          {job.schedule && (
            <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5">
              <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm line-clamp-1">{job.schedule}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={job.status} />
          {showScoring && job.companyScore && <CompanyScoreBadge score={job.companyScore} />}
        </div>

        {job.description && (
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3" data-testid={`text-swipe-desc-${job.id}`}>
            {job.description}
          </p>
        )}

        {showScoring && job.companyScore && job.companyScore.flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.companyScore.flags.slice(0, 2).map((f, i) => (
              <span key={i} className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                ⚠ {f}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {job.source}
        </p>
      </div>
    </div>
  );
};
