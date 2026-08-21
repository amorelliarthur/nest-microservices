# Nest Microservices

![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![NestJS](https://img.shields.io/badge/nestjs-11-red)
![Architecture](https://img.shields.io/badge/architecture-microservices-orange)
![Redis](https://img.shields.io/badge/redis-enabled-red)
![Prometheus](https://img.shields.io/badge/prometheus-enabled-orange)
![Grafana](https://img.shields.io/badge/grafana-dashboards-yellow)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

Arquitetura de microserviços em NestJS com gerenciamento de usuários e serviço financeiro.

---

# Features

- Arquitetura de microserviços com NestJS
- API Gateway com proxy reverso e autenticação centralizada
- Autenticação com JWT e logout com blacklist
- Autorização por níveis (USER / ADMIN)
- Comunicação entre serviços via HTTP e eventos assíncronos (RabbitMQ)
- Validação de dados com class-validator
- Logging de requisições HTTP
- Persistência com MongoDB (Mongoose) e PostgreSQL (TypeORM)
- Migrations com TypeORM
- Redis para cache, sessão, rate limiting e filas assíncronas
- Filas de transações com BullMQ
- Event-Driven Architecture entre user e financial services com RabbitMQ
- Testes unitários com Jest
- Observabilidade com Prometheus e Grafana (métricas de processo via prom-client)

---

# Arquitetura

O sistema é dividido em microserviços independentes:

- **api-gateway** → ponto de entrada da aplicação (roteamento, proxy, autenticação e rate limiting)
- **auth-service** → autenticação, geração/validação de JWT e blacklist de tokens
- **user-service** → gerenciamento de usuários com cache Redis, publica e consome eventos via RabbitMQ
- **financial-service** → contas e transações financeiras com fila assíncrona (BullMQ), publica e consome eventos via RabbitMQ

A comunicação síncrona ocorre via **HTTP REST**, centralizada pelo gateway. A comunicação entre user-service e financial-service é **assíncrona via RabbitMQ** (Event-Driven Architecture), sem chamadas HTTP diretas entre os dois.

```
[ Client ]
     |
     v
[ API Gateway :3002 ]
  Rate Limit (Redis)
  Auth Middleware
     |
     +------> [ Auth Service :3001 ]
     |          JWT + Blacklist (Redis)
     |               |
     |               v
     |         [ User Service :3000 ]
     |           Cache (Redis)
     |               |
     |               v
     |            MongoDB
     |
     +------> [ Financial Service :3004 ]
                Queue (Redis + BullMQ)
                     |
                     v
                 PostgreSQL

  Eventos assíncronos via RabbitMQ:

  [ User Service ] --user.created--> [ Financial Service ]
       (publica)                          (consome → cria conta CHECKING)

  [ Financial Service ] --transaction.completed--> [ User Service ]
       (publica)                                       (consome → atualiza lastTransactionAt)
```

---

# Tecnologias utilizadas

- Node.js + NestJS
- TypeScript
- JWT (jsonwebtoken)
- Axios / @nestjs/axios
- MongoDB / Mongoose
- PostgreSQL / TypeORM
- Redis / ioredis / BullMQ
- RabbitMQ / amqplib (@nestjs/microservices)
- class-validator / class-transformer
- Prometheus / prom-client
- Grafana
- Docker

---

# Estrutura dos Serviços

Cada microserviço segue uma organização padrão baseada em Clean Architecture:

```
src/
├── common/
│   ├── guards/         → autorização (admin, owner-or-admin)
│   ├── interceptors/   → logging HTTP
│   ├── middlewares/    → autenticação (gateway)
│   ├── redis/          → RedisService
│   ├── queue/          → QueueService + Worker (financial, BullMQ)
│   └── rabbitmq/        → RabbitMQService (publisher) + Consumers (publica/consome eventos)
├── <dominio>/
│   ├── dto/            → validação de entrada
│   ├── schemas/        → modelos Mongoose (MongoDB)
│   ├── entities/       → entidades TypeORM (PostgreSQL)
│   ├── *.controller.ts → entrada HTTP
│   ├── *.service.ts    → regras de negócio
│   └── *.module.ts     → módulo NestJS
├── app.module.ts
└── main.ts
```

---

## API Gateway

Responsabilidades:

- Ponto único de entrada da aplicação
- Roteamento de requisições para os serviços
- Proxy reverso com `http-proxy-middleware`
- Autenticação centralizada via JWT
- Rotas públicas: `POST /auth/login`, `POST /user` e `POST /auth/logout`
- Rate limiting por IP com Redis
- Repasse de dados do usuário via headers internos (x-user-id, x-user-role)

Rotas expostas:

- `/auth/*` → encaminha para auth-service
- `/user/*` → encaminha para user-service
- `/financial/*` → encaminha para financial-service

## Auth Service

Responsabilidades:

- Login/Logout de usuários
- Validação de token JWT
- Comunicação com user-service para autenticação
- Blacklist de tokens no Redis (logout real)

## User Service

Responsabilidades:

- Cadastro de usuários com validação de CPF
- Reativação automática de usuário deletado
- Consulta, atualização e exclusão lógica (soft delete com `deletedAt`)
- Autorização por role (ADMIN) e por dono do recurso
- Cache de usuários por ID com Redis (TTL 5 minutos)

## Financial Service

Responsabilidades:

- Criação e gerenciamento de contas (corrente e poupança)
- Depósitos, saques e transferências com transações atômicas
- Controle de saldo com pessimistic lock
- Extrato de transações por conta
- Processamento assíncrono de transações via fila BullMQ + Redis

---

# Redis — Casos de uso

O Redis é utilizado em 4 contextos diferentes no projeto, cada um com uma responsabilidade clara.

## 1. Rate Limiting — API Gateway

Limita o número de requisições por IP para proteger a API de abusos.

```
Requisição chega no gateway
  → incrementa contador no Redis (chave: rate_limit:<ip>)
  → primeira requisição: define TTL de 60 segundos
  → contador <= 100: passa normalmente
  → contador > 100: retorna 429 Too Many Requests
  → após 60 segundos: contador zera automaticamente
```

**Configuração:** 100 requisições por IP a cada 60 segundos.

## 2. Sessão / Blacklist de Tokens — Auth Service

Invalida tokens JWT antes de expirarem naturalmente, permitindo logout real.

```
POST /auth/logout (token no header)
  → auth-service verifica se o token é válido
  → calcula o tempo restante de expiração (TTL)
  → salva o token no Redis com esse TTL (chave: blacklist:<token>)
  → retorna 204 No Content

Próxima requisição com o mesmo token:
  → gateway chama /auth/validaToken
  → auth-service consulta Redis antes de verificar a assinatura
  → token encontrado na blacklist → retorna 401 Unauthorized
  → token expira → Redis remove automaticamente
```

## 3. Cache — User Service

Evita consultas desnecessárias ao MongoDB para buscas frequentes por ID.

```
GET /user/:id
  → verifica Redis (chave: user:<id>)
  → HIT: retorna do cache sem bater no MongoDB
  → MISS: busca no MongoDB → salva no Redis (TTL: 5 min) → retorna

PATCH /user/:id
  → atualiza no MongoDB
  → invalida o cache (del user:<id>)

DELETE /user/:id
  → soft delete no MongoDB
  → invalida o cache (del user:<id>)
```

**TTL:** 5 minutos. Cache invalidado automaticamente em updates e deletes.

## 4. Fila Interna (BullMQ) — Financial Service

Processa transações financeiras em background, retornando resposta imediata ao cliente. Essa fila é interna ao financial-service — não envolve comunicação com outros serviços.

```
POST /transactions
  → enfileira o job no Redis via BullMQ
  → retorna { jobId, status: 'PENDING' } imediatamente

Background (Worker):
  → pega o job da fila
  → processa a transação no PostgreSQL (com transação atômica)
  → salva com status: 'COMPLETED'
  → em caso de falha: tenta mais 2 vezes (backoff exponencial: 1s, 2s, 4s)
```

---

# RabbitMQ — Event-Driven Architecture entre serviços

Enquanto o BullMQ resolve o processamento assíncrono **dentro** do financial-service, o RabbitMQ resolve a comunicação **entre** user-service e financial-service — sem nenhuma chamada HTTP direta entre eles. Cada serviço publica eventos sem saber quem vai consumir, e reage a eventos de outros serviços de forma independente.

Duas filas, cada uma com um sentido de comunicação:

## 1. `users_queue` — user-service publica, financial-service consome

```
POST /user (cadastro)
  → user-service cria o usuário no MongoDB
  → publica o evento "user.created" { userId, nome, email }
  → retorna 201 imediatamente

financial-service consome "user.created":
  → cria automaticamente uma conta CHECKING para esse userId
  → se a conta já existir, ignora o erro sem quebrar o consumer
```

## 2. `transactions_queue` — financial-service publica, user-service consome

```
Worker do BullMQ conclui o processamento de uma transação
  → financial-service publica o evento "transaction.completed" { userId, accountId, type, amount }

user-service consome "transaction.completed":
  → atualiza o campo lastTransactionAt do usuário no MongoDB
```

Painel de administração do RabbitMQ disponível em `http://localhost:15672` (usuário/senha padrão: `guest`/`guest`).

---

# Observabilidade — Prometheus e Grafana

Cada serviço expõe um endpoint `/metrics` usando `prom-client`, coletando
métricas padrão do Node.js (CPU, memória, event loop, garbage collection).
O Prometheus coleta essas métricas periodicamente e o Grafana as exibe em dashboards.

## Arquitetura

```
[ user-service      :3000/metrics ]
[ auth-service      :3001/metrics ]   ← Prometheus coleta a cada 15s
[ api-gateway       :3002/metrics ]     via host.docker.internal
[ financial-service :3004/metrics ]
              |
              v
        [ Prometheus :9090 ]  → armazena as métricas
              |
              v
        [ Grafana :3005 ]     → exibe os dashboards
```

Os serviços NestJS rodam em modo dev na máquina host, enquanto Prometheus e
Grafana rodam em containers. Por isso o Prometheus acessa os serviços via
`host.docker.internal` (com `extra_hosts: host-gateway` no Linux).

## Acessos

- **Prometheus:** `http://localhost:9090` (veja os targets em `/targets`)
- **Grafana:** `http://localhost:3005` (login padrão: `admin` / `admin`)

O dashboard utilizado é o **NodeJS Application Dashboard** (ID `11159`),
importável diretamente pelo Grafana.

---

# Variáveis de ambiente

Crie um arquivo `.env` em cada serviço.

### API Gateway

```env
APP_NAME=gateway
PORTA=3002
AUTH_SERVER=http://localhost:3001
USER_SERVER=http://localhost:3000
FINANCIAL_SERVER=http://localhost:3004
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=dev
```

### Auth Service

```env
APP_NAME=auth
PORTA=3001
CHAVE_PRIVADA=ChaveGrandeParaDificultarODecode
TEMPO_EXP=1d
USER_SERVER=localhost:3000
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=dev
```

### User Service

```env
APP_NAME=user
PORTA=3000
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_NAME=user
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_HOST=localhost
NODE_ENV=dev
```

### Financial Service

```env
APP_NAME=financial
PORTA=3004
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASS=admin
DB_NAME=financeiro
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_HOST=localhost
NODE_ENV=dev
```

---

# Instalação

Clone o repositório:

```bash
git clone https://github.com/amorelliarthur/nest-microservices
cd nest-microservices
```

Instale as dependências de cada serviço:

```bash
cd auth && npm install
cd ../user && npm install
cd ../financial && npm install
cd ../gateway && npm install
```

---

# Infraestrutura (Docker Compose)

Toda a infraestrutura (MongoDB, PostgreSQL, Redis, RabbitMQ, Prometheus e Grafana)
sobe com um único comando, a partir da raiz do projeto:

```bash
docker compose up -d
```

Os serviços NestJS continuam rodando em modo dev (fora do Docker).

Para conferir se os containers subiram:

```bash
docker compose ps
```

## Migrations (financial-service)

O `docker compose` sobe o PostgreSQL, mas as tabelas precisam ser criadas
rodando as migrations manualmente na primeira vez:

```bash
cd financial
npm run migration:run
```

---

# Executando os serviços

Rode cada serviço em um terminal separado:

```bash
# User Service
cd user && npm run start:dev

# Auth Service
cd auth && npm run start:dev

# Financial Service
cd financial && npm run start:dev

# API Gateway
cd gateway && npm run start:dev
```

---

# Endpoints principais

Todos os endpoints devem ser acessados via API Gateway.

**Base URL:** `http://localhost:3002`

## Auth Service

| Método | Endpoint            | Descrição                    | Auth |
| ------ | ------------------- | ---------------------------- | ---- |
| POST   | `/auth/login`       | Realiza login do usuário     | ❌   |
| POST   | `/auth/logout`      | Invalida o token (blacklist) | ✅   |
| POST   | `/auth/validaToken` | Valida um token JWT          | ✅   |

## User Service

| Método | Endpoint    | Descrição                            | Auth           |
| ------ | ----------- | ------------------------------------ | -------------- |
| POST   | `/user`     | Criar novo usuário                   | ❌             |
| GET    | `/user/me`  | Retorna dados do usuário autenticado | ✅             |
| GET    | `/user`     | Listar usuários                      | ✅ ADMIN       |
| GET    | `/user/:id` | Buscar usuário por ID (com cache)    | ✅ ADMIN       |
| PATCH  | `/user/:id` | Atualizar dados do usuário           | ✅ Owner/ADMIN |
| DELETE | `/user/:id` | Exclusão lógica de usuário           | ✅ Owner/ADMIN |

## Financial Service

| Método | Endpoint                                      | Descrição                         | Auth |
| ------ | --------------------------------------------- | --------------------------------- | ---- |
| POST   | `/financial/accounts`                         | Criar conta                       | ✅   |
| GET    | `/financial/accounts/user/:userId`            | Listar contas do usuário          | ✅   |
| GET    | `/financial/accounts/:id`                     | Buscar conta por ID               | ✅   |
| DELETE | `/financial/accounts/:id`                     | Desativar conta                   | ✅   |
| POST   | `/financial/transactions`                     | Enfileirar transação (assíncrono) | ✅   |
| GET    | `/financial/transactions/account/:id`         | Extrato da conta                  | ✅   |
| GET    | `/financial/transactions/account/:id/balance` | Saldo da conta                    | ✅   |

Header utilizado nas rotas protegidas:

```
token: JWT_TOKEN
```

---

# Exemplos de uso

### Criar usuário

```json
POST /user
{
  "nome": "Arthur",
  "email": "arthur@user.br",
  "senha": "Senha@123",
  "cpf": "143.523.122-12"
}
```

### Login

```json
POST /auth/login
{
  "email": "arthur@user.br",
  "senha": "Senha@123"
}
```

### Logout

```
POST /auth/logout
Headers: token: <JWT_TOKEN>
```

### Criar conta financeira

```json
POST /financial/accounts
{
  "userId": "<id-do-usuario>",
  "type": "CHECKING"
}
```

### Realizar depósito (assíncrono)

```json
POST /financial/transactions
{
  "accountId": "<id-da-conta>",
  "type": "DEPOSIT",
  "amount": 1000,
  "description": "Salário"
}
```

Resposta imediata:

```json
{
  "jobId": "1",
  "status": "PENDING"
}
```

### Transferência entre contas

```json
POST /financial/transactions
{
  "accountId": "<id-da-conta-origem>",
  "type": "TRANSFER",
  "amount": 300,
  "description": "Reserva mensal",
  "targetAccountId": "<id-da-conta-destino>"
}
```

---

# Autorização

A API possui dois níveis de acesso:

- **USER** → acesso apenas aos próprios dados
- **ADMIN** → acesso completo

A autenticação é centralizada no gateway — os serviços internos recebem os dados do usuário via headers `x-user-id`, `x-user-role` e `x-user-email`.

---

# Tratamento de Erros

Os serviços utilizam o sistema de exceções nativo do NestJS.
Formato padrão das respostas de erro:

```json
{
  "statusCode": 400,
  "message": "CPF inválido",
  "error": "Bad Request"
}
```

---

# Testes

O projeto possui testes unitários com Jest cobrindo a lógica de negócio dos serviços, com foco em regras de domínio, condicionais críticas e side-effects relevantes (banco, cache, fila).

| Serviço     | Cobertura                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`      | Login (sucesso, credenciais inválidas, serviço indisponível), validação de token (válido, ausente, blacklist, inválido), logout                    |
| `user`      | Criação (novo, CPF/email duplicado, reativação de deletado), busca por ID com cache (HIT/MISS), autenticação, atualização e remoção (soft delete)  |
| `financial` | Transações (depósito, saque, transferência, saldo insuficiente), contas (criação, conflito de tipo duplicado, busca, desativação)                  |
| `gateway`   | Rate limiting (incremento, TTL, bloqueio em 429), rotas públicas vs protegidas, autenticação (token válido/inválido/ausente, serviço indisponível) |

Rodar os testes de um serviço:

```bash
cd <servico>
npm run test
```

Rodar um arquivo de teste específico:

```bash
npm run test <nome-do-arquivo>
```

Guards simples (verificação de role ou ownership por comparação direta) e wrappers finos sobre bibliotecas externas (RabbitMQ, BullMQ) não possuem testes dedicados — a cobertura prioriza onde existe decisão de negócio real.

---
