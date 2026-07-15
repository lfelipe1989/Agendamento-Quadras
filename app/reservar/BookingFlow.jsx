'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { buscarDisponibilidadeTodasQuadras } from '@/lib/disponibilidade';

const NOMES_MODALIDADE = {
  altinha: 'Altinha',
  futevolei: 'Futevôlei',
  volei: 'Vôlei',
  beach_tenis: 'Beach Tênis',
};

const ETAPAS = ['Data', 'Horário', 'Quadra', 'Modalidade', 'Seus dados', 'Pagamento'];

export default function BookingFlow({ quadras, modalidades, horaInicioNoturno }) {
  const [etapa, setEtapa] = useState(0);
  const [data, setData] = useState('');
  const [disponibilidade, setDisponibilidade] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [horarioEscolhido, setHorarioEscolhido] = useState(null);
  const [quadraId, setQuadraId] = useState(null);
  const [modalidade, setModalidade] = useState(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [formaPagamento, setFormaPagamento] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [reservaConfirmada, setReservaConfirmada] = useState(null);

  const agora = new Date();
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (data) {
      setCarregando(true);
      setHorarioEscolhido(null);
      setQuadraId(null);
      buscarDisponibilidadeTodasQuadras(quadras.map((q) => q.id), data)
        .then(setDisponibilidade)
        .finally(() => setCarregando(false));
    }
  }, [data]);

  const slotsBase = Object.values(disponibilidade)[0] || [];
  const diaFechado = !carregando && data && slotsBase.length === 0;

  const horariosDisponiveis = slotsBase.map((slot) => {
    const algumaQuadraLivre = quadras.some((q) =>
      disponibilidade[q.id]?.some((s) => s.hora_inicio === slot.hora_inicio && s.disponivel)
    );
    return { ...slot, disponivel: algumaQuadraLivre };
  });

  const quadrasDisponiveis = horarioEscolhido
    ? quadras.filter((q) =>
        disponibilidade[q.id]?.some(
          (s) => s.hora_inicio === horarioEscolhido.hora_inicio && s.disponivel
        )
      )
    : [];

  const modalidadeInfo = modalidades.find((m) => m.modalidade === modalidade);
  const periodoNoturno = horarioEscolhido && horarioEscolhido.hora_inicio >= horaInicioNoturno;
  const valor = modalidadeInfo
    ? (periodoNoturno ? modalidadeInfo.valor_noturno : modalidadeInfo.valor_diurno)
    : 0;

  async function confirmarReserva() {
    setEnviando(true);
    setErro(null);
    try {
      let { data: clienteExistente } = await supabase
        .from('clientes')
        .select('id')
        .eq('telefone', telefone)
        .maybeSingle();

      let clienteId = clienteExistente?.id;

      if (!clienteId) {
        const { data: novoCliente, error: erroCliente } = await supabase
          .from('clientes')
          .insert({ nome, telefone, email: email || null })
          .select('id')
          .single();
        if (erroCliente) throw erroCliente;
        clienteId = novoCliente.id;
      }

      const statusReserva = formaPagamento === 'asaas_online' ? 'aguardando_pagamento' : 'confirmada';

      const { data: reserva, error: erroReserva } = await supabase
        .from('reservas')
        .insert({
          quadra_id: quadraId,
          cliente_id: clienteId,
          modalidade,
          data,
          hora_inicio: horarioEscolhido.hora_inicio,
          hora_fim: horarioEscolhido.hora_fim,
          valor,
          origem: 'link',
          forma_pagamento: formaPagamento === 'asaas_online' ? 'asaas_online' : 'local',
          status_pagamento: 'pendente',
          status_reserva: statusReserva,
        })
        .select('id')
        .single();

      if (erroReserva) {
        if (erroReserva.code === '23P01') {
          throw new Error('Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário ou quadra.');
        }
        throw erroReserva;
      }

      if (formaPagamento === 'asaas_online') {
        const resp = await fetch('/api/asaas/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservaId: reserva.id, clienteId, valor, nome, email, telefone }),
        });
        const checkout = await resp.json();
        if (checkout.checkoutUrl) {
          window.location.href = checkout.checkoutUrl;
          return;
        }
        throw new Error('Não foi possível iniciar o pagamento online. Tente pagar no local.');
      }

      setReservaConfirmada(reserva.id);
    } catch (e) {
      setErro(e.message || 'Erro ao confirmar a reserva.');
    } finally {
      setEnviando(false);
    }
  }

  const nomeQuadra = quadras.find((q) => q.id === quadraId)?.nome;

  if (reservaConfirmada) {
    return (
      <div className="bg-night-panel border border-night-line rounded-2xl p-8 text-center">
        <p className="text-sucesso font-display text-3xl tracking-wide mb-3">RESERVA CONFIRMADA</p>
        <p className="text-areia-muted mb-1">
          {nomeQuadra} · {NOMES_MODALIDADE[modalidade]} · {data.split('-').reverse().join('/')} às {horarioEscolhido.hora_inicio}
        </p>
        <p className="text-areia-muted">Pagamento no local — {telefone}</p>
      </div>
    );
  }

  return (
    <div>
      <Stepper etapaAtual={etapa} />

      <div className="bg-night-panel border border-night-line rounded-2xl p-6 mt-6">
        {etapa === 0 && (
          <div>
            <h2 className="font-display text-2xl tracking-wide mb-4">ESCOLHA A DATA</h2>
            <input
              type="date"
              min={hoje}
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="bg-night border border-night-line rounded-lg px-4 py-3 text-areia w-full mb-4"
            />
            {diaFechado && (
              <p className="text-aviso text-sm mb-4">Fechado nesse dia. Escolha outra data.</p>
            )}
            <div className="flex justify-end">
              <button
                disabled={!data || carregando || diaFechado}
                onClick={() => setEtapa(1)}
                className="bg-coral hover:bg-coral-hover disabled:opacity-30 disabled:cursor-not-allowed text-night font-semibold px-6 py-2 rounded-full transition-colors"
              >
                {carregando ? 'Carregando...' : 'Continuar'}
              </button>
            </div>
          </div>
        )}

        {etapa === 1 && (
          <div>
            <h2 className="font-display text-2xl tracking-wide mb-4">ESCOLHA O HORÁRIO</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {horariosDisponiveis.map((h) => (
                <button
                  key={h.hora_inicio}
                  disabled={!h.disponivel}
                  onClick={() => { setHorarioEscolhido(h); setQuadraId(null); }}
                  className={`py-2 rounded-lg text-sm border transition-colors ${
                    !h.disponivel
                      ? 'border-night-line text-areia-muted/40 cursor-not-allowed line-through'
                      : horarioEscolhido?.hora_inicio === h.hora_inicio
                      ? 'border-coral bg-night text-coral'
                      : 'border-night-line hover:border-areia-muted'
                  }`}
                >
                  {h.hora_inicio}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-6">
              <VoltarBotao onClick={() => setEtapa(0)} />
              <button
                disabled={!horarioEscolhido}
                onClick={() => setEtapa(2)}
                className="bg-coral hover:bg-coral-hover disabled:opacity-30 disabled:cursor-not-allowed text-night font-semibold px-6 py-2 rounded-full transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {etapa === 2 && (
          <div>
            <h2 className="font-display text-2xl tracking-wide mb-4">ESCOLHA A QUADRA</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {quadrasDisponiveis.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setQuadraId(q.id)}
                  className={`p-5 rounded-xl border transition-colors text-left ${
                    quadraId === q.id ? 'border-coral bg-night' : 'border-night-line hover:border-areia-muted'
                  }`}
                >
                  <span className="font-semibold text-lg">{q.nome}</span>
                </button>
              ))}
              {quadrasDisponiveis.length === 0 && (
                <p className="text-areia-muted text-sm col-span-3">Nenhuma quadra livre nesse horário.</p>
              )}
            </div>
            <div className="flex justify-between mt-6">
              <VoltarBotao onClick={() => setEtapa(1)} />
              <button
                disabled={!quadraId}
                onClick={() => setEtapa(3)}
                className="bg-coral hover:bg-coral-hover disabled:opacity-30 disabled:cursor-not-allowed text-night font-semibold px-6 py-2 rounded-full transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div>
            <h2 className="font-display text-2xl tracking-wide mb-4">ESCOLHA A MODALIDADE</h2>
            <div className="grid grid-cols-2 gap-3">
              {modalidades.map((m) => (
                <button
                  key={m.modalidade}
                  onClick={() => { setModalidade(m.modalidade); setEtapa(4); }}
                  className={`p-5 rounded-xl border transition-colors ${
                    modalidade === m.modalidade ? 'border-coral bg-night' : 'border-night-line hover:border-areia-muted'
                  }`}
                >
                  <span
                    className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                    style={{ backgroundColor: m.cor }}
                  />
                  <span className="font-semibold align-middle">{NOMES_MODALIDADE[m.modalidade]}</span>
                </button>
              ))}
            </div>
            <VoltarBotao onClick={() => setEtapa(2)} />
          </div>
        )}

        {etapa === 4 && (
          <div>
            <h2 className="font-display text-2xl tracking-wide mb-4">SEUS DADOS</h2>
            <div className="space-y-3">
              <Campo label="Nome" value={nome} onChange={setNome} />
              <Campo label="Telefone (WhatsApp)" value={telefone} onChange={setTelefone} />
              <Campo label="E-mail (opcional)" value={email} onChange={setEmail} />
            </div>
            <div className="flex justify-between mt-6">
              <VoltarBotao onClick={() => setEtapa(3)} />
              <button
                disabled={!nome || !telefone}
                onClick={() => setEtapa(5)}
                className="bg-coral hover:bg-coral-hover disabled:opacity-30 disabled:cursor-not-allowed text-night font-semibold px-6 py-2 rounded-full transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {etapa === 5 && (
          <div>
            <h2 className="font-display text-2xl tracking-wide mb-2">PAGAMENTO</h2>
            <p className="text-areia-muted mb-4">
              Valor ({periodoNoturno ? 'noturno' : 'diurno'}): <span className="text-areia font-semibold">R$ {Number(valor).toFixed(2)}</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setFormaPagamento('asaas_online')}
                className={`p-4 rounded-xl border text-left ${
                  formaPagamento === 'asaas_online' ? 'border-coral bg-night' : 'border-night-line hover:border-areia-muted'
                }`}
              >
                <span className="font-semibold block mb-1">Pagar agora</span>
                <span className="text-areia-muted text-sm">Pix ou cartão, online</span>
              </button>
              <button
                onClick={() => setFormaPagamento('local')}
                className={`p-4 rounded-xl border text-left ${
                  formaPagamento === 'local' ? 'border-coral bg-night' : 'border-night-line hover:border-areia-muted'
                }`}
              >
                <span className="font-semibold block mb-1">Pagar no local</span>
                <span className="text-areia-muted text-sm">Direto no balcão</span>
              </button>
            </div>
            {erro && <p className="text-erro mb-4">{erro}</p>}
            <div className="flex justify-between">
              <VoltarBotao onClick={() => setEtapa(4)} />
              <button
                disabled={!formaPagamento || enviando}
                onClick={confirmarReserva}
                className="bg-coral hover:bg-coral-hover disabled:opacity-30 disabled:cursor-not-allowed text-night font-semibold px-6 py-2 rounded-full transition-colors"
              >
                {enviando ? 'Confirmando...' : 'Confirmar reserva'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({ etapaAtual }) {
  return (
    <div className="relative flex justify-between items-center">
      <div className="absolute left-0 right-0 top-1/2 h-px bg-night-line -translate-y-1/2" />
      {ETAPAS.map((label, i) => (
        <div key={label} className="relative flex flex-col items-center gap-1 bg-night px-1">
          <div
            className={`w-2.5 h-2.5 rounded-full ${i <= etapaAtual ? 'bg-coral' : 'bg-night-line'}`}
          />
          <span className={`text-[11px] hidden sm:block ${i === etapaAtual ? 'text-areia' : 'text-areia-muted'}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Campo({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm text-areia-muted block mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-night border border-night-line rounded-lg px-4 py-3 text-areia w-full"
      />
    </label>
  );
}

function VoltarBotao({ onClick }) {
  return (
    <button onClick={onClick} className="text-areia-muted hover:text-areia px-2 py-2 text-sm">
      ← Voltar
    </button>
  );
}
