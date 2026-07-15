'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { verificarConflitoMensalista } from '@/lib/disponibilidade';

const NOMES_MODALIDADE = {
  altinha: 'Altinha',
  futevolei: 'Futevôlei',
  volei: 'Vôlei',
  beach_tenis: 'Beach Tênis',
};

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function primeiroDiaDoMes(mesReferencia) {
  return `${mesReferencia}-01`;
}

export default function Mensalistas({ quadras, modalidades }) {
  const hoje = new Date();
  const [mesReferencia, setMesReferencia] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  );
  const [mensalistas, setMensalistas] = useState([]);
  const [mensalidades, setMensalidades] = useState({}); // { mensalista_id: linha }
  const [carregando, setCarregando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null); // { clienteId, nome, telefone }

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: lista } = await supabase
      .from('mensalistas')
      .select('*, clientes(nome, telefone), quadras(nome)')
      .eq('ativo', true)
      .order('dia_semana');

    const { data: pagamentos } = await supabase
      .from('mensalidades')
      .select('*')
      .eq('mes_referencia', primeiroDiaDoMes(mesReferencia));

    const mapa = {};
    (pagamentos || []).forEach((p) => { mapa[p.mensalista_id] = p; });

    setMensalistas(lista || []);
    setMensalidades(mapa);
    setCarregando(false);
  }, [mesReferencia]);

  useEffect(() => { carregar(); }, [carregar]);

  async function gerarCobrancasDoMes() {
    const linhas = mensalistas
      .filter((m) => !mensalidades[m.id])
      .map((m) => ({
        mensalista_id: m.id,
        mes_referencia: primeiroDiaDoMes(mesReferencia),
        valor: m.valor_mensal,
        status: 'pendente',
      }));
    if (linhas.length === 0) return;
    await supabase.from('mensalidades').insert(linhas);
    carregar();
  }

  async function alternarPagamento(mensalistaId) {
    const atual = mensalidades[mensalistaId];
    if (!atual) return;
    const novoStatus = atual.status === 'pago' ? 'pendente' : 'pago';
    await supabase
      .from('mensalidades')
      .update({
        status: novoStatus,
        data_pagamento: novoStatus === 'pago' ? new Date().toISOString() : null,
      })
      .eq('id', atual.id);
    carregar();
  }

  // Agrupa os horários (linhas de mensalistas) por cliente, pra mostrar um card por pessoa
  const porCliente = {};
  mensalistas.forEach((m) => {
    if (!porCliente[m.cliente_id]) {
      porCliente[m.cliente_id] = {
        clienteId: m.cliente_id,
        nome: m.clientes?.nome,
        telefone: m.clientes?.telefone,
        slots: [],
      };
    }
    porCliente[m.cliente_id].slots.push(m);
  });
  const listaClientes = Object.values(porCliente);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <input
          type="month"
          value={mesReferencia}
          onChange={(e) => setMesReferencia(e.target.value)}
          className="bg-night-panel border border-night-line rounded-lg px-4 py-2 text-areia"
        />
        <div className="flex gap-2">
          <button onClick={gerarCobrancasDoMes} className="bg-night-panel border border-night-line hover:border-areia-muted text-sm px-4 py-2 rounded-full">
            Gerar cobranças do mês
          </button>
          <button onClick={() => setMostrarForm(true)} className="bg-coral hover:bg-coral-hover text-night font-semibold text-sm px-4 py-2 rounded-full">
            + Novo mensalista
          </button>
        </div>
      </div>

      {carregando && <p className="text-areia-muted">Carregando...</p>}

      <div className="space-y-3">
        {listaClientes.map((c) => (
          <div key={c.clienteId} className="bg-night-panel border border-night-line rounded-xl p-4">
            <button
              onClick={() => setClienteEditando({ clienteId: c.clienteId, nome: c.nome, telefone: c.telefone })}
              className="font-semibold hover:text-coral transition-colors text-left"
            >
              {c.nome}
            </button>
            <span className="text-areia-muted text-sm"> · {c.telefone}</span>

            <div className="mt-2 space-y-1.5">
              {c.slots.map((m) => {
                const pagamento = mensalidades[m.id];
                return (
                  <div key={m.id} className="flex items-center justify-between flex-wrap gap-2 text-sm bg-night rounded-lg px-3 py-2">
                    <span className="text-areia-muted">
                      {m.quadras?.nome} · {NOMES_MODALIDADE[m.modalidade]} · {DIAS_SEMANA[m.dia_semana]} {m.hora_inicio.slice(0, 5)}–{m.hora_fim.slice(0, 5)}
                    </span>
                    {pagamento ? (
                      <button
                        onClick={() => alternarPagamento(m.id)}
                        className={`text-xs px-3 py-1 rounded-full ${
                          pagamento.status === 'pago' ? 'bg-sucesso/20 text-sucesso' : 'bg-aviso/20 text-aviso'
                        }`}
                      >
                        {pagamento.status === 'pago' ? '✓ Pago' : 'Pendente'} · R$ {Number(pagamento.valor).toFixed(2)}
                      </button>
                    ) : (
                      <span className="text-xs text-areia-muted">Sem cobrança gerada</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {listaClientes.length === 0 && !carregando && (
          <p className="text-areia-muted text-sm">Nenhum mensalista ativo.</p>
        )}
      </div>

      {mostrarForm && (
        <NovoMensalistaModal
          quadras={quadras}
          modalidades={modalidades}
          onFechar={() => setMostrarForm(false)}
          onCriado={() => { setMostrarForm(false); carregar(); }}
        />
      )}

      {clienteEditando && (
        <EditarClienteModal
          clienteId={clienteEditando.clienteId}
          quadras={quadras}
          modalidades={modalidades}
          onFechar={() => setClienteEditando(null)}
          onAtualizado={carregar}
        />
      )}
    </div>
  );
}

function EditarClienteModal({ clienteId, quadras, modalidades, onFechar, onAtualizado }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [slots, setSlots] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [salvandoSlot, setSalvandoSlot] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
    if (cliente) {
      setNome(cliente.nome);
      setTelefone(cliente.telefone);
      setEmail(cliente.email || '');
      setCpf(cliente.cpf || '');
    }

    const { data: lista } = await supabase
      .from('mensalistas')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('dia_semana');
    setSlots(lista || []);
    setCarregando(false);
  }, [clienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvarCliente() {
    setSalvandoCliente(true);
    setErro(null);
    const { error } = await supabase
      .from('clientes')
      .update({ nome, telefone, email: email || null, cpf: cpf || null })
      .eq('id', clienteId);
    setSalvandoCliente(false);
    if (error) { setErro(error.message); return; }
    onAtualizado();
  }

  function atualizarSlotLocal(id, campo, valor) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)));
  }

  async function salvarSlot(slot) {
    setSalvandoSlot(slot.id);
    setErro(null);

    const conflito = await verificarConflitoMensalista({
      quadraId: slot.quadra_id,
      diaSemana: Number(slot.dia_semana),
      horaInicio: slot.hora_inicio.slice(0, 5),
      horaFim: slot.hora_fim.slice(0, 5),
      excluirMensalistaId: slot.id,
    });
    if (conflito) {
      setSalvandoSlot(null);
      setErro(conflito);
      return;
    }

    const { error } = await supabase
      .from('mensalistas')
      .update({
        quadra_id: slot.quadra_id,
        modalidade: slot.modalidade,
        dia_semana: Number(slot.dia_semana),
        hora_inicio: slot.hora_inicio,
        hora_fim: slot.hora_fim,
        valor_mensal: slot.valor_mensal,
      })
      .eq('id', slot.id);
    setSalvandoSlot(null);
    if (error) { setErro(error.message); return; }
    onAtualizado();
  }

  async function removerSlot(id) {
    if (!confirm('Remover esse horário do mensalista? Ele deixa de aparecer na agenda.')) return;
    await supabase.from('mensalistas').update({ ativo: false }).eq('id', id);
    setSlots((prev) => prev.filter((s) => s.id !== id));
    onAtualizado();
  }

  async function adicionarSlot() {
    const { data, error } = await supabase
      .from('mensalistas')
      .insert({
        cliente_id: clienteId,
        quadra_id: quadras[0]?.id,
        modalidade: modalidades[0]?.modalidade,
        dia_semana: 1,
        hora_inicio: '19:00',
        hora_fim: '20:00',
        valor_mensal: 0,
      })
      .select('*')
      .single();
    if (error) { setErro(error.message); return; }
    setSlots((prev) => [...prev, data]);
    onAtualizado();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl tracking-wide mb-4">EDITAR MENSALISTA</h3>

        {carregando ? (
          <p className="text-areia-muted">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">Nome</span>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
              </label>
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">Telefone</span>
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
              </label>
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">E-mail (opcional)</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
              </label>
              <label className="block">
                <span className="text-sm text-areia-muted block mb-1">CPF (opcional)</span>
                <input value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
              </label>
            </div>
            <button
              onClick={salvarCliente}
              disabled={salvandoCliente}
              className="text-coral hover:text-coral-hover text-sm mb-6"
            >
              {salvandoCliente ? 'Salvando...' : 'Salvar dados do cliente'}
            </button>

            <h4 className="font-semibold text-sm text-areia-muted mb-2 uppercase tracking-wide">Horários fixos</h4>
            <div className="space-y-3 mb-4">
              {slots.map((slot) => (
                <div key={slot.id} className="bg-night rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-areia-muted block mb-1">Quadra</span>
                      <select
                        value={slot.quadra_id}
                        onChange={(e) => atualizarSlotLocal(slot.id, 'quadra_id', e.target.value)}
                        className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-full text-sm"
                      >
                        {quadras.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-areia-muted block mb-1">Modalidade</span>
                      <select
                        value={slot.modalidade}
                        onChange={(e) => atualizarSlotLocal(slot.id, 'modalidade', e.target.value)}
                        className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-full text-sm"
                      >
                        {modalidades.map((m) => <option key={m.modalidade} value={m.modalidade}>{NOMES_MODALIDADE[m.modalidade]}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="text-xs text-areia-muted block mb-1">Dia</span>
                      <select
                        value={slot.dia_semana}
                        onChange={(e) => atualizarSlotLocal(slot.id, 'dia_semana', e.target.value)}
                        className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-full text-sm"
                      >
                        {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-areia-muted block mb-1">Início</span>
                      <input
                        type="time"
                        value={slot.hora_inicio?.slice(0, 5) || ''}
                        onChange={(e) => atualizarSlotLocal(slot.id, 'hora_inicio', e.target.value)}
                        className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-full text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-areia-muted block mb-1">Fim</span>
                      <input
                        type="time"
                        value={slot.hora_fim?.slice(0, 5) || ''}
                        onChange={(e) => atualizarSlotLocal(slot.id, 'hora_fim', e.target.value)}
                        className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-full text-sm"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-areia-muted flex-1">
                      Valor mensal R$
                      <input
                        type="number"
                        step="0.01"
                        value={slot.valor_mensal}
                        onChange={(e) => atualizarSlotLocal(slot.id, 'valor_mensal', e.target.value)}
                        className="bg-night-panel border border-night-line rounded-lg px-2 py-1.5 text-areia w-24 text-sm"
                      />
                    </label>
                    <button
                      onClick={() => salvarSlot(slot)}
                      disabled={salvandoSlot === slot.id}
                      className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold text-xs px-3 py-1.5 rounded-full"
                    >
                      {salvandoSlot === slot.id ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => removerSlot(slot.id)}
                      className="text-erro hover:opacity-80 text-xs px-2"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              {slots.length === 0 && <p className="text-areia-muted text-sm">Nenhum horário ativo.</p>}
            </div>

            <button
              onClick={adicionarSlot}
              className="text-coral hover:text-coral-hover text-sm font-semibold mb-4"
            >
              + Adicionar outro horário pra esse mensalista
            </button>

            {erro && <p className="text-erro text-sm mb-3">{erro}</p>}
          </>
        )}

        <div className="flex justify-end pt-2 border-t border-night-line mt-2">
          <button onClick={onFechar} className="text-areia-muted hover:text-areia px-4 py-2 text-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function NovoMensalistaModal({ quadras, modalidades, onFechar, onCriado }) {
  const [quadraId, setQuadraId] = useState(quadras[0]?.id || '');
  const [modalidade, setModalidade] = useState('');
  const [diaSemana, setDiaSemana] = useState(1);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [valorMensal, setValorMensal] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      const conflito = await verificarConflitoMensalista({
        quadraId,
        diaSemana,
        horaInicio,
        horaFim,
      });
      if (conflito) {
        setErro(conflito);
        return;
      }

      let { data: clienteExistente } = await supabase
        .from('clientes').select('id').eq('telefone', telefone).maybeSingle();

      let clienteId = clienteExistente?.id;
      if (!clienteId) {
        const { data: novoCliente, error: erroCliente } = await supabase
          .from('clientes').insert({ nome, telefone, email: email || null, cpf: cpf || null }).select('id').single();
        if (erroCliente) throw erroCliente;
        clienteId = novoCliente.id;
      }

      const { error } = await supabase.from('mensalistas').insert({
        cliente_id: clienteId,
        quadra_id: quadraId,
        modalidade,
        dia_semana: diaSemana,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        valor_mensal: valorMensal,
      });
      if (error) throw error;
      onCriado();
    } catch (e) {
      setErro(e.message || 'Erro ao salvar mensalista.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl tracking-wide mb-4">NOVO MENSALISTA</h3>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">Telefone</span>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">E-mail (opcional)</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">CPF (opcional)</span>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
        </div>

        <label className="block mb-3">
          <span className="text-sm text-areia-muted block mb-1">Quadra</span>
          <select value={quadraId} onChange={(e) => setQuadraId(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full">
            {quadras.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
          </select>
        </label>

        <label className="block mb-3">
          <span className="text-sm text-areia-muted block mb-1">Modalidade</span>
          <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full">
            <option value="">Selecione</option>
            {modalidades.map((m) => <option key={m.modalidade} value={m.modalidade}>{NOMES_MODALIDADE[m.modalidade]}</option>)}
          </select>
        </label>

        <label className="block mb-3">
          <span className="text-sm text-areia-muted block mb-1">Dia da semana</span>
          <select value={diaSemana} onChange={(e) => setDiaSemana(Number(e.target.value))} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full">
            {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">Hora início</span>
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
          <label className="block">
            <span className="text-sm text-areia-muted block mb-1">Hora fim</span>
            <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
          </label>
        </div>

        <label className="block mb-4">
          <span className="text-sm text-areia-muted block mb-1">Valor mensal (R$)</span>
          <input type="number" value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full" />
        </label>

        {erro && <p className="text-erro text-sm mb-3">{erro}</p>}

        <div className="flex justify-between gap-3">
          <button onClick={onFechar} className="text-areia-muted hover:text-areia px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={!quadraId || !modalidade || !horaInicio || !horaFim || !valorMensal || !nome || !telefone || enviando}
            className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-2 rounded-full"
          >
            {enviando ? 'Salvando...' : 'Salvar mensalista'}
          </button>
        </div>
      </div>
    </div>
  );
}
