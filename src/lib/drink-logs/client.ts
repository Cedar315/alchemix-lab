import type { DrinkLog } from '../../types';

export const DRINK_LOGS_CHANGED = 'alchemix-drink-logs-changed';
export async function fetchDrinkLogs(): Promise<DrinkLog[]> {
  const response = await fetch('/api/drink-logs', { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 ? '请先登录再查看酒记' : '酒记读取失败，请重试');
  const data = await response.json();
  if (!Array.isArray(data.drink_logs)) throw new Error('酒记数据不完整，请重试');
  return data.drink_logs;
}
export async function saveDrinkLog(log: DrinkLog): Promise<DrinkLog> {
  const editing = /^\d+$/.test(log.id);
  const response = await fetch(editing ? `/api/drink-logs/${log.id}` : '/api/drink-logs', {
    method: editing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...log, drink_date: log.drinkDate }),
  });
  if (!response.ok) throw new Error(response.status === 401 ? '请先登录，再保存酒记。当前填写内容已保留。' : '酒记保存失败，请重试。当前填写内容已保留。');
  const data = await response.json();
  if (!data.drink_log?.id) throw new Error('未收到保存确认，请检查酒单后重试');
  window.dispatchEvent(new Event(DRINK_LOGS_CHANGED));
  return data.drink_log;
}
