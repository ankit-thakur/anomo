import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'anomo_analysis_queue';

export interface QueueItem {
  placeId: string;
  name: string;
  address: string;
  submittedAt: string;
  status: 'analyzing' | 'complete';
}

// Standalone helper — callable outside React (e.g. from the notification handler in _layout.tsx)
export async function markQueueItemComplete(placeId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const current: QueueItem[] = raw ? JSON.parse(raw) : [];
    const next = current.map(i =>
      i.placeId === placeId ? { ...i, status: 'complete' as const } : i
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  } catch {
    // non-fatal
  }
}

export function useAnalysisQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      setQueue(raw ? JSON.parse(raw) : []);
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (items: QueueItem[]) => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    setQueue(items);
  };

  const enqueue = useCallback(async (placeId: string, name: string, address: string) => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const current: QueueItem[] = raw ? JSON.parse(raw) : [];
    const existing = current.find(i => i.placeId === placeId);
    if (existing) {
      // Re-submission: reset to analyzing with fresh timestamp
      const next = current.map(i =>
        i.placeId === placeId
          ? { ...i, status: 'analyzing' as const, submittedAt: new Date().toISOString() }
          : i
      );
      await persist(next);
      return;
    }
    const newItem: QueueItem = {
      placeId,
      name,
      address,
      submittedAt: new Date().toISOString(),
      status: 'analyzing',
    };
    await persist([newItem, ...current]);
  }, []);

  const markComplete = useCallback(async (placeId: string) => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const current: QueueItem[] = raw ? JSON.parse(raw) : [];
    const next = current.map(i =>
      i.placeId === placeId ? { ...i, status: 'complete' as const } : i
    );
    await persist(next);
  }, []);

  const dismiss = useCallback(async (placeId: string) => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const current: QueueItem[] = raw ? JSON.parse(raw) : [];
    await persist(current.filter(i => i.placeId !== placeId));
  }, []);

  const analyzingCount = queue.filter(i => i.status === 'analyzing').length;

  return { queue, enqueue, markComplete, dismiss, reload: load, analyzingCount };
}
