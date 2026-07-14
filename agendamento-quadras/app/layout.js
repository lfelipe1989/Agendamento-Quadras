import './globals.css';

export const metadata = {
  title: 'Reservar Quadra',
  description: 'Agendamento de quadras de areia — altinha, futevôlei, vôlei e beach tênis',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Work+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-night text-areia font-body min-h-screen">{children}</body>
    </html>
  );
}
