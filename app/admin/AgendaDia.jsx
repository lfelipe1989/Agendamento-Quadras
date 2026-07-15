'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { buscarHorariosDisponiveis, buscarSlotsDoDia } from '@/lib/disponibilidade';

const NOMES_MODALIDADE = {
  altinha: 'Altinha',
  futevolei: 'Futevôlei',
  volei: 'Vôlei',
  beach_tenis: 'Beach Tênis',
};

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Formata uma data no fuso local (evita o bug de toISOString() virar o dia
// seguinte à noite, já que ela converte pra UTC antes de formatar)
function dataParaString(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export default function AgendaDia({ quadras, modalidades, horaInicioNoturno }) {
  const [data, setData] = useState(dataParaString(new Date()));
  const [slots, setSlots] = useState([]);
  const [itensPorQuadra, setItensPorQuadra] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [celulaSelecionada, setCelulaSelecionada] = useState(null); // { quadra, horario }
  const [detalheItem, setDetalheItem] = useState(null); // item clicado pra ver/editar

  const carregar = useCallback(async () => {
    if (quadras.length === 0) return;
    setCarregando(true);
    const diaSemana = new Date(`${data}T00:00:00`).getDay();

    const slotsDoDia = await buscarSlotsDoDia(data);
    setSlots(slotsDoDia);

    const resultado = {};
    for (const q of quadras) {
      const { data: reservas } = await supabase
        .from('reservas')
        .select('id, hora_inicio, hora_fim, modalidade, valor, status_pagamento, forma_pagamento, status_reserva, clientes(nome, telefone)')
        .eq('quadra_id', q.id)
        .eq('data', data)
        .neq('status_reserva', 'cancelada')
        .order('hora_inicio');

      const { data: mensalistas } = await supabase
        .from('mensalistas')
        .select('id, hora_inicio, hora_fim, modalidade, valor_mensal, clientes(nome, telefone)')
        .eq('quadra_id', q.id)
        .eq('dia_semana', diaSemana)
        .eq('ativo', true)
        .order('hora_inicio');

      const itensAvulsos = (reservas || []).map((r) => ({ ...r, tipo: 'avulsa' }));
      const itensMensalistas = (mensalistas || []).map((m) => ({ ...m, tipo: 'mensalista' }));
      const todosItens = [...itensAvulsos, ...itensMensalistas];

      // Marca TODOS os slots cobertos pelo intervalo do item (ex: reserva das 17h-20h
      // ocupa os slots de 17h, 18h e 19h), não só o horário exato de início.
      const mapaPorHorario = {};
      slotsDoDia.forEach((slot) => {
        const item = todosItens.find(
          (it) => slot.hora_inicio >= it.hora_inicio.slice(0, 5) && slot.hora_inicio < it.hora_fim.slice(0, 5)
        );
        if (item) mapaPorHorario[slot.hora_inicio] = item;
      });
      resultado[q.id] = mapaPorHorario;
    }
    setItensPorQuadra(resultado);
    setCarregando(false);
  }, [quadras, data]);

  useEffect(() => { carregar(); }, [carregar]);

  async function alternarPagamento(item) {
    const novoStatus = item.status_pagamento === 'pago' ? 'pendente' : 'pago';
    await supabase.from('reservas').update({ status_pagamento: novoStatus }).eq('id', item.id);
    setDetalheItem(null);
    carregar();
  }

  async function cancelarReserva(item) {
    if (!confirm('Cancelar essa reserva?')) return;
    await supabase.from('reservas').update({ status_reserva: 'cancelada' }).eq('id', item.id);
    setDetalheItem(null);
    carregar();
  }

  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const hojeStr = dataParaString(new Date());
  const ehHoje = data === hojeStr;

  function mudarDia(delta) {
    const d = new Date(`${data}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setData(dataParaString(d));
  }

  function formatarDataExtenso(d) {
    const [ano, mes, dia] = d.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  function corDoItem(item) {
    if (!item) return null;
    if (item.tipo === 'mensalista') return { bg: 'bg-volei/25', text: 'text-volei', borda: 'border-volei/40' };
    if (item.status_pagamento === 'pago') return { bg: 'bg-sucesso/25', text: 'text-sucesso', borda: 'border-sucesso/40' };
    return { bg: 'bg-aviso/25', text: 'text-aviso', borda: 'border-aviso/40' };
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-1">
        <button
          onClick={() => mudarDia(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-night-line hover:border-areia-muted text-lg"
        >
          ‹
        </button>
        <div className="relative">
          <button
            onClick={() => setMostrarCalendario((v) => !v)}
            className="font-display text-2xl tracking-wide px-2"
          >
            {ehHoje ? 'HOJE' : formatarDataExtenso(data)}
          </button>
          {mostrarCalendario && (
            <input
              type="date"
              value={data}
              autoFocus
              onChange={(e) => { setData(e.target.value); setMostrarCalendario(false); }}
              onBlur={() => setMostrarCalendario(false)}
              className="absolute top-full left-0 mt-1 z-10 bg-night-panel border border-night-line rounded-lg px-3 py-2 text-areia"
            />
          )}
        </div>
        <button
          onClick={() => mudarDia(1)}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-night-line hover:border-areia-muted text-lg"
        >
          ›
        </button>
      </div>
      <p className="text-areia-muted text-sm mb-6">{DIAS_SEMANA[new Date(`${data}T00:00:00`).getDay()]}-feira · {formatarDataExtenso(data)}</p>

      {carregando && <p className="text-areia-muted mb-4">Carregando...</p>}

      {!carregando && slots.length === 0 && (
        <p className="text-aviso text-sm mb-4">Fechado nesse dia (configurável na aba Horários).</p>
      )}

      {slots.length > 0 && (
        <div className="overflow-x-auto bg-night-panel border border-night-line rounded-2xl">
          <div
            className="grid min-w-[600px]"
            style={{ gridTemplateColumns: `70px repeat(${quadras.length}, 1fr)` }}
          >
            {/* cabeçalho */}
            <div className="border-b border-r border-night-line p-2" />
            {quadras.map((q) => (
              <div key={q.id} className="border-b border-night-line p-2 text-center font-semibold text-sm">
                {q.nome}
              </div>
            ))}

            {/* linhas de horário */}
            {slots.map((slot) => (
              <div key={slot.hora_inicio} className="contents">
                <div className="border-r border-b border-night-line p-2 text-xs text-areia-muted flex items-start">
                  {slot.hora_inicio}
                </div>
                {quadras.map((q) => {
                  const item = itensPorQuadra[q.id]?.[slot.hora_inicio];
                  const cor = corDoItem(item);
                  return (
                    <button
                      key={q.id}
                      onClick={() =>
                        item
                          ? setDetalheItem({ item, quadra: q })
                          : setCelulaSelecionada({ quadra: q, horario: slot })
                      }
                      className={`border-b border-night-line p-2 text-left text-xs min-h-[52px] transition-colors ${
                        item
                          ? `${cor.bg} ${cor.text} border-l-2 ${cor.borda}`
                          : 'hover:bg-night-line/40'
                      }`}
                    >
                      {item ? (
                        <>
                          <div className="font-semibold truncate">{item.clientes?.nome}</div>
                          <div className="opacity-80 truncate">
                            {item.tipo === 'mensalista' ? 'Mensalista' : NOMES_MODALIDADE[item.modalidade]}
                          </div>
                        </>
                      ) : (
                        <span className="text-areia-muted/30">livre</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <UltimosAgendamentos modalidades={modalidades} />

      {celulaSelecionada && (
        <NovaReservaModal
          quadra={celulaSelecionada.quadra}
          data={data}
          horarioPreselecionado={celulaSelecionada.horario}
          modalidades={modalidades}
          horaInicioNoturno={horaInicioNoturno}
          onFechar={() => setCelulaSelecionada(null)}
          onCriada={() => { setCelulaSelecionada(null); carregar(); }}
        />
      )}

      {detalheItem && (
        <DetalheItemModal
          item={detalheItem.item}
          quadra={detalheItem.quadra}
          modalidades={modalidades}
          onFechar={() => setDetalheItem(null)}
          onAlternarPagamento={() => alternarPagamento(detalheItem.item)}
          onCancelar={() => cancelarReserva(detalheItem.item)}
        />
      )}
    </div>
  );
}

function DetalheItemModal({ item, quadra, modalidades, onFechar, onAlternarPagamento, onCancelar }) {
  const cor = modalidades.find((m) => m.modalidade === item.modalidade)?.cor;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-display text-xl tracking-wide mb-1">{quadra.nome}</h3>
        <p className="text-areia-muted text-sm mb-4">
          {item.hora_inicio.slice(0, 5)}–{item.hora_fim.slice(0, 5)} ·{' '}
          <span style={{ color: cor }}>{NOMES_MODALIDADE[item.modalidade]}</span>
        </p>
        <p className="font-semibold mb-1">{item.clientes?.nome}</p>
        <p className="text-areia-muted text-sm mb-4">{item.clientes?.telefone}</p>

        {item.tipo === 'mensalista' ? (
          <p className="text-volei text-sm mb-4">Horário fixo de mensalista — gerencie pagamento na aba Mensalistas.</p>
        ) : (
          <>
            <button
              onClick={onAlternarPagamento}
              className={`w-full text-sm px-3 py-2 rounded-lg mb-3 ${
                item.status_pagamento === 'pago' ? 'bg-sucesso/20 text-sucesso' : 'bg-aviso/20 text-aviso'
              }`}
            >
              {item.status_pagamento === 'pago' ? '✓ Pago' : 'Pendente'} · R$ {Number(item.valor).toFixed(2)} — clique pra alternar
            </button>
            <button onClick={onCancelar} className="w-full text-sm px-3 py-2 rounded-lg text-erro hover:bg-erro/10 mb-3">
              Cancelar reserva
            </button>
          </>
        )}

        <button onClick={onFechar} className="w-full text-areia-muted hover:text-areia text-sm py-2">
          Fechar
        </button>
      </div>
    </div>
  );
}

function UltimosAgendamentos({ modalidades }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('reservas')
      .select('id, data, hora_inicio, modalidade, valor, status_pagamento, status_reserva, origem, created_at, clientes(nome, telefone), quadras(nome)')
      .order('created_at', { ascending: false })
      .limit(30);
    setItens(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 20000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-xl tracking-wide">ÚLTIMOS AGENDAMENTOS</h3>
        <button onClick={carregar} className="text-areia-muted hover:text-areia text-xs">Atualizar</button>
      </div>
      <div className="bg-night-panel border border-night-line rounded-2xl divide-y divide-night-line overflow-hidden">
        {carregando && <p className="text-areia-muted text-sm p-4">Carregando...</p>}
        {!carregando && itens.length === 0 && <p className="text-areia-muted text-sm p-4">Nenhum agendamento ainda.</p>}
        {itens.map((item) => (
          <div key={item.id} className="p-3 flex items-center justify-between flex-wrap gap-2 text-sm">
            <div>
              <span className="font-semibold">{item.clientes?.nome}</span>
              <span className="text-areia-muted"> · {item.clientes?.telefone}</span>
            </div>
            <div className="text-areia-muted flex items-center gap-2 flex-wrap">
              <span>{item.quadras?.nome}</span>
              <span>·</span>
              <span
                className="px-2 py-0.5 rounded-full text-[11px]"
                style={{ backgroundColor: modalidades.find((m) => m.modalidade === item.modalidade)?.cor + '33', color: modalidades.find((m) => m.modalidade === item.modalidade)?.cor }}
              >
                {NOMES_MODALIDADE[item.modalidade]}
              </span>
              <span>{item.data.split('-').reverse().join('/')} {item.hora_inicio.slice(0, 5)}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-night text-areia-muted">
                {item.origem === 'link' ? 'via link' : 'balcão'}
              </span>
              {item.status_reserva === 'cancelada' ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-erro/20 text-erro">Cancelada</span>
              ) : (
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${item.status_pagamento === 'pago' ? 'bg-sucesso/20 text-sucesso' : 'bg-aviso/20 text-aviso'}`}>
                  {item.status_pagamento === 'pago' ? '✓ Pago' : 'Pendente'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NovaReservaModal({ quadra, data, horarioPreselecionado, modalidades, horaInicioNoturno, onFechar, onCriada }) {
  const [horarios, setHorarios] = useState([]);
  const [horarioEscolhido, setHorarioEscolhido] = useState(horarioPreselecionado || null);
  const [modalidade, setModalidade] = useState(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [valor, setValor] = useState('');
  const [statusPagamento, setStatusPagamento] = useState('pendente');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!horarioPreselecionado) {
      buscarHorariosDisponiveis(quadra.id, data).then(setHorarios);
    }
  }, [quadra, data]);

  useEffect(() => {
    if (modalidade && horarioEscolhido) {
      const info = modalidades.find((m) => m.modalidade === modalidade);
      const noturno = horarioEscolhido.hora_inicio >= (horaInicioNoturno || '18:00');
      setValor(info ? (noturno ? info.valor_noturno : info.valor_diurno) : 0);
    }
  }, [modalidade, horarioEscolhido]);

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      let { data: clienteExistente } = await supabase
        .from('clientes').select('id').eq('telefone', telefone).maybeSingle();

      let clienteId = clienteExistente?.id;
      if (!clienteId) {
        const { data: novoCliente, error: erroCliente } = await supabase
          .from('clientes').insert({ nome, telefone }).select('id').single();
        if (erroCliente) throw erroCliente;
        clienteId = novoCliente.id;
      }

      const { error: erroReserva } = await supabase.from('reservas').insert({
        quadra_id: quadra.id,
        cliente_id: clienteId,
        modalidade,
        data,
        hora_inicio: horarioEscolhido.hora_inicio,
        hora_fim: horarioEscolhido.hora_fim,
        valor,
        origem: 'balcao',
        forma_pagamento: formaPagamento,
        status_pagamento: statusPagamento,
        status_reserva: 'confirmada',
      });

      if (erroReserva) {
        if (erroReserva.code === '23P01') throw new Error('Esse horário já está ocupado nessa quadra.');
        throw erroReserva;
      }
      onCriada();
    } catch (e) {
      setErro(e.message || 'Erro ao criar reserva.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl tracking-wide mb-4">NOVA RESERVA · {quadra.nome}</h3>

        {horarioPreselecionado ? (
          <p className="text-areia-muted text-sm mb-3">
            Horário: <span className="text-areia font-semibold">{horarioPreselecionado.hora_inicio}–{horarioPreselecionado.hora_fim}</span>
          </p>
        ) : (
          <label className="block mb-3">
            <span className="text-sm text-areia-muted block mb-1">Horário</span>
            <div className="grid grid-cols-4 gap-2">
              {horarios.map((h) => (
                <button
                  key={h.hora_inicio}
                  disabled={!h.disponivel}
                  onClick={() => setHorarioEscolhido(h)}
                  className={`py-2 rounded-lg text-xs border ${
                    !h.disponivel ? 'border-night-line text-areia-muted/40 line-through cursor-not-allowed'
                    : horarioEscolhido?.hora_inicio === h.hora_inicio ? 'border-coral text-coral' : 'border-night-line'
                  }`}
                >
                  {h.hora_inicio}
                </button>
              ))}
            </div>
          </label>
        )}

        <label className="block mb-3">
          <span className="text-sm text-areia-muted block mb-1">Modalidade</span>
          <select value={modalidade || ''} onChange={(e) => setModalidade(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full">
            <option value="">Selecione</option>
            {modalidades.map((m) => (
              <option key={m.modalidade} value={m.modalidade}>{NOMES_MODALIDADE[m.modalidade]}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">Telefone</span>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">Valor (R$)</span>
            <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">Forma de pagamento</span>
            <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full">
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={statusPagamento === 'pago'} onChange={(e) => setStatusPagamento(e.target.checked ? 'pago' : 'pendente')} />
          <span className="text-sm">Já pagou</span>
        </label>

        {erro && <p className="text-erro text-sm mb-3">{erro}</p>}

        <div className="flex justify-between gap-3">
          <button onClick={onFechar} className="text-areia-muted hover:text-areia px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={!horarioEscolhido || !modalidade || !nome || !telefone || enviando}
            className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-2 rounded-full"
          >
            {enviando ? 'Salvando...' : 'Salvar reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}
