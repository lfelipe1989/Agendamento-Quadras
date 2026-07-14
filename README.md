# Agendamento de Quadras

Sistema de reserva de quadras de areia (altinha, futevôlei, vôlei, beach tênis) com clientes avulsos (link público) e mensalistas (horário fixo semanal), controle de pagamento e integração com Asaas (Pix/cartão).

## O que já está pronto

- Schema do banco (`agendamento`) já rodado no Supabase
- Página pública `/reservar` com fluxo completo: quadra → modalidade → data/hora → dados → pagamento
- Cálculo de disponibilidade cruzando reservas avulsas + horário fixo de mensalistas
- API route pra criar cobrança no Asaas (`/api/asaas/checkout`)
- Webhook pra confirmar pagamento automaticamente (`/api/asaas/webhook`)

## O que falta pra colocar no ar

1. **Variáveis de ambiente**: copiar `.env.local.example` para `.env.local` e preencher:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: em Supabase > Project Settings > API
   - `SUPABASE_SERVICE_ROLE_KEY`: mesma tela, chave `service_role` (nunca commitar isso)
   - `ASAAS_API_KEY`: em Asaas > Integrações > Chave de API (comece pelo Sandbox pra testar sem dinheiro real)

2. **Preços por modalidade**: ajustar `valor_hora_avulsa` na tabela `agendamento.config_modalidade` (veio zerado do schema)

3. **Configurar o webhook no Asaas**: depois do deploy na Vercel, ir em Asaas > Integrações > Webhooks e cadastrar `https://seu-dominio.vercel.app/api/asaas/webhook`, escutando os eventos `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`

4. **Painel do balcão (`/admin`)**: ainda não foi construído — é o próximo passo (visão do dia por quadra, status de pagamento, cadastro de mensalista)

## Rodando localmente

```bash
npm install
npm run dev
```

Acessa em `http://localhost:3000/reservar`

## Deploy

Mesmo fluxo que você já usa: sobe esse repo no GitHub (drag-and-drop), conecta na Vercel, adiciona as variáveis de ambiente lá em Project Settings > Environment Variables, e o deploy acontece automático a cada push.
