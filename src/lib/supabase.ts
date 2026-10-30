import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && chave);

export const supabase = createClient(url ?? 'http://configurar.invalid', chave ?? 'configurar', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
