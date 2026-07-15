'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { validarCodigoAcesso } from '@/lib/staffAuth';
import AgendaDia from './AgendaDia';
import Eventos from './Eventos';
import Mensalistas from './Mensalistas';
import Horarios from './Horarios';

export default function AdminPage() {
  const [staff, setStaff] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [aba, setAba] = useState('agenda');
  const [quadras, setQuadras] = useState([]);
  const [modalidades, setModalidades] = useState([]);
  const [horaInicioNoturno, setHoraInicioNoturno] = useState('18:00');

  // Restaura sessão do balcão (se já tiver feito login nessa aba do navegador)
  useEffect(() => {
    const salvo = sessionStorage.getItem('staff');
    if (salvo) setStaff(JSON.parse(salvo));
    setCarregandoSessao(false);
  }, []);

  // Carrega dados de referência assim que loga
  useEffect(() => {
    if (!staff) return;
    supabase.from('quadras').select('*').eq('ativa', true).order('ordem').then(({ data }) => setQuadras(data || []));
    supabase.from('config_modalidade').select('*').then(({ data }) => setModalidades(data || []));
    supabase.from('configuracao').select('hora_inicio_noturno').eq('id', 1).single().then(({ data }) => {
      if (data?.hora_inicio_noturno) setHoraInicioNoturno(data.hora_inicio_noturno.slice(0, 5));
    });
  }, [staff]);

  function fazerLogout() {
    sessionStorage.removeItem('staff');
    setStaff(null);
  }

  if (carregandoSessao) return null;

  if (!staff) {
    return <TelaLogin onEntrar={(s) => { sessionStorage.setItem('staff', JSON.stringify(s)); setStaff(s); }} />;
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 bg-night text-areia">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl tracking-wide">PAINEL DO BALCÃO</h1>
            <p className="text-areia-muted text-sm">Olá, {staff.nome}</p>
          </div>
          <button onClick={fazerLogout} className="text-areia-muted hover:text-areia text-sm">
            Sair
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <BotaoAba ativo={aba === 'agenda'} onClick={() => setAba('agenda')}>Agenda do dia</BotaoAba>
          <BotaoAba ativo={aba === 'eventos'} onClick={() => setAba('eventos')}>Eventos</BotaoAba>
          <BotaoAba ativo={aba === 'mensalistas'} onClick={() => setAba('mensalistas')}>Mensalistas</BotaoAba>
          <BotaoAba ativo={aba === 'horarios'} onClick={() => setAba('horarios')}>Horários</BotaoAba>
        </div>

        {aba === 'agenda' && <AgendaDia quadras={quadras} modalidades={modalidades} horaInicioNoturno={horaInicioNoturno} />}
        {aba === 'eventos' && <Eventos quadras={quadras} modalidades={modalidades} />}
        {aba === 'mensalistas' && <Mensalistas quadras={quadras} modalidades={modalidades} />}
        {aba === 'horarios' && <Horarios />}
      </div>
    </main>
  );
}

function BotaoAba({ ativo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
        ativo ? 'bg-coral text-night' : 'bg-night-panel text-areia-muted hover:text-areia'
      }`}
    >
      {children}
    </button>
  );
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
        <h1 className="font-display text-3xl tracking-wide mb-1">PAINEL DO BALCÃO</h1>
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
