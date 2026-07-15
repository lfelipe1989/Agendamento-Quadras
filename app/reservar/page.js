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
        <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-2">
          RESERVAR QUADRA
        </h1>
        <p className="text-areia-muted mb-8">
          Escolha a quadra, a modalidade e o horário. Simples assim.
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
