import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { StoreSettings } from '@/lib/types';

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (active) {
        setSettings(data as StoreSettings | null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { settings, loading };
}
