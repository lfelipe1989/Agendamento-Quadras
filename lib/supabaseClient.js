import { createClient } from '@supabase/supabase-js';

// Mesmo projeto Supabase do BEAT Sports e do financeiro, mas apontando
// pro schema isolado 'agendamento' — nenhuma tabela daqui colide com as outras.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    db: { schema: 'agendamento' },
    global: {
      // Evita que o Next.js cacheie as chamadas ao Supabase feitas em Server Components
      // (isso aconteceu mesmo com dynamic='force-dynamic' na página)
      fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
    },
  }
);
