import { supabase } from '@/lib/supabase';

const SESSION_KEY = 'vixel_session_id';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function trackVisit(path: string) {
  const sessionId = getSessionId();
  supabase
    .from('visit_logs')
    .insert({ session_id: sessionId, page_path: path })
    .then(() => {});
}
