# Sistema de Terceirização - Contexto do Projeto

## Visão Geral
Sistema de gestão de serviços terceirizados. Plataforma multi-tenant para empresas gerenciarem ordens de serviço, técnicos e financeiro.

## Stack Tecnológico
- **Backend:** NestJS 11 + TypeScript + Prisma 6 + PostgreSQL 16
- **Frontend:** Next.js 16 + React 19 + Tailwind CSS 4
- **Auth:** JWT (access token em memória + refresh token em cookie HTTP-only)
- **Infra:** Docker Compose (PostgreSQL na porta 5433)

## Estrutura do Projeto
```
sistema-terceirizacao/
├── backend/           # API NestJS (porta 4000)
│   ├── prisma/        # Schema e migrations
│   └── src/
│       ├── auth/           # Autenticação JWT + sessões
│       ├── company/        # Gestão de empresas
│       ├── technician/     # CRUD de técnicos
│       ├── service-order/  # Ordens de serviço
│       ├── finance/        # Comissões e ledger
│       ├── public-offer/   # Links públicos + OTP
│       ├── prisma/         # Serviço do Prisma
│       └── common/         # Audit, geo, logger, throttler
├── frontend/          # Next.js (porta 3001)
│   ├── app/
│   │   ├── auth/login/           # Página de login
│   │   ├── dashboard/            # Dashboard protegido
│   │   │   ├── service-orders/   # Lista de OS
│   │   │   ├── finance/          # Financeiro
│   │   │   └── settings/         # Configurações
│   │   └── p/[token]/            # Página pública (técnico)
│   └── lib/
│       ├── api.ts                # Cliente HTTP com refresh
│       └── auth.ts               # Funções de auth
└── docker-compose.yml
```

## Roles do Sistema
- **ADMIN** - Acesso total
- **DESPACHO** - Cria/gerencia OS e técnicos
- **FINANCEIRO** - Acessa módulo financeiro
- **LEITURA** - Apenas visualização

## Status de Ordem de Serviço
ABERTA → OFERTADA → ATRIBUIDA → EM_EXECUCAO → CONCLUIDA → APROVADA
                                                         → AJUSTE
                                              → CANCELADA

## Fluxo Principal
1. DESPACHO cria ordem de serviço
2. Gera link público com token (validade 2h)
3. Técnico acessa link → recebe OTP por SMS
4. Técnico verifica OTP → aceita serviço (transação atômica)
5. Técnico executa → conclui
6. FINANCEIRO simula comissão → confirma ledger

## Banco de Dados
- PostgreSQL 16 via Docker (porta 5433)
- DB: sistema / User: sistema_user
- Modelos: Company, User, Session, Technician, ServiceOrder, ServiceOrderOffer, ServiceOrderEvent, OtpCode, ServiceOrderLedger
