import { createClient } from '@supabase/supabase-js';

// Client Supabase com service_role — só existe no servidor, nunca exposto ao navegador.
// Precisa da chave SUPABASE_SERVICE_ROLE_KEY nas env vars da Vercel (não a anon key).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'agendamento' } }
);

const ASAAS_BASE_URL = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://api-sandbox.asaas.com/v3';

export async function POST(request) {
  try {
    const { reservaId, valor, nome, email, telefone, cpf } = await request.json();

    // 1. Garante que o cliente existe no Asaas (cria se necessário)
    const customerResp = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: process.env.ASAAS_API_KEY,
      },
      body: JSON.stringify({
        name: nome,
        email: email || undefined,
        mobilePhone: telefone,
        cpfCnpj: cpf || undefined,
      }),
    });
    const customer = await customerResp.json();

    if (!customer.id) {
      // Se o Asaas já tiver um cliente com esse CPF/telefone, ele pode retornar erro de duplicidade.
      // Nesse caso, seria necessário buscar o cliente existente via GET /customers?cpfCnpj=...
      return Response.json({ error: 'Não foi possível criar o cliente no Asaas', detalhe: customer }, { status: 400 });
    }

    // 2. Cria a cobrança (Pix + cartão) vinculada à reserva
    const paymentResp = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: process.env.ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customer.id,
        billingType: 'UNDEFINED', // deixa o cliente escolher Pix ou cartão na tela do Asaas
        value: valor,
        dueDate: new Date().toISOString().split('T')[0],
        description: `Reserva de quadra #${reservaId}`,
        externalReference: reservaId,
      }),
    });
    const payment = await paymentResp.json();

    if (!payment.id) {
      return Response.json({ error: 'Não foi possível criar a cobrança', detalhe: payment }, { status: 400 });
    }

    // 3. Salva o id da cobrança na reserva, pra cruzar com o webhook depois
    await supabaseAdmin
      .from('reservas')
      .update({
        asaas_payment_id: payment.id,
        asaas_checkout_url: payment.invoiceUrl,
      })
      .eq('id', reservaId);

    return Response.json({ checkoutUrl: payment.invoiceUrl });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
