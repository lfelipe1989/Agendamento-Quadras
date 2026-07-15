'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { buscarHorariosDisponiveis, buscarSlotsDoDia, buscarMensalistasEfetivosDoDia } from '@/lib/disponibilidade';

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

    const slotsDoDia = await buscarSlotsDoDia(data);
    setSlots(slotsDoDia);

    const efetivosMensalistas = await buscarMensalistasEfetivosDoDia(data);

    const resultado = {};
    for (const q of quadras) {
      const { data: reservas } = await supabase
        .from('reservas')
        .select('id, hora_inicio, hora_fim, modalidade, valor, status_pagamento, forma_pagamento, status_reserva, evento_id, clientes(nome, telefone), eventos(nome_responsavel, observacao)')
        .eq('quadra_id', q.id)
        .eq('data', data)
        .neq('status_reserva', 'cancelada')
        .order('hora_inicio');

      const itensAvulsos = (reservas || []).map((r) => ({ ...r, tipo: r.evento_id ? 'evento' : 'avulsa' }));
      const itensMensalistas = efetivosMensalistas
        .filter((m) => m.quadra_id === q.id)
        .map((m) => ({ ...m, id: m.mensalista_id, tipo: 'mensalista' }));
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

  function corModalidade(item) {
    if (!item) return null;
    return modalidades.find((m) => m.modalidade === item.modalidade)?.cor || '#8a8a8a';
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
                  const cor = corModalidade(item);
                  return (
                    <button
                      key={q.id}
                      onClick={() =>
                        item
                          ? setDetalheItem({ item, quadra: q })
                          : setCelulaSelecionada({ quadra: q, horario: slot })
                      }
                      style={
                        item
                          ? { backgroundColor: `${cor}26`, borderLeft: `3px solid ${cor}`, color: cor }
                          : undefined
                      }
                      className={`border-b border-night-line p-2 text-left text-xs min-h-[52px] transition-colors ${
                        !item ? 'hover:bg-night-line/40' : ''
                      }`}
                    >
                      {item ? (
                        <>
                          <div className="font-semibold truncate">
                            {item.tipo === 'evento' ? (item.eventos?.nome_responsavel || 'Evento') : item.clientes?.nome}
                          </div>
                          <div className="opacity-90 truncate flex items-center gap-1">
                            <span>
                              {item.tipo === 'mensalista'
                                ? (item.alteradoHoje ? 'Mensalista (alterado hoje)' : 'Mensalista')
                                : item.tipo === 'evento'
                                ? 'Evento'
                                : NOMES_MODALIDADE[item.modalidade]}
                            </span>
                            {item.tipo === 'avulsa' && (
                              <span
                                className={`text-[10px] px-1 rounded-full ${
                                  item.status_pagamento === 'pago' ? 'bg-sucesso/30 text-sucesso' : 'bg-aviso/30 text-aviso'
                                }`}
                              >
                                {item.status_pagamento === 'pago' ? '✓' : '!'}
                              </span>
                            )}
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

      {detalheItem && detalheItem.item.tipo === 'avulsa' && (
        <EditarReservaModal
          reservaId={detalheItem.item.id}
          quadras={quadras}
          modalidades={modalidades}
          horaInicioNoturno={horaInicioNoturno}
          onFechar={() => setDetalheItem(null)}
          onAtualizado={() => { setDetalheItem(null); carregar(); }}
        />
      )}

      {detalheItem && detalheItem.item.tipo === 'evento' && (
        <InfoEventoModal
          item={detalheItem.item}
          quadra={detalheItem.quadra}
          onFechar={() => setDetalheItem(null)}
        />
      )}

      {detalheItem && detalheItem.item.tipo === 'mensalista' && (
        <EditarMensalistaDiaModal
          mensalistaId={detalheItem.item.id}
          data={data}
          quadras={quadras}
          modalidades={modalidades}
          onFechar={() => setDetalheItem(null)}
          onAtualizado={() => { setDetalheItem(null); carregar(); }}
        />
      )}
    </div>
  );
}

function InfoEventoModal({ item, quadra, onFechar }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-display text-xl tracking-wide mb-1">{quadra.nome}</h3>
        <p className="text-areia-muted text-sm mb-4">
          {item.hora_inicio.slice(0, 5)}–{item.hora_fim.slice(0, 5)}
        </p>
        <p className="font-semibold mb-1">{item.eventos?.nome_responsavel || 'Evento'}</p>
        {item.eventos?.observacao && <p className="text-areia-muted text-sm mb-4">{item.eventos.observacao}</p>}
        <p className="text-volei text-sm mb-4">
          Esse horário faz parte de um evento. Pra editar, cancelar ou trocar de data, use a aba <strong>Eventos</strong> e clique nesse mesmo horário lá.
        </p>
        <button onClick={onFechar} className="w-full text-areia-muted hover:text-areia text-sm py-2">
          Fechar
        </button>
      </div>
    </div>
  );
}

function EditarMensalistaDiaModal({ mensalistaId, data, quadras, modalidades, onFechar, onAtualizado }) {
  const [carregando, setCarregando] = useState(true);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [base, setBase] = useState(null); // dados fixos do cadastro (horário normal)
  const [opcao, setOpcao] = useState('normal'); // 'normal' | 'alterado' | 'cancelado'
  const [quadraId, setQuadraId] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const { data: m } = await supabase
        .from('mensalistas')
        .select('*, clientes(nome, telefone), quadras(nome)')
        .eq('id', mensalistaId)
        .single();

      const { data: excecao } = await supabase
        .from('mensalista_excecoes')
        .select('*')
        .eq('mensalista_id', mensalistaId)
        .eq('data', data)
        .maybeSingle();

      if (m) {
        setClienteNome(m.clientes?.nome || '');
        setClienteTelefone(m.clientes?.telefone || '');
        setBase(m);
        setQuadraId(excecao?.quadra_id || m.quadra_id);
        setModalidade(excecao?.modalidade || m.modalidade);
        setHoraInicio((excecao?.hora_inicio || m.hora_inicio).slice(0, 5));
        setHoraFim((excecao?.hora_fim || m.hora_fim).slice(0, 5));
        setOpcao(excecao?.tipo || 'normal');
      }
      setCarregando(false);
    })();
  }, [mensalistaId, data]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (opcao === 'normal') {
        // remove qualquer exceção existente, voltando ao horário fixo normal
        await supabase.from('mensalista_excecoes').delete().eq('mensalista_id', mensalistaId).eq('data', data);
      } else if (opcao === 'cancelado') {
        const { error } = await supabase
          .from('mensalista_excecoes')
          .upsert(
            { mensalista_id: mensalistaId, data, tipo: 'cancelado', quadra_id: null, modalidade: null, hora_inicio: null, hora_fim: null },
            { onConflict: 'mensalista_id,data' }
          );
        if (error) throw error;
      } else if (opcao === 'alterado') {
        const { error } = await supabase
          .from('mensalista_excecoes')
          .upsert(
            { mensalista_id: mensalistaId, data, tipo: 'alterado', quadra_id: quadraId, modalidade, hora_inicio: horaInicio, hora_fim: horaFim },
            { onConflict: 'mensalista_id,data' }
          );
        if (error) {
          if (error.code === '23P01') throw new Error('Esse horário já está ocupado nessa quadra.');
          throw error;
        }
      }
      onAtualizado();
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const dataFormatada = data.split('-').reverse().join('/');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl tracking-wide mb-1">MENSALISTA · {dataFormatada}</h3>
        {carregando ? (
          <p className="text-areia-muted mt-4">Carregando...</p>
        ) : (
          <>
            <p className="font-semibold mt-2">{clienteNome}</p>
            <p className="text-areia-muted text-sm mb-4">{clienteTelefone}</p>
            <p className="text-areia-muted text-xs mb-4">
              Horário fixo normal: {base?.quadras?.nome} · {NOMES_MODALIDADE[base?.modalidade]} · {base?.hora_inicio?.slice(0, 5)}–{base?.hora_fim?.slice(0, 5)}
            </p>
            <p className="text-volei text-xs mb-4">
              O que você mudar aqui vale só pra {dataFormatada}. O horário fixo definitivo continua igual — pra alterar pra sempre, use a aba Mensalistas.
            </p>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="opcao" checked={opcao === 'normal'} onChange={() => setOpcao('normal')} />
                Normal (horário fixo de sempre)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="opcao" checked={opcao === 'alterado'} onChange={() => setOpcao('alterado')} />
                Alterado só nesse dia
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="opcao" checked={opcao === 'cancelado'} onChange={() => setOpcao('cancelado')} />
                Cancelado só nesse dia (libera a quadra)
              </label>
            </div>

            {opcao === 'alterado' && (
              <div className="space-y-3 mb-4 bg-night rounded-xl p-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-areia-muted block mb-1">Quadra</span>
                    <select value={quadraId} onChange={(e) => setQuadraId(e.target.value)} className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-full text-sm">
                      {quadras.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-areia-muted block mb-1">Modalidade</span>
                    <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-full text-sm">
                      {modalidades.map((m) => <option key={m.modalidade} value={m.modalidade}>{NOMES_MODALIDADE[m.modalidade]}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-areia-muted block mb-1">Início</span>
                    <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-full text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-areia-muted block mb-1">Fim</span>
                    <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-full text-sm" />
                  </label>
                </div>
              </div>
            )}

            {erro && <p className="text-erro text-sm mb-3">{erro}</p>}

            <div className="flex justify-between gap-3 pt-2 border-t border-night-line">
              <button onClick={onFechar} className="text-areia-muted hover:text-areia px-3 py-2 text-sm">Fechar</button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-2 rounded-full"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EditarReservaModal({ reservaId, quadras, modalidades, horaInicioNoturno, onFechar, onAtualizado }) {
  const [carregando, setCarregando] = useState(true);
  const [clienteId, setClienteId] = useState(null);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [data, setData] = useState('');
  const [quadraId, setQuadraId] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [horarios, setHorarios] = useState([]);
  const [horarioEscolhido, setHorarioEscolhido] = useState(null);
  const [valor, setValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [statusPagamento, setStatusPagamento] = useState('pendente');
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const { data: r } = await supabase
        .from('reservas')
        .select('*, clientes(nome, telefone)')
        .eq('id', reservaId)
        .single();
      if (r) {
        setClienteId(r.cliente_id);
        setClienteNome(r.clientes?.nome || '');
        setClienteTelefone(r.clientes?.telefone || '');
        setData(r.data);
        setQuadraId(r.quadra_id);
        setModalidade(r.modalidade);
        setHorarioEscolhido({ hora_inicio: r.hora_inicio.slice(0, 5), hora_fim: r.hora_fim.slice(0, 5) });
        setValor(r.valor);
        setFormaPagamento(r.forma_pagamento || 'dinheiro');
        setStatusPagamento(r.status_pagamento);
      }
      setCarregando(false);
    })();
  }, [reservaId]);

  // Recalcula os horários disponíveis sempre que quadra ou data mudam,
  // excluindo a própria reserva do cálculo de conflito (senão ela bloquearia a si mesma)
  useEffect(() => {
    if (quadraId && data) {
      setCarregandoHorarios(true);
      buscarHorariosDisponiveis(quadraId, data, reservaId)
        .then(setHorarios)
        .finally(() => setCarregandoHorarios(false));
    }
  }, [quadraId, data, reservaId]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (!horarioEscolhido) throw new Error('Escolha um horário.');

      const { error } = await supabase
        .from('reservas')
        .update({
          quadra_id: quadraId,
          modalidade,
          data,
          hora_inicio: horarioEscolhido.hora_inicio,
          hora_fim: horarioEscolhido.hora_fim,
          valor,
          forma_pagamento: formaPagamento,
          status_pagamento: statusPagamento,
        })
        .eq('id', reservaId);

      if (error) {
        if (error.code === '23P01') throw new Error('Esse horário já está ocupado nessa quadra.');
        throw error;
      }

      if (clienteId) {
        await supabase.from('clientes').update({ nome: clienteNome, telefone: clienteTelefone }).eq('id', clienteId);
      }

      onAtualizado();
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function cancelar() {
    if (!confirm('Cancelar essa reserva?')) return;
    await supabase.from('reservas').update({ status_reserva: 'cancelada' }).eq('id', reservaId);
    onAtualizado();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl tracking-wide mb-4">EDITAR RESERVA</h3>

        {carregando ? (
          <p className="text-areia-muted">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">Nome</span>
                <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
              </label>
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">Telefone</span>
                <input value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">Data</span>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => { setData(e.target.value); setHorarioEscolhido(null); }}
                  className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full"
                />
              </label>
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">Quadra</span>
                <select
                  value={quadraId}
                  onChange={(e) => { setQuadraId(e.target.value); setHorarioEscolhido(null); }}
                  className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full"
                >
                  {quadras.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
                </select>
              </label>
            </div>

            <label className="block mb-3">
              <span className="text-sm text-areia-muted block mb-1">Horário</span>
              {carregandoHorarios ? (
                <p className="text-areia-muted text-sm">Carregando...</p>
              ) : (
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
              )}
            </label>

            <label className="block mb-3">
              <span className="text-sm text-areia-muted block mb-1">Modalidade</span>
              <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full">
                {modalidades.map((m) => (
                  <option key={m.modalidade} value={m.modalidade}>{NOMES_MODALIDADE[m.modalidade]}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">Valor (R$)</span>
                <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
              </label>
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">Forma de pagamento</span>
                <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full">
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                  <option value="asaas_online">Asaas (online)</option>
                  <option value="local">A combinar no local</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={statusPagamento === 'pago'} onChange={(e) => setStatusPagamento(e.target.checked ? 'pago' : 'pendente')} />
              <span className="text-sm">Pago</span>
            </label>

            {erro && <p className="text-erro text-sm mb-3">{erro}</p>}

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-night-line">
              <button onClick={cancelar} className="text-erro hover:opacity-80 text-sm px-2 py-2">
                Cancelar reserva
              </button>
              <div className="flex gap-3">
                <button onClick={onFechar} className="text-areia-muted hover:text-areia px-3 py-2 text-sm">Fechar</button>
                <button
                  onClick={salvar}
                  disabled={!horarioEscolhido || salvando}
                  className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-2 rounded-full"
                >
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </>
        )}
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
  const [modo, setModo] = useState('avulsa'); // 'avulsa' | 'mensalista'
  const [horarios, setHorarios] = useState([]);
  const [horarioEscolhido, setHorarioEscolhido] = useState(horarioPreselecionado || null);
  const [modalidade, setModalidade] = useState(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(false);
  const [sugestoesNome, setSugestoesNome] = useState([]);
  const [valor, setValor] = useState('');
  const [valorMensal, setValorMensal] = useState('');
  const [statusPagamento, setStatusPagamento] = useState('pendente');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const diaSemana = new Date(`${data}T00:00:00`).getDay();

  useEffect(() => {
    if (!horarioPreselecionado) {
      buscarHorariosDisponiveis(quadra.id, data).then(setHorarios);
    }
  }, [quadra, data]);

  useEffect(() => {
    if (modo === 'avulsa' && modalidade && horarioEscolhido) {
      const info = modalidades.find((m) => m.modalidade === modalidade);
      const noturno = horarioEscolhido.hora_inicio >= (horaInicioNoturno || '18:00');
      setValor(info ? (noturno ? info.valor_noturno : info.valor_diurno) : 0);
    }
  }, [modo, modalidade, horarioEscolhido]);

  // Busca cliente já cadastrado pelo telefone e preenche nome/email/cpf automaticamente
  async function buscarClientePorTelefone() {
    if (!telefone) return;
    const { data: cliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', telefone)
      .maybeSingle();
    if (cliente) {
      setNome(cliente.nome || '');
      setEmail(cliente.email || '');
      setCpf(cliente.cpf || '');
      setClienteEncontrado(true);
    } else {
      setClienteEncontrado(false);
    }
  }

  // Busca sugestões de clientes existentes conforme o nome é digitado
  useEffect(() => {
    if (clienteEncontrado || nome.trim().length < 2) {
      setSugestoesNome([]);
      return;
    }
    const atraso = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .ilike('nome', `%${nome.trim()}%`)
        .limit(5);
      setSugestoesNome(data || []);
    }, 300);
    return () => clearTimeout(atraso);
  }, [nome, clienteEncontrado]);

  function selecionarSugestao(cliente) {
    setNome(cliente.nome || '');
    setTelefone(cliente.telefone || '');
    setEmail(cliente.email || '');
    setCpf(cliente.cpf || '');
    setClienteEncontrado(true);
    setSugestoesNome([]);
  }

  async function encontrarOuCriarCliente() {
    let { data: clienteExistente } = await supabase
      .from('clientes').select('id').eq('telefone', telefone).maybeSingle();

    if (clienteExistente?.id) {
      // atualiza os dados, caso tenham sido complementados/corrigidos aqui
      await supabase.from('clientes').update({ nome, email: email || null, cpf: cpf || null }).eq('id', clienteExistente.id);
      return clienteExistente.id;
    }

    const { data: novoCliente, error: erroCliente } = await supabase
      .from('clientes').insert({ nome, telefone, email: email || null, cpf: cpf || null }).select('id').single();
    if (erroCliente) throw erroCliente;
    return novoCliente.id;
  }

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      const clienteId = await encontrarOuCriarCliente();

      if (modo === 'mensalista') {
        const { error } = await supabase.from('mensalistas').insert({
          cliente_id: clienteId,
          quadra_id: quadra.id,
          modalidade,
          dia_semana: diaSemana,
          hora_inicio: horarioEscolhido.hora_inicio,
          hora_fim: horarioEscolhido.hora_fim,
          valor_mensal: valorMensal,
        });
        if (error) throw error;
        onCriada();
        return;
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
      setErro(e.message || 'Erro ao salvar.');
    } finally {
      setEnviando(false);
    }
  }

  const podeSalvar = modo === 'mensalista'
    ? !!(horarioEscolhido && modalidade && nome && telefone && valorMensal)
    : !!(horarioEscolhido && modalidade && nome && telefone);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl tracking-wide mb-1">{quadra.nome}</h3>
        <p className="text-areia-muted text-sm mb-4">
          {DIAS_SEMANA[diaSemana]}-feira, {data.split('-').reverse().join('/')}
          {horarioPreselecionado && ` · ${horarioPreselecionado.hora_inicio}–${horarioPreselecionado.hora_fim}`}
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setModo('avulsa')}
            className={`flex-1 text-sm font-semibold px-3 py-2 rounded-full ${modo === 'avulsa' ? 'bg-coral text-night' : 'bg-night text-areia-muted'}`}
          >
            Reserva avulsa
          </button>
          <button
            onClick={() => setModo('mensalista')}
            className={`flex-1 text-sm font-semibold px-3 py-2 rounded-full ${modo === 'mensalista' ? 'bg-coral text-night' : 'bg-night text-areia-muted'}`}
          >
            Mensalista
          </button>
        </div>

        {modo === 'mensalista' && (
          <p className="text-volei text-xs mb-4">
            Vai virar um horário fixo toda {DIAS_SEMANA[diaSemana]}-feira, às {horarioPreselecionado?.hora_inicio}, nessa quadra. Dá pra ajustar tudo depois na aba Mensalistas.
          </p>
        )}

        {!horarioPreselecionado && (
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

        <div className="grid grid-cols-2 gap-3 mb-1">
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">Telefone</span>
            <input
              value={telefone}
              onChange={(e) => { setTelefone(e.target.value); setClienteEncontrado(false); }}
              onBlur={buscarClientePorTelefone}
              className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full"
            />
          </label>
          <label className="block relative">
            <span className="text-sm text-areia-muted block mb-1">Nome</span>
            <input
              value={nome}
              onChange={(e) => { setNome(e.target.value); setClienteEncontrado(false); }}
              className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full"
              autoComplete="off"
            />
            {sugestoesNome.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-night border border-night-line rounded-lg z-10 overflow-hidden">
                {sugestoesNome.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => selecionarSugestao(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-night-line/40 border-b border-night-line last:border-0"
                  >
                    <span className="font-semibold">{c.nome}</span>
                    <span className="text-areia-muted"> · {c.telefone}</span>
                  </button>
                ))}
              </div>
            )}
          </label>
        </div>
        {clienteEncontrado && (
          <p className="text-sucesso text-xs mb-2">Cliente já cadastrado — dados preenchidos automaticamente.</p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">E-mail (opcional)</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">CPF (opcional)</span>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
        </div>

        {modo === 'avulsa' ? (
          <>
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
          </>
        ) : (
          <label className="block mb-4">
            <span className="text-sm text-areia-muted block mb-1">Valor mensal (R$)</span>
            <input type="number" value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
        )}

        {erro && <p className="text-erro text-sm mb-3">{erro}</p>}

        <div className="flex justify-between gap-3">
          <button onClick={onFechar} className="text-areia-muted hover:text-areia px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={!podeSalvar || enviando}
            className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-2 rounded-full"
          >
            {enviando ? 'Salvando...' : modo === 'mensalista' ? 'Salvar mensalista' : 'Salvar reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}
