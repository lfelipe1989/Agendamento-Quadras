'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { validarCodigoAcesso } from '@/lib/staffAuth';

const NOMES_MODALIDADE = {
  altinha: 'Altinha',
  futevolei: 'Futevôlei',
  volei: 'Vôlei',
  beach_tenis: 'Beach Tênis',
};

const NOMES_FORMA_PAGAMENTO = {
  pix: 'Pix',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  asaas_online: 'Asaas (online)',
  local: 'A combinar no local',
};

function primeiroDiaDoMes(mesReferencia) {
  return `${mesReferencia}-01`;
}

function ultimoDiaDoMes(mesReferencia) {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${mesReferencia}-${String(ultimoDia).padStart(2, '0')}`;
}

function formatarMoeda(v) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

export default function FinanceiroPage() {
  const [staff, setStaff] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  useEffect(() => {
    const salvo = sessionStorage.getItem('staffFinanceiro');
    if (salvo) setStaff(JSON.parse(salvo));
    setCarregandoSessao(false);
  }, []);

  function fazerLogout() {
    sessionStorage.removeItem('staffFinanceiro');
    setStaff(null);
  }

  if (carregandoSessao) return null;

  if (!staff) {
    return <TelaLogin onEntrar={(s) => { sessionStorage.setItem('staffFinanceiro', JSON.stringify(s)); setStaff(s); }} />;
  }

  return <RelatorioFinanceiro staff={staff} onLogout={fazerLogout} />;
}

function TelaLogin({ onEntrar }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(null);
  const [verificando, setVerificando] = useState(false);

  async function entrar() {
    setVerificando(true);
    setErro(null);
    const staff = await validarCodigoAcesso(codigo.trim());
    setVerificando(false);
    if (!staff) {
      setErro('Código inválido.');
      return;
    }
    onEntrar(staff);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-night text-areia">
      <div className="bg-night-panel border border-night-line rounded-2xl p-8 w-full max-w-sm">
        <h1 className="font-display text-3xl tracking-wide mb-1">FINANCEIRO</h1>
        <p className="text-areia-muted text-sm mb-6">Digite seu código de acesso</p>
        <input
          type="password"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && entrar()}
          className="bg-night border border-night-line rounded-lg px-4 py-3 text-areia w-full mb-3"
          placeholder="Código de acesso"
        />
        {erro && <p className="text-erro text-sm mb-3">{erro}</p>}
        <button
          onClick={entrar}
          disabled={!codigo || verificando}
          className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-3 rounded-full w-full transition-colors"
        >
          {verificando ? 'Verificando...' : 'Entrar'}
        </button>
      </div>
    </main>
  );
}

function RelatorioFinanceiro({ staff, onLogout }) {
  const hoje = new Date();
  const [mesReferencia, setMesReferencia] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  );
  const [reservas, setReservas] = useState([]);
  const [mensalidades, setMensalidades] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos | pago | pendente
  const [filtroNome, setFiltroNome] = useState('');
  const [editando, setEditando] = useState(null); // { tipo: 'reserva'|'mensalidade', item }
  const [dataInicioPeriodo, setDataInicioPeriodo] = useState('');
  const [dataFimPeriodo, setDataFimPeriodo] = useState('');

  const usandoPeriodo = !!(dataInicioPeriodo && dataFimPeriodo);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const inicio = usandoPeriodo ? dataInicioPeriodo : primeiroDiaDoMes(mesReferencia);
    const fim = usandoPeriodo ? dataFimPeriodo : ultimoDiaDoMes(mesReferencia);

    const { data: reservasDoMes } = await supabase
      .from('reservas')
      .select('id, data, hora_inicio, modalidade, valor, forma_pagamento, status_pagamento, origem, clientes(nome, telefone), quadras(nome)')
      .gte('data', inicio)
      .lte('data', fim)
      .neq('status_reserva', 'cancelada')
      .order('data');

    const { data: mensalidadesDoMes } = await supabase
      .from('mensalidades')
      .select('id, valor, status, forma_pagamento, data_pagamento, mensalistas(quadras(nome), clientes(nome, telefone))')
      .eq('mes_referencia', primeiroDiaDoMes(mesReferencia));

    setReservas(reservasDoMes || []);
    setMensalidades(mensalidadesDoMes || []);
    setCarregando(false);
  }, [mesReferencia, dataInicioPeriodo, dataFimPeriodo, usandoPeriodo]);

  useEffect(() => { carregar(); }, [carregar]);

  const reservasFiltradas = reservas.filter((r) =>
    (filtroStatus === 'todos' || r.status_pagamento === filtroStatus) &&
    (!filtroNome.trim() || r.clientes?.nome?.toLowerCase().includes(filtroNome.trim().toLowerCase()))
  );
  const mensalidadesFiltradas = mensalidades.filter((m) =>
    (filtroStatus === 'todos' || m.status === filtroStatus) &&
    (!filtroNome.trim() || m.mensalistas?.clientes?.nome?.toLowerCase().includes(filtroNome.trim().toLowerCase()))
  );

  const totalReservasPago = reservas.filter((r) => r.status_pagamento === 'pago').reduce((s, r) => s + Number(r.valor), 0);
  const totalReservasPendente = reservas.filter((r) => r.status_pagamento === 'pendente').reduce((s, r) => s + Number(r.valor), 0);
  const totalMensalidadesPago = mensalidades.filter((m) => m.status === 'pago').reduce((s, m) => s + Number(m.valor), 0);
  const totalMensalidadesPendente = mensalidades.filter((m) => m.status === 'pendente' || m.status === 'atrasado').reduce((s, m) => s + Number(m.valor), 0);

  const totalRecebido = totalReservasPago + totalMensalidadesPago;
  const totalPendente = totalReservasPendente + totalMensalidadesPendente;

  // Quebra por forma de pagamento (só do que já foi pago)
  const porFormaPagamento = {};
  [...reservas, ...mensalidades].forEach((item) => {
    if ((item.status_pagamento || item.status) !== 'pago') return;
    const forma = item.forma_pagamento || 'não informado';
    porFormaPagamento[forma] = (porFormaPagamento[forma] || 0) + Number(item.valor);
  });

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 bg-night text-areia">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl tracking-wide">FINANCEIRO</h1>
            <p className="text-areia-muted text-sm">Olá, {staff.nome}</p>
          </div>
          <button onClick={onLogout} className="text-areia-muted hover:text-areia text-sm">Sair</button>
        </div>

        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <input
            type="month"
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            disabled={usandoPeriodo}
            className="bg-night-panel border border-night-line rounded-lg px-4 py-2 text-areia disabled:opacity-40"
          />
          <input
            type="text"
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
            placeholder="Buscar por nome..."
            className="bg-night-panel border border-night-line rounded-lg px-3 py-2 text-areia text-sm min-w-[180px]"
          />
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="bg-night-panel border border-night-line rounded-lg px-3 py-2 text-areia text-sm"
          >
            <option value="todos">Todos os status</option>
            <option value="pago">Só pagos</option>
            <option value="pendente">Só pendentes</option>
          </select>
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span className="text-areia-muted text-xs">Período personalizado (só afeta reservas avulsas/eventos):</span>
          <input
            type="date"
            value={dataInicioPeriodo}
            onChange={(e) => setDataInicioPeriodo(e.target.value)}
            className="bg-night-panel border border-night-line rounded-lg px-3 py-1.5 text-areia text-sm"
          />
          <span className="text-areia-muted text-xs">até</span>
          <input
            type="date"
            value={dataFimPeriodo}
            onChange={(e) => setDataFimPeriodo(e.target.value)}
            className="bg-night-panel border border-night-line rounded-lg px-3 py-1.5 text-areia text-sm"
          />
          {usandoPeriodo && (
            <button
              onClick={() => { setDataInicioPeriodo(''); setDataFimPeriodo(''); }}
              className="text-areia-muted hover:text-areia text-xs"
            >
              Limpar período
            </button>
          )}
        </div>

        {carregando ? (
          <p className="text-areia-muted">Carregando...</p>
        ) : (
          <>
            {/* Resumo do mês */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <CartaoResumo titulo={usandoPeriodo ? 'Recebido no período' : 'Recebido no mês'} valor={totalRecebido} cor="sucesso" />
              <CartaoResumo titulo={usandoPeriodo ? 'Pendente no período' : 'Pendente no mês'} valor={totalPendente} cor="aviso" />
              <CartaoResumo titulo="Avulsas + eventos" valor={totalReservasPago} sub={`${reservas.filter((r) => r.status_pagamento === 'pago').length} pagas`} />
              <CartaoResumo titulo="Mensalidades" valor={totalMensalidadesPago} sub={`${mensalidades.filter((m) => m.status === 'pago').length} pagas`} />
            </div>

            {Object.keys(porFormaPagamento).length > 0 && (
              <div className="bg-night-panel border border-night-line rounded-xl p-4 mb-8">
                <p className="text-sm text-areia-muted mb-2">Recebido por forma de pagamento</p>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(porFormaPagamento).map(([forma, valor]) => (
                    <div key={forma} className="text-sm">
                      <span className="text-areia-muted">{NOMES_FORMA_PAGAMENTO[forma] || forma}:</span>{' '}
                      <span className="font-semibold">{formatarMoeda(valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reservas avulsas e eventos */}
            <h2 className="font-display text-xl tracking-wide mb-3">RESERVAS AVULSAS E EVENTOS</h2>
            <div className="bg-night-panel border border-night-line rounded-2xl divide-y divide-night-line overflow-hidden mb-8">
              {reservasFiltradas.length === 0 && <p className="text-areia-muted text-sm p-4">Nenhuma reserva nesse período/filtro.</p>}
              {reservasFiltradas.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setEditando({ tipo: 'reserva', item: r })}
                  className="w-full text-left p-3 flex items-center justify-between flex-wrap gap-2 text-sm hover:bg-night-line/30 transition-colors"
                >
                  <div>
                    <span className="font-semibold">{r.clientes?.nome}</span>
                    <span className="text-areia-muted"> · {r.quadras?.nome} · {r.data.split('-').reverse().join('/')} {r.hora_inicio?.slice(0, 5)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-areia-muted">
                    <span>{r.modalidade ? NOMES_MODALIDADE[r.modalidade] : '—'}</span>
                    <span>{NOMES_FORMA_PAGAMENTO[r.forma_pagamento] || r.forma_pagamento || '—'}</span>
                    <span className="font-semibold text-areia">{formatarMoeda(r.valor)}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${r.status_pagamento === 'pago' ? 'bg-sucesso/20 text-sucesso' : 'bg-aviso/20 text-aviso'}`}>
                      {r.status_pagamento === 'pago' ? '✓ Pago' : 'Pendente'}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Mensalidades */}
            <h2 className="font-display text-xl tracking-wide mb-3">MENSALIDADES</h2>
            <div className="bg-night-panel border border-night-line rounded-2xl divide-y divide-night-line overflow-hidden">
              {mensalidadesFiltradas.length === 0 && <p className="text-areia-muted text-sm p-4">Nenhuma mensalidade gerada nesse mês/filtro.</p>}
              {mensalidadesFiltradas.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setEditando({ tipo: 'mensalidade', item: m })}
                  className="w-full text-left p-3 flex items-center justify-between flex-wrap gap-2 text-sm hover:bg-night-line/30 transition-colors"
                >
                  <div>
                    <span className="font-semibold">{m.mensalistas?.clientes?.nome}</span>
                    <span className="text-areia-muted"> · {m.mensalistas?.quadras?.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 text-areia-muted">
                    <span>{NOMES_FORMA_PAGAMENTO[m.forma_pagamento] || m.forma_pagamento || '—'}</span>
                    <span className="font-semibold text-areia">{formatarMoeda(m.valor)}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${m.status === 'pago' ? 'bg-sucesso/20 text-sucesso' : 'bg-aviso/20 text-aviso'}`}>
                      {m.status === 'pago' ? '✓ Pago' : m.status === 'atrasado' ? 'Atrasado' : m.status === 'isento' ? 'Isento' : 'Pendente'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {editando && (
        <EditarPagamentoModal
          tipo={editando.tipo}
          item={editando.item}
          onFechar={() => setEditando(null)}
          onAtualizado={() => { setEditando(null); carregar(); }}
        />
      )}
    </main>
  );
}

function EditarPagamentoModal({ tipo, item, onFechar, onAtualizado }) {
  const [valor, setValor] = useState(item.valor);
  const [formaPagamento, setFormaPagamento] = useState(item.forma_pagamento || '');
  const [status, setStatus] = useState(tipo === 'reserva' ? item.status_pagamento : item.status);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const nomeCliente = tipo === 'reserva' ? item.clientes?.nome : item.mensalistas?.clientes?.nome;
  const opcoesStatus = tipo === 'reserva'
    ? [['pendente', 'Pendente'], ['pago', 'Pago']]
    : [['pendente', 'Pendente'], ['pago', 'Pago'], ['atrasado', 'Atrasado'], ['isento', 'Isento']];

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (tipo === 'reserva') {
        const { error } = await supabase
          .from('reservas')
          .update({ valor, forma_pagamento: formaPagamento || null, status_pagamento: status })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('mensalidades')
          .update({
            valor,
            forma_pagamento: formaPagamento || null,
            status,
            data_pagamento: status === 'pago' ? new Date().toISOString() : null,
          })
          .eq('id', item.id);
        if (error) throw error;
      }
      onAtualizado();
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-night-panel border border-night-line rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-display text-xl tracking-wide mb-1">
          {tipo === 'reserva' ? 'EDITAR PAGAMENTO' : 'EDITAR MENSALIDADE'}
        </h3>
        <p className="text-areia-muted text-sm mb-4">{nomeCliente}</p>

        <label className="block mb-3">
          <span className="text-sm text-areia-muted block mb-1">Valor (R$)</span>
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full"
          />
        </label>

        <label className="block mb-3">
          <span className="text-sm text-areia-muted block mb-1">Forma de pagamento</span>
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full"
          >
            <option value="">Não informado</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">Pix</option>
            <option value="cartao">Cartão</option>
            <option value="asaas_online">Asaas (online)</option>
            {tipo === 'reserva' && <option value="local">A combinar no local</option>}
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-sm text-areia-muted block mb-1">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-night border border-night-line rounded-lg px-3 py-2 text-areia w-full"
          >
            {opcoesStatus.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
          </select>
        </label>

        {erro && <p className="text-erro text-sm mb-3">{erro}</p>}

        <div className="flex justify-between gap-3">
          <button onClick={onFechar} className="text-areia-muted hover:text-areia px-4 py-2 text-sm">Fechar</button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold px-6 py-2 rounded-full"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartaoResumo({ titulo, valor, sub, cor }) {
  const corTexto = cor === 'sucesso' ? 'text-sucesso' : cor === 'aviso' ? 'text-aviso' : 'text-areia';
  return (
    <div className="bg-night-panel border border-night-line rounded-xl p-4">
      <p className="text-areia-muted text-xs mb-1">{titulo}</p>
      <p className={`font-display text-2xl tracking-wide ${corTexto}`}>{formatarMoeda(valor)}</p>
      {sub && <p className="text-areia-muted text-xs mt-1">{sub}</p>}
    </div>
  );
}
