import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { usePresets } from "@/hooks/use-presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, FolderOpen, Trash2, Loader2 } from "lucide-react";

export const PresetManager = () => {
  const { user } = useAuth();
  const { presets, isLoading, isSaving, applyPreset, savePreset, deletePreset } = usePresets();
  const [presetName, setPresetName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const handleSave = async () => {
    const ok = await savePreset(presetName);
    if (ok) {
      setPresetName("");
      setShowSave(false);
    }
  };

  if (!user) return null;

  return (
    <div className="rounded-card border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-bold">Сохранённые настройки</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSave(!showSave)}
          data-testid="button-toggle-save-preset"
        >
          <Save className="mr-1 h-4 w-4" />
          Сохранить текущий
        </Button>
      </div>

      {showSave && (
        <div className="flex gap-2">
          <Input
            placeholder="Название настройки"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            data-testid="input-preset-name"
          />
          <Button onClick={handleSave} disabled={isSaving || !presetName.trim()} data-testid="button-save-preset">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : presets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Пока нет сохранённых настроек. Заполните квиз и нажмите «Сохранить текущий».
        </p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
              data-testid={`preset-item-${preset.id}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{preset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(preset.createdAt).toLocaleDateString("ru-RU")}
                  {preset.filters && (
                    <span className="ml-1 text-muted-foreground/70">
                      {[
                        preset.filters.resumeMode === "ats" ? "для работодателя" : null,
                        preset.filters.showScoring ? "скоринг" : null,
                        preset.filters.dateFilter && preset.filters.dateFilter !== "all" ? `${preset.filters.dateFilter}д` : null,
                      ].filter(Boolean).join(", ") || null}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  data-testid={`button-load-preset-${preset.id}`}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deletePreset(preset)}
                  data-testid={`button-delete-preset-${preset.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
