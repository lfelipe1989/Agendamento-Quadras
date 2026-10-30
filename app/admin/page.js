'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { validarCodigoAcesso } from '@/lib/staffAuth';
import AgendaDia from './AgendaDia';
import Eventos from './Eventos';
import Churrasqueiras from './Churrasqueiras';
import Mensalistas from './Mensalistas';
import Horarios from './Horarios';
import AdminShell from './AdminShell';

const TITULOS_ABA = {
  agenda: 'Agenda do dia',
  mensalistas: 'Mensalistas',
  eventos: 'Eventos',
  churrasqueiras: 'Churrasqueiras',
  horarios: 'Horários',
};

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
    <AdminShell
      staff={staff}
      aba={aba}
      onMudarAba={setAba}
      onLogout={fazerLogout}
      titulo={TITULOS_ABA[aba]}
    >
      {aba === 'agenda' && <AgendaDia quadras={quadras} modalidades={modalidades} horaInicioNoturno={horaInicioNoturno} />}
      {aba === 'eventos' && <Eventos quadras={quadras} modalidades={modalidades} />}
      {aba === 'churrasqueiras' && <Churrasqueiras />}
      {aba === 'mensalistas' && <Mensalistas quadras={quadras} modalidades={modalidades} />}
      {aba === 'horarios' && <Horarios />}
    </AdminShell>
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
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-coral shrink-0">
            <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.75" />
            <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.75" />
          </svg>
          <div className="leading-tight text-left">
            <p className="font-display text-2xl tracking-wide">AREIA</p>
            <p className="text-[11px] text-areia-muted -mt-1">Gestão de quadras</p>
          </div>
        </div>

        <div className="bg-night-panel border border-night-line rounded-2xl p-8">
          <h1 className="font-display text-2xl tracking-wide mb-1">PAINEL DO BALCÃO</h1>
          <p className="text-areia-muted text-sm mb-6">Digite seu código de acesso</p>
          <input
            type="password"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
            className="bg-night border border-night-line rounded-lg px-4 py-3 text-areia w-full mb-3 focus:border-coral outline-none transition-colors"
            placeholder="Código de acesso"
            autoFocus
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
      </div>
    </main>
  );
}
