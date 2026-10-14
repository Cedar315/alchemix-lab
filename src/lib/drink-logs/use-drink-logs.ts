'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrinkLog } from '../../types';
import { DRINK_LOGS_CHANGED, fetchDrinkLogs, saveDrinkLog } from './client';

export function useDrinkLogs() {
  const [drinkLogs, setDrinkLogs] = useState<DrinkLog[]>([]);
  const version = useRef(0);
  const refresh = useCallback(() => {
    const request = ++version.current;
    fetchDrinkLogs().then(rows => { if (request === version.current) setDrinkLogs(rows); }).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(DRINK_LOGS_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => { version.current++; window.removeEventListener(DRINK_LOGS_CHANGED, refresh); window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); };
  }, [refresh]);
  const save = async (log: DrinkLog) => {
    const saved = await saveDrinkLog(log);
    version.current++;
    setDrinkLogs(rows => [saved, ...rows.filter(row => row.id !== log.id && row.id !== saved.id)]);
    return saved;
  };
  const clear = () => { version.current++; setDrinkLogs([]); };
  return { drinkLogs, refresh, save, clear };
}
