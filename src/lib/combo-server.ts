import { prisma } from "@/lib/db";
import { updateComboCursorInMemory, setComboCursorPersistListener } from "@/lib/combo";

setComboCursorPersistListener((comboId, cursor) => {
  saveComboCursorAsync(comboId, cursor);
});

export async function loadComboCursor(comboId: string): Promise<number> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: `combo_cursor:${comboId}` } });
    if (s?.value) {
      const val = parseInt(s.value, 10);
      if (!isNaN(val)) {
        updateComboCursorInMemory(comboId, val);
        return val;
      }
    }
  } catch {}
  return 0;
}

export function saveComboCursorAsync(comboId: string, cursor: number) {
  prisma.setting.upsert({
    where: { key: `combo_cursor:${comboId}` },
    update: { value: String(cursor) },
    create: { key: `combo_cursor:${comboId}`, value: String(cursor) },
  }).catch(() => {});
}

export function resetComboRotationServer(comboId?: string) {
  if (comboId) {
    prisma.setting.delete({ where: { key: `combo_cursor:${comboId}` } }).catch(() => {});
  }
}
