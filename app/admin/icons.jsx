// Ícones simples, em SVG inline (sem dependência externa — o projeto não usa
// nenhuma lib de ícones, então desenhamos só o necessário pra sidebar/topbar).
// Todos seguem o mesmo traço (stroke, 1.75, sem preenchimento) pra ficarem
// visualmente consistentes entre si.

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconAgenda(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M8 14h2M8 17h2M14 14h2M14 17h2" />
    </svg>
  );
}

export function IconUsers(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 14.2c2.3.4 3.7 2 3.7 4.3" />
    </svg>
  );
}

export function IconFlag(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 3v18" />
      <path d="M5 4h12l-2.5 3.5L17 11H5" />
    </svg>
  );
}

export function IconFlame(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2.5c.5 2.5-1 3.8-2.3 5.2C8.3 9.1 7 10.8 7 13.2a5 5 0 0 0 10 0c0-2-1-3.3-2-4.4.2 1.3-.4 2-1 2.2.4-2.8-.6-5.3-2-8.5Z" />
    </svg>
  );
}

export function IconClock(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}

export function IconChart(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2.5 20h19" />
    </svg>
  );
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" />
      <path d="M14 16l4-4-4-4" />
      <path d="M18 12H9" />
    </svg>
  );
}

export function IconMenu(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}
