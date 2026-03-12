import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { usePresets } from "@/hooks/use-presets";
import { FolderOpen, Trash2, Bookmark } from "lucide-react";

export const HomePresets = () => {
  const { user } = useAuth();
  const { presets, isLoading, applyPreset, deletePreset } = usePresets();
  const navigate = useNavigate();

  const handleLoad = (preset: Parameters<typeof applyPreset>[0]) => {
    applyPreset(preset, 6);
    navigate("/quiz");
  };

  const handleDelete = (preset: Parameters<typeof deletePreset>[0], e: React.MouseEvent) => {
    e.stopPropagation();
    deletePreset(preset);
  };

  if (!user || isLoading || presets.length === 0) return null;

  return (
    <div className="w-full space-y-2 text-left">
      <div className="flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Мои сохранённые настройки</p>
      </div>
      <div className="space-y-1.5">
        {presets.map((preset) => (
          <div
            key={preset.id}
            role="button"
            tabIndex={0}
            onClick={() => handleLoad(preset)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad(preset)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FolderOpen className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{preset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(preset.createdAt).toLocaleDateString("ru-RU")}
                  {preset.quizState.targetRoles?.length > 0 && (
                    <span className="ml-1">
                      — {preset.quizState.targetRoles.slice(0, 2).join(", ")}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors"
              onClick={(e) => handleDelete(preset, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  deletePreset(preset);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
