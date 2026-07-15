'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function Horarios() {
  const [horarios, setHorarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(null);

  useEffect(() => { carregar(); }, []);

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

  if (carregando) return <p className="text-areia-muted">Carregando...</p>;

  return (
    <div>
      <p className="text-areia-muted text-sm mb-6">
        Defina o horário de abertura e fechamento de cada dia da semana. Isso controla quais horários aparecem disponíveis pro cliente no link de reserva.
      </p>
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
