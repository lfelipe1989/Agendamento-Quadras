import { supabase } from './supabaseClient';

// Gera os slots do dia (ex: 07:00, 08:00, ... 22:00) a partir da configuracao
function gerarSlots(horaAbertura, horaFechamento, duracaoMinutos) {
  const slots = [];
  const [hIni, mIni] = horaAbertura.split(':').map(Number);
  const [hFim, mFim] = horaFechamento.split(':').map(Number);

  let atual = hIni * 60 + mIni;
  const fim = hFim * 60 + mFim;

  while (atual + duracaoMinutos <= fim) {
    const horaInicioMin = atual;
    const horaFimMin = atual + duracaoMinutos;
    slots.push({
      hora_inicio: minutosParaHora(horaInicioMin),
      hora_fim: minutosParaHora(horaFimMin),
    });
    atual += duracaoMinutos;
  }
  return slots;
}

function minutosParaHora(min) {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// data: string 'YYYY-MM-DD'
export async function buscarHorariosDisponiveis(quadraId, data) {
  const dataObj = new Date(`${data}T00:00:00`);
  const diaSemana = dataObj.getDay(); // 0=domingo .. 6=sábado

  const { data: config } = await supabase
    .from('configuracao')
    .select('*')
    .eq('id', 1)
    .single();

  const slots = gerarSlots(
    config.hora_abertura,
    config.hora_fechamento,
    config.duracao_slot_minutos
  );

  // Reservas avulsas já confirmadas ou aguardando pagamento naquele dia/quadra
  const { data: reservas } = await supabase
    .from('reservas')
    .select('hora_inicio, hora_fim')
    .eq('quadra_id', quadraId)
    .eq('data', data)
    .in('status_reserva', ['confirmada', 'aguardando_pagamento']);

  // Mensalistas com horário fixo que caem nesse dia da semana
  const { data: mensalistas } = await supabase
    .from('mensalistas')
    .select('hora_inicio, hora_fim')
    .eq('quadra_id', quadraId)
    .eq('dia_semana', diaSemana)
    .eq('ativo', true);

  const ocupados = [...(reservas || []), ...(mensalistas || [])];

  return slots.map((slot) => {
    const conflita = ocupados.some((o) =>
      slot.hora_inicio < o.hora_fim && slot.hora_fim > o.hora_inicio
    );
    return { ...slot, disponivel: !conflita };
  });
}
