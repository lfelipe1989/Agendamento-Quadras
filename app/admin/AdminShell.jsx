'use client';

import { useState } from 'react';
import {
  IconAgenda, IconUsers, IconFlag, IconFlame, IconClock, IconChart,
  IconLogout, IconMenu, IconClose,
} from './icons';

// Estrutura de navegação da sidebar, em dois grupos: o dia a dia do balcão
// (Operação) e o que é mexido com menos frequência (Configuração).
// Financeiro é à parte: é outra rota, com login próprio.
const SECOES_NAV = [
  {
    titulo: 'Operação',
    itens: [
      { aba: 'agenda', label: 'Agenda do dia', Icon: IconAgenda },
      { aba: 'mensalistas', label: 'Mensalistas', Icon: IconUsers },
      { aba: 'eventos', label: 'Eventos', Icon: IconFlag },
      { aba: 'churrasqueiras', label: 'Churrasqueiras', Icon: IconFlame },
    ],
  },
  {
    titulo: 'Configuração',
    itens: [
      { aba: 'horarios', label: 'Horários', Icon: IconClock },
    ],
  },
];

export default function AdminShell({ staff, aba, onMudarAba, onLogout, titulo, children }) {
  const [menuAberto, setMenuAberto] = useState(false);

  function escolherAba(valor) {
    onMudarAba(valor);
    setMenuAberto(false);
  }

  return (
    <div className="min-h-screen flex bg-night text-areia">
      {/* Sidebar — fixa em telas médias+, vira painel deslizante no celular */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-night-sidebar border-r border-night-line flex flex-col
          transition-transform duration-200 md:translate-x-0 md:static md:z-auto
          ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-night-line">
          <div className="flex items-center gap-2.5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-coral shrink-0">
              <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.75" />
              <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.75" />
            </svg>
            <div className="leading-tight">
              <p className="font-display text-xl tracking-wide">AREIA</p>
              <p className="text-[11px] text-areia-muted -mt-1">Gestão de quadras</p>
            </div>
          </div>
          <button
            onClick={() => setMenuAberto(false)}
            className="md:hidden text-areia-muted hover:text-areia"
            aria-label="Fechar menu"
          >
            <IconClose />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {SECOES_NAV.map((secao) => (
            <div key={secao.titulo}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold tracking-wide text-areia-muted/70">
                {secao.titulo}
              </p>
              <div className="space-y-0.5">
                {secao.itens.map(({ aba: valor, label, Icon }) => {
                  const ativo = aba === valor;
                  return (
                    <button
                      key={valor}
                      onClick={() => escolherAba(valor)}
                      className={`w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-lg text-sm transition-colors border-l-2 ${
                        ativo
                          ? 'bg-night-raised border-coral text-areia font-medium'
                          : 'border-transparent text-areia-muted hover:text-areia hover:bg-night-raised/60'
                      }`}
                    >
                      <Icon className={ativo ? 'text-coral' : 'text-areia-muted'} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <p className="px-3 mb-1.5 text-[11px] font-semibold tracking-wide text-areia-muted/70">
              Financeiro
            </p>
            <a
              href="/admin/financeiro"
              className="w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-lg text-sm border-l-2 border-transparent text-areia-muted hover:text-areia hover:bg-night-raised/60 transition-colors"
            >
              <IconChart />
              Relatório financeiro
            </a>
          </div>
        </nav>

        <div className="border-t border-night-line p-4">
          <p className="text-sm font-medium truncate">{staff?.nome}</p>
          <button
            onClick={onLogout}
            className="mt-2 flex items-center gap-2 text-xs text-areia-muted hover:text-areia transition-colors"
          >
            <IconLogout width={16} height={16} />
            Sair
          </button>
        </div>
      </aside>

      {menuAberto && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* Coluna principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-night-line flex items-center gap-3 px-4 md:px-8 bg-night">
          <button
            onClick={() => setMenuAberto(true)}
            className="md:hidden text-areia-muted hover:text-areia"
            aria-label="Abrir menu"
          >
            <IconMenu />
          </button>
          <h1 className="font-display text-2xl tracking-wide">{titulo}</h1>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
