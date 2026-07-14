'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

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

  async function desativarMensalista(id) {
    if (!confirm('Desativar esse mensalista? O horário fixo dele deixa de aparecer na agenda.')) return;
    await supabase.from('mensalistas').update({ ativo: false }).eq('id', id);
    carregar();
  }

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

      <div className="space-y-2">
        {mensalistas.map((m) => {
          const pagamento = mensalidades[m.id];
          return (
            <div key={m.id} className="bg-night-panel border border-night-line rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold">{m.clientes?.nome} <span className="text-areia-muted font-normal">· {m.clientes?.telefone}</span></p>
                <p className="text-areia-muted text-sm">
                  {m.quadras?.nome} · {NOMES_MODALIDADE[m.modalidade]} · {DIAS_SEMANA[m.dia_semana]} {m.hora_inicio.slice(0, 5)}–{m.hora_fim.slice(0, 5)}
                </p>
              </div>
              <div className="flex items-center gap-3">
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
                <button onClick={() => desativarMensalista(m.id)} className="text-areia-muted hover:text-erro text-xs">
                  Desativar
                </button>
              </div>
            </div>
          );
        })}
        {mensalistas.length === 0 && !carregando && (
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
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

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
