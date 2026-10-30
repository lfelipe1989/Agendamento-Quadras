import { supabase } from '@/lib/supabaseClient';
import BookingFlow from './BookingFlow';

export const dynamic = 'force-dynamic';

export default async function ReservarPage() {
  const { data: quadras, error: erroQuadras } = await supabase
    .from('quadras')
    .select('*')
    .eq('ativa', true)
    .order('ordem');

  const { data: modalidades, error: erroModalidades } = await supabase
    .from('config_modalidade')
    .select('*');

  const { data: config } = await supabase
    .from('configuracao')
    .select('hora_inicio_noturno')
    .eq('id', 1)
    .single();

  const erro = erroQuadras || erroModalidades;

  return (
    <main className="min-h-screen px-4 py-10 md:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-coral shrink-0">
            <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.75" />
            <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.75" />
          </svg>
          <span className="font-display text-xl tracking-wide">AREIA</span>
        </div>
        <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-2">
          RESERVAR QUADRA
        </h1>
        <p className="text-areia-muted mb-10">
          Escolha a data, o horário e a quadra. Leva menos de um minuto.
        </p>
        {erro && (
          <div className="bg-erro/10 border border-erro rounded-xl p-4 mb-6 text-sm">
            <p className="font-semibold mb-1">Erro ao carregar dados do Supabase:</p>
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(erro, null, 2)}</pre>
          </div>
        )}
        {!erro && quadras?.length === 0 && (
          <div className="bg-aviso/10 border border-aviso rounded-xl p-4 mb-6 text-sm">
            Nenhuma quadra encontrada — a conexão funcionou, mas a tabela retornou vazia.
          </div>
        )}
        <BookingFlow
          quadras={quadras || []}
          modalidades={modalidades || []}
          horaInicioNoturno={config?.hora_inicio_noturno?.slice(0, 5) || '18:00'}
        />
      </div>
    </main>
  );
}
