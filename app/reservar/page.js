import { supabase } from '@/lib/supabaseClient';
import BookingFlow from './BookingFlow';

export const dynamic = 'force-dynamic';

export default async function ReservarPage() {
  const { data: quadras } = await supabase
    .from('quadras')
    .select('*')
    .eq('ativa', true)
    .order('ordem');

  const { data: modalidades } = await supabase
    .from('config_modalidade')
    .select('*');

  return (
    <main className="min-h-screen px-4 py-10 md:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-2">
          RESERVAR QUADRA
        </h1>
        <p className="text-areia-muted mb-8">
          Escolha a quadra, a modalidade e o horário. Simples assim.
        </p>
        <BookingFlow quadras={quadras || []} modalidades={modalidades || []} />
      </div>
    </main>
  );
}
