import { supabase } from './supabaseClient';

// Gera os slots do dia (ex: 07:00, 08:00, ... 22:00) dentro do horário de funcionamento
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

// Retorna só os horários do dia (ex: ['07:00','08:00',...]), sem calcular disponibilidade.
// Usado como as linhas da grade horário × quadra no painel do balcão.
export async function buscarSlotsDoDia(data) {
  const diaSemana = new Date(`${data}T00:00:00`).getDay();

  const { data: horarioDia } = await supabase
    .from('horarios_funcionamento')
    .select('*')
    .eq('dia_semana', diaSemana)
    .single();

  if (!horarioDia || horarioDia.fechado) return [];

  const { data: config } = await supabase
    .from('configuracao')
    .select('duracao_slot_minutos')
    .eq('id', 1)
    .single();

  return gerarSlots(horarioDia.hora_abertura, horarioDia.hora_fechamento, config.duracao_slot_minutos);
}

// data: string 'YYYY-MM-DD'
export async function buscarHorariosDisponiveis(quadraId, data, excluirReservaId = null) {
  const dataObj = new Date(`${data}T00:00:00`);
  const diaSemana = dataObj.getDay(); // 0=domingo .. 6=sábado

  // Horário de funcionamento específico desse dia da semana
  const { data: horarioDia } = await supabase
    .from('horarios_funcionamento')
    .select('*')
    .eq('dia_semana', diaSemana)
    .single();

  // Se não configurado, ou marcado como fechado, não há horários disponíveis
  if (!horarioDia || horarioDia.fechado) {
    return [];
  }

  const { data: config } = await supabase
    .from('configuracao')
    .select('duracao_slot_minutos')
    .eq('id', 1)
    .single();

  const slots = gerarSlots(
    horarioDia.hora_abertura,
    horarioDia.hora_fechamento,
    config.duracao_slot_minutos
  );

  // Reservas avulsas já confirmadas ou aguardando pagamento naquele dia/quadra
  let queryReservas = supabase
    .from('reservas')
    .select('hora_inicio, hora_fim')
    .eq('quadra_id', quadraId)
    .eq('data', data)
    .in('status_reserva', ['confirmada', 'aguardando_pagamento']);

  if (excluirReservaId) {
    queryReservas = queryReservas.neq('id', excluirReservaId);
  }

  const { data: reservas } = await queryReservas;

  // Mensalistas com horário fixo que caem nesse dia da semana
  const { data: mensalistas } = await supabase
    .from('mensalistas')
    .select('hora_inicio, hora_fim')
    .eq('quadra_id', quadraId)
    .eq('dia_semana', diaSemana)
    .eq('ativo', true);

  const ocupados = [...(reservas || []), ...(mensalistas || [])].map((o) => ({
    hora_inicio: o.hora_inicio.slice(0, 5),
    hora_fim: o.hora_fim.slice(0, 5),
  }));

  return slots.map((slot) => {
    const conflita = ocupados.some((o) =>
      slot.hora_inicio < o.hora_fim && slot.hora_fim > o.hora_inicio
    );
    return { ...slot, disponivel: !conflita };
  });
}

// Retorna, pra uma data, os horários disponíveis de CADA quadra.
// Formato: { [quadraId]: [{ hora_inicio, hora_fim, disponivel }, ...] }
// Usado no fluxo: cliente escolhe data → horário → só então vê quais quadras estão livres.
export async function buscarDisponibilidadeTodasQuadras(quadraIds, data) {
  const resultados = await Promise.all(
    quadraIds.map((id) => buscarHorariosDisponiveis(id, data))
  );
  const mapa = {};
  quadraIds.forEach((id, i) => {
    mapa[id] = resultados[i];
  });
  return mapa;
}
