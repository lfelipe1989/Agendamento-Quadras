'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { buscarSlotsDoDia, buscarHorariosDisponiveisChurrasqueira } from '@/lib/disponibilidade';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function dataParaString(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function chaveSlot(churrasqueiraId, horaInicio) {
  return `${churrasqueiraId}|${horaInicio}`;
}

function gerarGrupoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Churrasqueiras() {
  const [churrasqueiras, setChurrasqueiras] = useState([]);
  const [data, setData] = useState(dataParaString(new Date()));
  const [slots, setSlots] = useState([]);
  const [itensPorChurrasqueira, setItensPorChurrasqueira] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [mostrarModal, setMostrarModal] = useState(false);
  const [reservaEditando, setReservaEditando] = useState(null); // { item, churrasqueira }
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  const hojeStr = dataParaString(new Date());
  const ehHoje = data === hojeStr;

  useEffect(() => {
    supabase.from('churrasqueiras').select('*').eq('ativa', true).order('ordem').then(({ data }) => setChurrasqueiras(data || []));
  }, []);

  const carregar = useCallback(async () => {
    if (churrasqueiras.length === 0) return;
    setCarregando(true);

    const slotsDoDia = await buscarSlotsDoDia(data);
    setSlots(slotsDoDia);

    const resultado = {};
    for (const c of churrasqueiras) {
      const { data: reservas } = await supabase
        .from('reservas_churrasqueira')
        .select('id, grupo_id, hora_inicio, hora_fim, observacao, clientes(nome, telefone)')
        .eq('churrasqueira_id', c.id)
        .eq('data', data)
        .neq('status_reserva', 'cancelada')
        .order('hora_inicio');

      const mapaPorHorario = {};
      slotsDoDia.forEach((slot) => {
        const item = (reservas || []).find(
          (it) => slot.hora_inicio >= it.hora_inicio.slice(0, 5) && slot.hora_inicio < it.hora_fim.slice(0, 5)
        );
        if (item) mapaPorHorario[slot.hora_inicio] = item;
      });
      resultado[c.id] = mapaPorHorario;
    }
    setItensPorChurrasqueira(resultado);
    setCarregando(false);
  }, [churrasqueiras, data]);

  useEffect(() => { carregar(); setSelecionados(new Set()); }, [carregar]);

  function mudarDia(delta) {
    const d = new Date(`${data}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setData(dataParaString(d));
  }

  function formatarDataExtenso(d) {
    const [ano, mes, dia] = d.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  function alternarSelecao(churrasqueiraId, horaInicio) {
    const chave = chaveSlot(churrasqueiraId, horaInicio);
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  const listaSelecionados = Array.from(selecionados).map((chave) => {
    const [churrasqueiraId, horaInicio] = chave.split('|');
    const churrasqueira = churrasqueiras.find((c) => c.id === churrasqueiraId);
    const slot = slots.find((s) => s.hora_inicio === horaInicio);
    return { churrasqueiraId, churrasqueira, horaInicio, horaFim: slot?.hora_fim };
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-1">
        <button onClick={() => mudarDia(-1)} className="w-9 h-9 flex items-center justify-center rounded-full border border-night-line hover:border-areia-muted text-lg">‹</button>
        <div className="relative">
          <button onClick={() => setMostrarCalendario((v) => !v)} className="font-display text-2xl tracking-wide px-2">
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
        <button onClick={() => mudarDia(1)} className="w-9 h-9 flex items-center justify-center rounded-full border border-night-line hover:border-areia-muted text-lg">›</button>
      </div>
      <p className="text-areia-muted text-sm mb-2">{DIAS_SEMANA[new Date(`${data}T00:00:00`).getDay()]}-feira · {formatarDataExtenso(data)}</p>
      <p className="text-areia-muted text-xs mb-6">Clique nos horários livres pra reservar a churrasqueira (pode selecionar vários horários de uma vez).</p>

      {carregando && <p className="text-areia-muted mb-4">Carregando...</p>}
      {!carregando && slots.length === 0 && <p className="text-aviso text-sm mb-4">Fechado nesse dia.</p>}

      {slots.length > 0 && churrasqueiras.length > 0 && (
        <div className="overflow-x-auto bg-night-panel border border-night-line rounded-2xl mb-24">
          <div className="grid min-w-[400px]" style={{ gridTemplateColumns: `70px repeat(${churrasqueiras.length}, 1fr)` }}>
            <div className="border-b border-r border-night-line p-2" />
            {churrasqueiras.map((c) => (
              <div key={c.id} className="border-b border-night-line p-2 text-center font-semibold text-sm">{c.nome}</div>
            ))}

            {slots.map((slot) => (
              <div key={slot.hora_inicio} className="contents">
                <div className="border-r border-b border-night-line p-2 text-xs text-areia-muted flex items-start">{slot.hora_inicio}</div>
                {churrasqueiras.map((c) => {
                  const item = itensPorChurrasqueira[c.id]?.[slot.hora_inicio];
                  const chave = chaveSlot(c.id, slot.hora_inicio);
                  const selecionado = selecionados.has(chave);

                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (item) setReservaEditando({ item, churrasqueira: c });
                        else alternarSelecao(c.id, slot.hora_inicio);
                      }}
                      style={
                        item
                          ? { backgroundColor: '#f59e0b26', borderLeft: '3px solid #f59e0b', color: '#f59e0b' }
                          : selecionado
                          ? { backgroundColor: '#FF6B4A33', borderLeft: '3px solid #FF6B4A', color: '#FF6B4A' }
                          : undefined
                      }
                      className={`border-b border-night-line p-2 text-left text-xs min-h-[52px] transition-colors ${
                        !item ? 'hover:bg-night-line/40' : 'hover:brightness-125'
                      }`}
                    >
                      {item ? (
                        <>
                          <div className="font-semibold truncate">{item.clientes?.nome}</div>
                          <div className="opacity-90 truncate">Reservada</div>
                        </>
                      ) : selecionado ? (
                        <span className="font-semibold">selecionado</span>
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

      {selecionados.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-night-panel border-t border-night-line p-4 flex items-center justify-between z-30">
          <span className="text-sm text-areia-muted">
            {selecionados.size} horário{selecionados.size > 1 ? 's' : ''} selecionado{selecionados.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-3">
            <button onClick={() => setSelecionados(new Set())} className="text-areia-muted hover:text-areia text-sm px-3 py-2">Limpar seleção</button>
            <button onClick={() => setMostrarModal(true)} className="bg-coral hover:bg-coral-hover text-night font-semibold text-sm px-6 py-2 rounded-full">
              Criar reserva
            </button>
          </div>
        </div>
      )}

      {mostrarModal && (
        <NovaReservaChurrasqueiraModal
          data={data}
          slotsSelecionados={listaSelecionados}
          onFechar={() => setMostrarModal(false)}
          onCriado={() => { setMostrarModal(false); setSelecionados(new Set()); carregar(); }}
        />
      )}

      {reservaEditando && (
        <EditarReservaChurrasqueiraModal
          item={reservaEditando.item}
          churrasqueira={reservaEditando.churrasqueira}
          churrasqueiras={churrasqueiras}
          data={data}
          onFechar={() => setReservaEditando(null)}
          onAtualizado={() => { setReservaEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}

function BuscaCliente({ telefone, setTelefone, nome, setNome, email, setEmail, cpf, setCpf, clienteEncontrado, setClienteEncontrado }) {
  const [sugestoesNome, setSugestoesNome] = useState([]);

  async function buscarClientePorTelefone() {
    if (!telefone) return;
    const { data: cliente } = await supabase.from('clientes').select('*').eq('telefone', telefone).maybeSingle();
    if (cliente) {
      setNome(cliente.nome || '');
      setEmail(cliente.email || '');
      setCpf(cliente.cpf || '');
      setClienteEncontrado(true);
    } else {
      setClienteEncontrado(false);
    }
  }

  useEffect(() => {
    if (clienteEncontrado || nome.trim().length < 2) {
      setSugestoesNome([]);
      return;
    }
    const atraso = setTimeout(async () => {
      const { data } = await supabase.from('clientes').select('*').ilike('nome', `%${nome.trim()}%`).limit(5);
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

  return (
    <>
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
      {clienteEncontrado && <p className="text-sucesso text-xs mb-2">Cliente já cadastrado — dados preenchidos automaticamente.</p>}
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
    </>
  );
}

function NovaReservaChurrasqueiraModal({ data, slotsSelecionados, onFechar, onCriado }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [observacao, setObservacao] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      let clienteId;
      const { data: clienteExistente } = await supabase.from('clientes').select('id').eq('telefone', telefone).maybeSingle();
      if (clienteExistente?.id) {
        await supabase.from('clientes').update({ nome, email: email || null, cpf: cpf || null }).eq('id', clienteExistente.id);
        clienteId = clienteExistente.id;
      } else {
        const { data: novoCliente, error: erroCliente } = await supabase
          .from('clientes').insert({ nome, telefone, email: email || null, cpf: cpf || null }).select('id').single();
        if (erroCliente) throw erroCliente;
        clienteId = novoCliente.id;
      }

      const grupoId = gerarGrupoId();
      const falhas = [];
      for (const slot of slotsSelecionados) {
        const { error } = await supabase.from('reservas_churrasqueira').insert({
          grupo_id: grupoId,
          churrasqueira_id: slot.churrasqueiraId,
          cliente_id: clienteId,
          data,
          hora_inicio: slot.horaInicio,
          hora_fim: slot.horaFim,
          observacao: observacao || null,
        });
        if (error) falhas.push(`${slot.churrasqueira?.nome} ${slot.horaInicio}`);
      }

      if (falhas.length === slotsSelecionados.length) {
        setErro('Não foi possível salvar nenhum horário. Eles podem ter sido ocupados nesse meio tempo.');
        return;
      }
      if (falhas.length > 0) {
        setErro(`Alguns horários não puderam ser reservados (já ocupados): ${falhas.join(', ')}`);
        return;
      }
      onCriado();
    } catch (e) {
      setErro(e.message || 'Erro ao criar reserva.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl tracking-wide mb-1">NOVA RESERVA DE CHURRASQUEIRA</h3>
        <p className="text-areia-muted text-xs mb-4">{slotsSelecionados.length} horário{slotsSelecionados.length > 1 ? 's' : ''} selecionado{slotsSelecionados.length > 1 ? 's' : ''}:</p>
        <div className="bg-night rounded-lg p-3 mb-4 text-xs text-areia-muted space-y-1 max-h-24 overflow-y-auto">
          {slotsSelecionados.map((s) => (
            <div key={`${s.churrasqueiraId}-${s.horaInicio}`}>{s.churrasqueira?.nome} · {s.horaInicio}–{s.horaFim}</div>
          ))}
        </div>

        <BuscaCliente
          telefone={telefone} setTelefone={setTelefone}
          nome={nome} setNome={setNome}
          email={email} setEmail={setEmail}
          cpf={cpf} setCpf={setCpf}
          clienteEncontrado={clienteEncontrado} setClienteEncontrado={setClienteEncontrado}
        />

        <label className="block mb-4">
          <span className="text-sm text-areia-muted block mb-1">Observação (opcional)</span>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder="Ex: aniversário, confraternização de empresa..."
            className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full resize-none"
          />
        </label>

        {erro && <p className="text-erro text-sm mb-3">{erro}</p>}

        <div className="flex justify-between gap-3">
          <button onClick={onFechar} className="text-areia-muted hover:text-areia px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={!nome || !telefone || enviando}
            className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-2 rounded-full"
          >
            {enviando ? 'Salvando...' : 'Salvar reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditarReservaChurrasqueiraModal({ item, churrasqueira, churrasqueiras, data, onFechar, onAtualizado }) {
  const [modo, setModo] = useState('horario'); // 'horario' | 'grupo'
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // edição só desse horário
  const [horaData, setHoraData] = useState(data);
  const [horaChurrasqueiraId, setHoraChurrasqueiraId] = useState(churrasqueira.id);
  const [horarios, setHorarios] = useState([]);
  const [horarioEscolhido, setHorarioEscolhido] = useState({ hora_inicio: item.hora_inicio.slice(0, 5), hora_fim: item.hora_fim.slice(0, 5) });
  const [observacaoHorario, setObservacaoHorario] = useState(item.observacao || '');

  // edição do grupo inteiro
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [observacaoGrupo, setObservacaoGrupo] = useState('');
  const [novaData, setNovaData] = useState(data);
  const [slotsDoGrupo, setSlotsDoGrupo] = useState([]);
  const [clienteId, setClienteId] = useState(null);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const { data: slots } = await supabase
        .from('reservas_churrasqueira')
        .select('id, churrasqueira_id, data, hora_inicio, hora_fim, observacao, cliente_id, clientes(nome, telefone, email, cpf), churrasqueiras(nome)')
        .eq('grupo_id', item.grupo_id)
        .neq('status_reserva', 'cancelada')
        .order('data')
        .order('hora_inicio');
      setSlotsDoGrupo(slots || []);
      const primeiro = slots?.[0];
      if (primeiro) {
        setNome(primeiro.clientes?.nome || '');
        setTelefone(primeiro.clientes?.telefone || '');
        setEmail(primeiro.clientes?.email || '');
        setCpf(primeiro.clientes?.cpf || '');
        setClienteId(primeiro.cliente_id);
      }
      setCarregando(false);
    })();
  }, [item.grupo_id]);

  useEffect(() => {
    if (modo === 'horario' && horaChurrasqueiraId && horaData) {
      buscarHorariosDisponiveisChurrasqueira(horaChurrasqueiraId, horaData, item.id).then(setHorarios);
    }
  }, [modo, horaChurrasqueiraId, horaData, item.id]);

  async function salvarHorario() {
    setSalvando(true);
    setErro(null);
    try {
      if (!horarioEscolhido) throw new Error('Escolha um horário.');
      const { error } = await supabase
        .from('reservas_churrasqueira')
        .update({
          churrasqueira_id: horaChurrasqueiraId,
          data: horaData,
          hora_inicio: horarioEscolhido.hora_inicio,
          hora_fim: horarioEscolhido.hora_fim,
          observacao: observacaoHorario || null,
        })
        .eq('id', item.id);
      if (error) {
        if (error.code === '23P01') throw new Error('Esse horário já está ocupado nessa churrasqueira.');
        throw error;
      }
      onAtualizado();
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirSoEsseHorario() {
    if (!confirm('Excluir só esse horário? Os outros horários dessa reserva continuam normais.')) return;
    await supabase.from('reservas_churrasqueira').update({ status_reserva: 'cancelada' }).eq('id', item.id);
    onAtualizado();
  }

  async function salvarGrupo() {
    setSalvando(true);
    setErro(null);
    try {
      if (clienteId) {
        await supabase.from('clientes').update({ nome, email: email || null, cpf: cpf || null }).eq('id', clienteId);
      }
      await supabase.from('reservas_churrasqueira').update({ observacao: observacaoGrupo || null }).eq('grupo_id', item.grupo_id);

      if (novaData !== slotsDoGrupo[0]?.data) {
        const falhas = [];
        for (const slot of slotsDoGrupo) {
          const disponiveis = await buscarHorariosDisponiveisChurrasqueira(slot.churrasqueira_id, novaData, slot.id);
          const slotAlvo = disponiveis.find((h) => h.hora_inicio === slot.hora_inicio.slice(0, 5));
          if (slotAlvo && !slotAlvo.disponivel) {
            falhas.push(`${slot.churrasqueiras?.nome} ${slot.hora_inicio.slice(0, 5)}`);
            continue;
          }
          const { error } = await supabase.from('reservas_churrasqueira').update({ data: novaData }).eq('id', slot.id);
          if (error) falhas.push(`${slot.churrasqueiras?.nome} ${slot.hora_inicio.slice(0, 5)}`);
        }
        if (falhas.length > 0) {
          setErro(`Dados salvos, mas alguns horários não puderam mudar de data (já ocupados no novo dia): ${falhas.join(', ')}`);
          return;
        }
      }
      onAtualizado();
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirGrupoInteiro() {
    if (!confirm(`Excluir a reserva inteira? Isso libera todos os ${slotsDoGrupo.length} horário(s) vinculados.`)) return;
    await supabase.from('reservas_churrasqueira').update({ status_reserva: 'cancelada' }).eq('grupo_id', item.grupo_id);
    onAtualizado();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl tracking-wide mb-4">EDITAR RESERVA</h3>

        {carregando ? (
          <p className="text-areia-muted">Carregando...</p>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setModo('horario')}
                className={`flex-1 text-sm font-semibold px-3 py-2 rounded-full ${modo === 'horario' ? 'bg-coral text-night' : 'bg-night text-areia-muted'}`}
              >
                Só esse horário
              </button>
              <button
                onClick={() => setModo('grupo')}
                className={`flex-1 text-sm font-semibold px-3 py-2 rounded-full ${modo === 'grupo' ? 'bg-coral text-night' : 'bg-night text-areia-muted'}`}
              >
                Reserva inteira ({slotsDoGrupo.length} horários)
              </button>
            </div>

            {modo === 'horario' && (
              <>
                <p className="text-areia-muted text-xs mb-4">
                  Altera só esse horário específico ({churrasqueira.nome}, {item.hora_inicio.slice(0, 5)}).
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="block">
                    <span className="text-sm text-areia-muted block mb-1">Data</span>
                    <input type="date" value={horaData} onChange={(e) => { setHoraData(e.target.value); setHorarioEscolhido(null); }} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
                  </label>
                  <label className="block">
                    <span className="text-sm text-areia-muted block mb-1">Churrasqueira</span>
                    <select value={horaChurrasqueiraId} onChange={(e) => { setHoraChurrasqueiraId(e.target.value); setHorarioEscolhido(null); }} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full">
                      {churrasqueiras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </label>
                </div>
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
                <label className="block mb-4">
                  <span className="text-sm text-areia-muted block mb-1">Observação</span>
                  <textarea value={observacaoHorario} onChange={(e) => setObservacaoHorario(e.target.value)} rows={2} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full resize-none" />
                </label>

                {erro && <p className="text-erro text-sm mb-3">{erro}</p>}

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-night-line">
                  <button onClick={excluirSoEsseHorario} className="text-erro hover:opacity-80 text-sm px-2 py-2">Excluir só esse horário</button>
                  <div className="flex gap-3">
                    <button onClick={onFechar} className="text-areia-muted hover:text-areia px-3 py-2 text-sm">Fechar</button>
                    <button onClick={salvarHorario} disabled={!horarioEscolhido || salvando} className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-2 rounded-full">
                      {salvando ? 'Salvando...' : 'Salvar esse horário'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {modo === 'grupo' && (
              <>
                <p className="text-areia-muted text-xs mb-4">
                  Isso afeta todos os {slotsDoGrupo.length} horário(s): {slotsDoGrupo.map((s) => `${s.churrasqueiras?.nome} ${s.hora_inicio.slice(0, 5)}`).join(', ')}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="block">
                    <span className="text-sm text-areia-muted block mb-1">Telefone</span>
                    <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
                  </label>
                  <label className="block">
                    <span className="text-sm text-areia-muted block mb-1">Nome</span>
                    <input value={nome} onChange={(e) => setNome(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="block">
                    <span className="text-sm text-areia-muted block mb-1">E-mail</span>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
                  </label>
                  <label className="block">
                    <span className="text-sm text-areia-muted block mb-1">CPF</span>
                    <input value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
                  </label>
                </div>
                <label className="block mb-3">
                  <span className="text-sm text-areia-muted block mb-1">Observação</span>
                  <textarea value={observacaoGrupo} onChange={(e) => setObservacaoGrupo(e.target.value)} rows={3} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full resize-none" />
                </label>
                <label className="block mb-4">
                  <span className="text-sm text-areia-muted block mb-1">Mudar data de todos os horários</span>
                  <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
                </label>

                {erro && <p className="text-erro text-sm mb-3">{erro}</p>}

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-night-line">
                  <button onClick={excluirGrupoInteiro} className="text-erro hover:opacity-80 text-sm px-2 py-2">Excluir reserva inteira</button>
                  <div className="flex gap-3">
                    <button onClick={onFechar} className="text-areia-muted hover:text-areia px-3 py-2 text-sm">Fechar</button>
                    <button onClick={salvarGrupo} disabled={salvando} className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-2 rounded-full">
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
