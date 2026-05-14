# Nest Microservices

![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![NestJS](https://img.shields.io/badge/nestjs-11-red)
![Architecture](https://img.shields.io/badge/architecture-microservices-orange)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

Arquitetura de microserviços em NestJS com autenticação JWT, gerenciamento de usuários, serviço financeiro.

---

# Features

- Arquitetura de microserviços com NestJS
- API Gateway com proxy reverso e autenticação centralizada
- Autenticação com JWT
- Autorização por níveis (USER / ADMIN)
- Comunicação entre serviços via HTTP
- Validação de dados com class-validator
- Logging de requisições HTTP
- Persistência com MongoDB (Mongoose) e PostgreSQL (TypeORM)

---

# Arquitetura

O sistema é dividido em microserviços independentes:

- **api-gateway** → ponto de entrada da aplicação (roteamento, proxy e autenticação centralizada)
- **auth-service** → responsável por autenticação e geração/validação de JWT
- **user-service** → responsável pelo gerenciamento de usuários
- **financial-service** → responsável por contas e transações financeiras

A comunicação ocorre via **HTTP REST**, centralizada pelo gateway.

```
[ Client ]
     |
     v
[ API Gateway :3002 ]
     |
     +------> [ Auth Service :3001 ]
     |               |
     |               v
     |         [ User Service :3000 ]
     |               |
     |               v
     |            MongoDB
     |
     +------> [ User Service :3000 ]
     |
     +------> [ Financial Service :3004 ]
                     |
                     v
                 PostgreSQL
```

---

# Tecnologias utilizadas

- Node.js + NestJS
- TypeScript
- JWT (jsonwebtoken)
- Axios / @nestjs/axios
- MongoDB / Mongoose
- PostgreSQL / TypeORM
- class-validator / class-transformer

---

# Estrutura dos Serviços

Cada microserviço segue uma organização padrão baseada em Clean Architecture:

```
src/
├── common/
│   ├── guards/         → autorização (admin, owner-or-admin)
│   ├── interceptors/   → logging HTTP
│   └── middlewares/    → autenticação (gateway)
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
- Rotas públicas: `POST /auth/login` e `POST /user`

Rotas expostas:

- `/auth/*` → encaminha para auth-service
- `/user/*` → encaminha para user-service
- `/financial/*` → encaminha para financial-service

## Auth Service

Responsabilidades:

- Login de usuários
- Validação de token JWT
- Comunicação com user-service para autenticação

## User Service

Responsabilidades:

- Cadastro de usuários com validação de CPF
- Reativação automática de usuário deletado
- Consulta, atualização e exclusão lógica (soft delete com `deletedAt`)
- Autorização por role (ADMIN) e por dono do recurso

## Financial Service

Responsabilidades:

- Criação e gerenciamento de contas (corrente e poupança)
- Depósitos, saques e transferências com transações atômicas
- Controle de saldo com pessimistic lock
- Extrato de transações por conta

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
NODE_ENV=dev
```

### Auth Service

```env
APP_NAME=auth
PORTA=3001
CHAVE_PRIVADA=ChaveGrandeParaDificultarODecode
TEMPO_EXP=1d
USER_SERVER=localhost:3000
NODE_ENV=dev
```

### User Service

```env
APP_NAME=user
PORTA=3000
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_NAME=user
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

# Banco de dados

### MongoDB (user-service)

```bash
docker run --name mongodb -p 27017:27017 -d mongo
```

### PostgreSQL (financial-service)

```bash
docker run --name postgres \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin \
  -e POSTGRES_DB=financeiro \
  -p 5432:5432 \
  -d postgres
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

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/auth/login` | Realiza login do usuário | ❌ |
| POST | `/auth/validaToken` | Valida um token JWT | ✅ |

## User Service

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/user` | Criar novo usuário | ❌ |
| GET | `/user/me` | Retorna dados do usuário autenticado | ✅ |
| GET | `/user` | Listar usuários | ✅ ADMIN |
| GET | `/user/:id` | Buscar usuário por ID | ✅ ADMIN |
| PATCH | `/user/:id` | Atualizar dados do usuário | ✅ Owner/ADMIN |
| DELETE | `/user/:id` | Exclusão lógica de usuário | ✅ Owner/ADMIN |

## Financial Service

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/financial/accounts` | Criar conta | ✅ |
| GET | `/financial/accounts/user/:userId` | Listar contas do usuário | ✅ |
| GET | `/financial/accounts/:id` | Buscar conta por ID | ✅ |
| DELETE | `/financial/accounts/:id` | Desativar conta | ✅ |
| POST | `/financial/transactions` | Realizar transação | ✅ |
| GET | `/financial/transactions/account/:id` | Extrato da conta | ✅ |
| GET | `/financial/transactions/account/:id/balance` | Saldo da conta | ✅ |

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

### Criar conta financeira

```json
POST /financial/accounts
{
  "userId": "<id-do-usuario>",
  "type": "CHECKING"
}
```

### Realizar depósito

```json
POST /financial/transactions
{
  "accountId": "<id-da-conta>",
  "type": "DEPOSIT",
  "amount": 1000,
  "description": "Salário"
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

# Roadmap

- [ ] Testes unitários com Jest
- [ ] Documentação com Swagger
- [ ] Docker Compose
- [ ] Monitor Service