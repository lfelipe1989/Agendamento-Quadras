import { createClient } from '@supabase/supabase-js';

// Mesmo projeto Supabase do BEAT Sports e do financeiro, mas apontando
// pro schema isolado 'agendamento' — nenhuma tabela daqui colide com as outras.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    db: { schema: 'agendamento' },
  }
);
