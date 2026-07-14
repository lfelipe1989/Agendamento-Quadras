'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { buscarHorariosDisponiveis } from '@/lib/disponibilidade';

const NOMES_MODALIDADE = {
  altinha: 'Altinha',
  futevolei: 'Futevôlei',
  volei: 'Vôlei',
  beach_tenis: 'Beach Tênis',
};

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function AgendaDia({ quadras, modalidades }) {
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [itensPorQuadra, setItensPorQuadra] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [novaReservaQuadra, setNovaReservaQuadra] = useState(null);

  const carregar = useCallback(async () => {
    if (quadras.length === 0) return;
    setCarregando(true);
    const diaSemana = new Date(`${data}T00:00:00`).getDay();

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

      resultado[q.id] = [...itensAvulsos, ...itensMensalistas].sort((a, b) =>
        a.hora_inicio.localeCompare(b.hora_inicio)
      );
    }
    setItensPorQuadra(resultado);
    setCarregando(false);
  }, [quadras, data]);

  useEffect(() => { carregar(); }, [carregar]);

  async function alternarPagamento(item) {
    const novoStatus = item.status_pagamento === 'pago' ? 'pendente' : 'pago';
    await supabase.from('reservas').update({ status_pagamento: novoStatus }).eq('id', item.id);
    carregar();
  }

  async function cancelarReserva(item) {
    if (!confirm('Cancelar essa reserva?')) return;
    await supabase.from('reservas').update({ status_reserva: 'cancelada' }).eq('id', item.id);
    carregar();
  }

  return (
    <div>
      <input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        className="bg-night-panel border border-night-line rounded-lg px-4 py-2 text-areia mb-2"
      />
      <p className="text-areia-muted text-sm mb-6">{DIAS_SEMANA[new Date(`${data}T00:00:00`).getDay()]}-feira</p>

      {carregando && <p className="text-areia-muted">Carregando...</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quadras.map((q) => (
          <div key={q.id} className="bg-night-panel border border-night-line rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl tracking-wide">{q.nome}</h3>
              <button
                onClick={() => setNovaReservaQuadra(q)}
                className="text-coral text-sm font-semibold hover:text-coral-hover"
              >
                + Nova reserva
              </button>
            </div>

            <div className="space-y-2">
              {(itensPorQuadra[q.id] || []).length === 0 && (
                <p className="text-areia-muted text-sm">Nada agendado.</p>
              )}
              {(itensPorQuadra[q.id] || []).map((item) => (
                <div key={`${item.tipo}-${item.id}`} className="bg-night rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{item.hora_inicio.slice(0, 5)}–{item.hora_fim.slice(0, 5)}</span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: modalidades.find((m) => m.modalidade === item.modalidade)?.cor + '33', color: modalidades.find((m) => m.modalidade === item.modalidade)?.cor }}
                    >
                      {NOMES_MODALIDADE[item.modalidade]}
                    </span>
                  </div>
                  <p className="text-areia-muted">{item.clientes?.nome} · {item.clientes?.telefone}</p>

                  {item.tipo === 'mensalista' ? (
                    <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-volei/20 text-volei">
                      Mensalista
                    </span>
                  ) : (
                    <div className="flex items-center justify-between mt-2">
                      <button
                        onClick={() => alternarPagamento(item)}
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          item.status_pagamento === 'pago' ? 'bg-sucesso/20 text-sucesso' : 'bg-aviso/20 text-aviso'
                        }`}
                      >
                        {item.status_pagamento === 'pago' ? '✓ Pago' : 'Pendente'} · R$ {Number(item.valor).toFixed(2)}
                      </button>
                      <button
                        onClick={() => cancelarReserva(item)}
                        className="text-areia-muted hover:text-erro text-[11px]"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {novaReservaQuadra && (
        <NovaReservaModal
          quadra={novaReservaQuadra}
          data={data}
          modalidades={modalidades}
          onFechar={() => setNovaReservaQuadra(null)}
          onCriada={() => { setNovaReservaQuadra(null); carregar(); }}
        />
      )}
    </div>
  );
}

function NovaReservaModal({ quadra, data, modalidades, onFechar, onCriada }) {
  const [horarios, setHorarios] = useState([]);
  const [horarioEscolhido, setHorarioEscolhido] = useState(null);
  const [modalidade, setModalidade] = useState(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [valor, setValor] = useState('');
  const [statusPagamento, setStatusPagamento] = useState('pendente');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    buscarHorariosDisponiveis(quadra.id, data).then(setHorarios);
  }, [quadra, data]);

  useEffect(() => {
    if (modalidade) {
      const info = modalidades.find((m) => m.modalidade === modalidade);
      setValor(info?.valor_hora_avulsa || 0);
    }
  }, [modalidade]);

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
