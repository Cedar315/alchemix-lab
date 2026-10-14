import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDrinkLogs, saveDrinkLog, DRINK_LOGS_CHANGED } from './client';
import type { DrinkLog } from '../../types';
const draft = { id: 'drink-log-local', recipeName: '玛格丽特', drinkDate: '2026-10-14', isFinished: true } as DrinkLog;
test('create persists finished state and chosen date, returning server ID and refreshing readers', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const target = new EventTarget(); let changed = 0;
  target.addEventListener(DRINK_LOGS_CHANGED, () => changed++);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ drink_log: { ...draft, id: '42' } }); };
  try {
    const saved = await saveDrinkLog(draft);
    assert.equal(saved.id, '42'); assert.equal(changed, 1);
    assert.equal(calls[0].url, '/api/drink-logs'); assert.equal(calls[0].init?.method, 'POST');
    const body = JSON.parse(String(calls[0].init?.body)); assert.equal(body.drink_date, draft.drinkDate); assert.equal(body.isFinished, true);
    await saveDrinkLog(saved); assert.equal(calls[1].url, '/api/drink-logs/42'); assert.equal(calls[1].init?.method, 'PATCH');
    for (const status of [401, 500]) {
      globalThis.fetch = async () => new Response('{}', { status });
      await assert.rejects(saveDrinkLog(draft), status === 401 ? /请先登录/ : /保存失败/);
    }
    assert.equal(changed, 2, 'failed saves must not notify success');
    globalThis.fetch = async () => Response.json({});
    await assert.rejects(saveDrinkLog(draft), /未收到保存确认/);
    await assert.rejects(fetchDrinkLogs(), /数据不完整/);
    globalThis.fetch = async () => Response.json({ drink_logs: [{ ...draft, id: '42' }] });
    assert.equal((await fetchDrinkLogs())[0].id, '42');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
