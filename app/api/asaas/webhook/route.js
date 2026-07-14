import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'agendamento' } }
);

// Configurar essa URL (https://seu-dominio.vercel.app/api/asaas/webhook) no painel do Asaas,
// em Integrações > Webhooks, escutando o evento PAYMENT_CONFIRMED / PAYMENT_RECEIVED.
export async function POST(request) {
  const evento = await request.json();

  const tiposConfirmacao = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];

  if (tiposConfirmacao.includes(evento.event)) {
    const paymentId = evento.payment?.id;
    const externalReference = evento.payment?.externalReference; // = reserva.id que a gente mandou

    if (externalReference) {
      // Tenta primeiro como reserva avulsa
      const { data: reserva } = await supabaseAdmin
        .from('reservas')
        .update({ status_pagamento: 'pago', status_reserva: 'confirmada' })
        .eq('id', externalReference)
        .select('id')
        .maybeSingle();

      if (!reserva) {
        // Se não achou, tenta como mensalidade
        await supabaseAdmin
          .from('mensalidades')
          .update({ status: 'pago', data_pagamento: new Date().toISOString(), forma_pagamento: 'asaas_online' })
          .eq('id', externalReference);
      }
    } else if (paymentId) {
      // fallback: casa pelo asaas_payment_id se não veio externalReference
      await supabaseAdmin
        .from('reservas')
        .update({ status_pagamento: 'pago', status_reserva: 'confirmada' })
        .eq('asaas_payment_id', paymentId);
    }
  }

  return Response.json({ recebido: true });
}
