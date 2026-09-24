import { StatusBadge, type Tone } from '../ui/Notice';
import type { SaveState } from '../lib/save-queue';
import { useCanvas } from './SessionContext';

const LABELS: Record<SaveState, { tone: Tone; text: string }> = {
  saved: { tone: 'success', text: 'Все изменения сохранены' },
  unsaved: { tone: 'warning', text: 'Есть несохранённые изменения' },
  saving: { tone: 'progress', text: 'Сохраняем…' },
  error: { tone: 'error', text: 'Не удалось сохранить' },
  conflict: { tone: 'error', text: 'Конфликт версий' },
};

export function SaveIndicator() {
  const state = useCanvas((canvas) => canvas.save.state);
  const { tone, text } = LABELS[state];
  return <StatusBadge tone={tone}>{text}</StatusBadge>;
}
