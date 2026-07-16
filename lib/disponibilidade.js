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
export async function buscarHorariosDisponiveis(quadraId, data, excluirReservaId = null, excluirMensalistaId = null) {
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

  // Mensalistas com horário fixo que caem nesse dia da semana, já considerando
  // exceções pontuais (cancelado ou alterado só nessa data específica)
  const efetivosMensalistas = await buscarMensalistasEfetivosDoDia(data);
  const mensalistas = efetivosMensalistas
    .filter((m) => m.quadra_id === quadraId)
    .filter((m) => !excluirMensalistaId || m.mensalista_id !== excluirMensalistaId);

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

// Retorna os mensalistas que realmente ocupam quadra numa data específica,
// já aplicando exceções pontuais daquele dia (cancelamento ou alteração de
// quadra/horário/modalidade só pra essa data, sem mexer no cadastro fixo).
export async function buscarMensalistasEfetivosDoDia(data) {
  const diaSemana = new Date(`${data}T00:00:00`).getDay();

  const { data: mensalistas } = await supabase
    .from('mensalistas')
    .select('id, quadra_id, modalidade, hora_inicio, hora_fim, cliente_id, clientes(nome, telefone)')
    .eq('dia_semana', diaSemana)
    .eq('ativo', true);

  if (!mensalistas || mensalistas.length === 0) return [];

  const { data: excecoes } = await supabase
    .from('mensalista_excecoes')
    .select('*')
    .eq('data', data)
    .in('mensalista_id', mensalistas.map((m) => m.id));

  const excecoesPorMensalista = {};
  (excecoes || []).forEach((e) => { excecoesPorMensalista[e.mensalista_id] = e; });

  const efetivos = [];
  mensalistas.forEach((m) => {
    const excecao = excecoesPorMensalista[m.id];

    if (excecao?.tipo === 'cancelado') return; // não ocupa nada nesse dia

    if (excecao?.tipo === 'alterado') {
      efetivos.push({
        mensalista_id: m.id,
        quadra_id: excecao.quadra_id || m.quadra_id,
        modalidade: excecao.modalidade || m.modalidade,
        hora_inicio: excecao.hora_inicio || m.hora_inicio,
        hora_fim: excecao.hora_fim || m.hora_fim,
        clientes: m.clientes,
        alteradoHoje: true,
      });
      return;
    }

    efetivos.push({
      mensalista_id: m.id,
      quadra_id: m.quadra_id,
      modalidade: m.modalidade,
      hora_inicio: m.hora_inicio,
      hora_fim: m.hora_fim,
      clientes: m.clientes,
      alteradoHoje: false,
    });
  });

  return efetivos;
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

// Verifica se um horário fixo (quadra + dia da semana + horário) colide com outro
// mensalista já ativo, OU com alguma reserva avulsa/evento futura que caia nesse
// mesmo dia da semana e horário. Usado antes de criar/editar mensalista, já que
// mensalistas não tem trava de banco contra sobreposição (diferente de reservas).
// Retorna null se não há conflito, ou uma string descrevendo o conflito encontrado.
export async function verificarConflitoMensalista({ quadraId, diaSemana, horaInicio, horaFim, excluirMensalistaId = null }) {
  // 1. Outro mensalista já ativo no mesmo horário/quadra/dia
  let queryMensalistas = supabase
    .from('mensalistas')
    .select('id, hora_inicio, hora_fim, clientes(nome)')
    .eq('quadra_id', quadraId)
    .eq('dia_semana', diaSemana)
    .eq('ativo', true);

  if (excluirMensalistaId) {
    queryMensalistas = queryMensalistas.neq('id', excluirMensalistaId);
  }

  const { data: outrosMensalistas } = await queryMensalistas;

  const conflitoMensalista = (outrosMensalistas || []).find((o) => {
    const oInicio = o.hora_inicio.slice(0, 5);
    const oFim = o.hora_fim.slice(0, 5);
    return horaInicio < oFim && horaFim > oInicio;
  });

  if (conflitoMensalista) {
    return `Já existe o mensalista ${conflitoMensalista.clientes?.nome || ''} nesse horário e quadra.`;
  }

  // 2. Reserva avulsa/evento futura que caia nesse mesmo dia da semana e horário
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  const { data: reservasFuturas } = await supabase
    .from('reservas')
    .select('data, hora_inicio, hora_fim, clientes(nome)')
    .eq('quadra_id', quadraId)
    .gte('data', hojeStr)
    .in('status_reserva', ['confirmada', 'aguardando_pagamento']);

  const conflitoReserva = (reservasFuturas || []).find((r) => {
    const diaDaReserva = new Date(`${r.data}T00:00:00`).getDay();
    if (diaDaReserva !== diaSemana) return false;
    const rInicio = r.hora_inicio.slice(0, 5);
    const rFim = r.hora_fim.slice(0, 5);
    return horaInicio < rFim && horaFim > rInicio;
  });

  if (conflitoReserva) {
    return `Já existe uma reserva de ${conflitoReserva.clientes?.nome || 'cliente'} em ${conflitoReserva.data.split('-').reverse().join('/')} nesse mesmo horário/quadra — resolva ou cancele essa reserva antes de fixar o mensalista aqui.`;
  }

  return null;
}

// Igual buscarHorariosDisponiveis, mas pra churrasqueiras (mais simples: sem mensalista,
// só confere reservas de churrasqueira já confirmadas naquele dia).
export async function buscarHorariosDisponiveisChurrasqueira(churrasqueiraId, data, excluirReservaId = null) {
  const slots = await buscarSlotsDoDia(data);
  if (slots.length === 0) return [];

  let query = supabase
    .from('reservas_churrasqueira')
    .select('id, hora_inicio, hora_fim')
    .eq('churrasqueira_id', churrasqueiraId)
    .eq('data', data)
    .neq('status_reserva', 'cancelada');

  if (excluirReservaId) {
    query = query.neq('id', excluirReservaId);
  }

  const { data: reservas } = await query;

  const ocupados = (reservas || []).map((o) => ({
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
