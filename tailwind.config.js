/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        night: {
          DEFAULT: '#0B2027',   // fundo principal, verde-petróleo escuro (noite de praia)
          panel: '#123339',     // cards e painéis
          line: '#1E4A50',      // divisores, linhas de "quadra"
          raised: '#17424A',    // hover / item ativo / superfície elevada
          sidebar: '#081A1F',   // chrome estrutural (sidebar, topbar) — um tom mais escuro que o conteúdo
        },
        areia: {
          DEFAULT: '#EDE4D0',   // texto claro / fundo alternativo
          muted: '#9FB3B5',     // texto secundário sobre fundo escuro (neutro frio, mais legível que um bege apagado)
        },
        coral: {
          DEFAULT: '#FF6B4A',   // CTA principal
          hover: '#FF8563',
        },
        sucesso: '#3FA796',
        aviso: '#E8B84B',
        erro: '#E4572E',
        // cores de modalidade (espelham config_modalidade no banco)
        altinha: '#f59e0b',
        futevolei: '#22c55e',
        volei: '#3b82f6',
        beach_tenis: '#ef4444',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"Work Sans"', 'sans-serif'],
      },
      backgroundImage: {
        'court-lines': "linear-gradient(90deg, transparent 49%, rgba(237,228,208,0.06) 49%, rgba(237,228,208,0.06) 51%, transparent 51%)",
      },
    },
  },
  plugins: [],
};
