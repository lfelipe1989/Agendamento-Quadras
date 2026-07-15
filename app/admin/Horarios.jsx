'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const NOMES_MODALIDADE = {
  altinha: 'Altinha',
  futevolei: 'Futevôlei',
  volei: 'Vôlei',
  beach_tenis: 'Beach Tênis',
};

export default function Horarios() {
  const [horarios, setHorarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(null);

  const [modalidades, setModalidades] = useState([]);
  const [carregandoPrecos, setCarregandoPrecos] = useState(true);
  const [salvandoPreco, setSalvandoPreco] = useState(null);

  const [horaInicioNoturno, setHoraInicioNoturno] = useState('18:00');
  const [salvandoCorte, setSalvandoCorte] = useState(false);

  useEffect(() => { carregar(); carregarPrecos(); carregarCorte(); }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('horarios_funcionamento')
      .select('*')
      .order('dia_semana');
    setHorarios(data || []);
    setCarregando(false);
  }

  function atualizarLocal(diaSemana, campo, valor) {
    setHorarios((prev) =>
      prev.map((h) => (h.dia_semana === diaSemana ? { ...h, [campo]: valor } : h))
    );
  }

  async function salvar(diaSemana) {
    const linha = horarios.find((h) => h.dia_semana === diaSemana);
    setSalvando(diaSemana);
    await supabase
      .from('horarios_funcionamento')
      .update({
        hora_abertura: linha.hora_abertura,
        hora_fechamento: linha.hora_fechamento,
        fechado: linha.fechado,
      })
      .eq('dia_semana', diaSemana);
    setSalvando(null);
  }

  async function carregarPrecos() {
    setCarregandoPrecos(true);
    const { data } = await supabase
      .from('config_modalidade')
      .select('*')
      .order('modalidade');
    setModalidades(data || []);
    setCarregandoPrecos(false);
  }

  function atualizarPrecoLocal(modalidade, campo, valor) {
    setModalidades((prev) =>
      prev.map((m) => (m.modalidade === modalidade ? { ...m, [campo]: valor } : m))
    );
  }

  async function salvarPreco(modalidade) {
    const linha = modalidades.find((m) => m.modalidade === modalidade);
    setSalvandoPreco(modalidade);
    await supabase
      .from('config_modalidade')
      .update({ valor_diurno: linha.valor_diurno, valor_noturno: linha.valor_noturno })
      .eq('modalidade', modalidade);
    setSalvandoPreco(null);
  }

  async function carregarCorte() {
    const { data } = await supabase
      .from('configuracao')
      .select('hora_inicio_noturno')
      .eq('id', 1)
      .single();
    if (data?.hora_inicio_noturno) setHoraInicioNoturno(data.hora_inicio_noturno.slice(0, 5));
  }

  async function salvarCorte() {
    setSalvandoCorte(true);
    await supabase
      .from('configuracao')
      .update({ hora_inicio_noturno: horaInicioNoturno })
      .eq('id', 1);
    setSalvandoCorte(false);
  }

  return (
    <div>
      <h2 className="font-display text-2xl tracking-wide mb-2">PREÇOS POR MODALIDADE</h2>
      <p className="text-areia-muted text-sm mb-4">
        Valor da hora avulsa, diurno e noturno, por modalidade. É o que aparece pro cliente no link de reserva — vale pra qualquer uma das 3 quadras.
      </p>

      <div className="bg-night-panel border border-night-line rounded-xl p-4 flex items-center gap-3 flex-wrap mb-6">
        <span className="text-sm text-areia-muted">A partir de que horário o preço noturno passa a valer?</span>
        <input
          type="time"
          value={horaInicioNoturno}
          onChange={(e) => setHoraInicioNoturno(e.target.value)}
          className="bg-night border border-night-line rounded-lg px-3 py-1.5 text-areia"
        />
        <button
          onClick={salvarCorte}
          disabled={salvandoCorte}
          className="ml-auto bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold text-sm px-4 py-1.5 rounded-full"
        >
          {salvandoCorte ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {carregandoPrecos && <p className="text-areia-muted mb-8">Carregando...</p>}

      {!carregandoPrecos && (
        <div className="space-y-2 mb-10">
          {modalidades.map((m) => (
            <div key={m.modalidade} className="bg-night-panel border border-night-line rounded-xl p-4 flex items-center gap-4 flex-wrap">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: m.cor }}
              />
              <span className="font-semibold w-28">{NOMES_MODALIDADE[m.modalidade]}</span>

              <label className="flex items-center gap-2 text-sm text-areia-muted">
                Diurno R$
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={m.valor_diurno}
                  onChange={(e) => atualizarPrecoLocal(m.modalidade, 'valor_diurno', e.target.value)}
                  className="bg-night border border-night-line rounded-lg px-3 py-1.5 text-areia w-24"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-areia-muted">
                Noturno R$
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={m.valor_noturno}
                  onChange={(e) => atualizarPrecoLocal(m.modalidade, 'valor_noturno', e.target.value)}
                  className="bg-night border border-night-line rounded-lg px-3 py-1.5 text-areia w-24"
                />
              </label>

              <button
                onClick={() => salvarPreco(m.modalidade)}
                disabled={salvandoPreco === m.modalidade}
                className="ml-auto bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold text-sm px-4 py-1.5 rounded-full"
              >
                {salvandoPreco === m.modalidade ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-display text-2xl tracking-wide mb-2">HORÁRIO DE FUNCIONAMENTO</h2>
      <p className="text-areia-muted text-sm mb-6">
        Defina o horário de abertura e fechamento de cada dia da semana. Isso controla quais horários aparecem disponíveis pro cliente no link de reserva.
      </p>

      {carregando && <p className="text-areia-muted">Carregando...</p>}

      <div className="space-y-2">
        {horarios.map((h) => (
          <div
            key={h.dia_semana}
            className="bg-night-panel border border-night-line rounded-xl p-4 flex items-center gap-4 flex-wrap"
          >
            <span className="font-semibold w-24">{DIAS_SEMANA[h.dia_semana]}</span>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={h.fechado}
                onChange={(e) => atualizarLocal(h.dia_semana, 'fechado', e.target.checked)}
              />
              Fechado
            </label>

            {!h.fechado && (
              <>
                <label className="flex items-center gap-2 text-sm text-areia-muted">
                  Abre
                  <input
                    type="time"
                    value={h.hora_abertura?.slice(0, 5) || ''}
                    onChange={(e) => atualizarLocal(h.dia_semana, 'hora_abertura', e.target.value)}
                    className="bg-night border border-night-line rounded-lg px-3 py-1.5 text-areia"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-areia-muted">
                  Fecha
                  <input
                    type="time"
                    value={h.hora_fechamento?.slice(0, 5) || ''}
                    onChange={(e) => atualizarLocal(h.dia_semana, 'hora_fechamento', e.target.value)}
                    className="bg-night border border-night-line rounded-lg px-3 py-1.5 text-areia"
                  />
                </label>
              </>
            )}

            <button
              onClick={() => salvar(h.dia_semana)}
              disabled={salvando === h.dia_semana}
              className="ml-auto bg-coral hover:bg-coral-hover disabled:opacity-30 text-night font-semibold text-sm px-4 py-1.5 rounded-full"
            >
              {salvando === h.dia_semana ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
