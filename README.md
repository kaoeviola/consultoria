# Plataforma Consultoria

SaaS para consultorias de Segurança do Trabalho (SST) e gestão ambiental automatizarem a produção de documentos técnicos (PGR, PCMSO, políticas, procedimentos) usando agentes de IA, com controle de empresas, projetos e conformidade legal.

## Funcionalidades

- **Gestão de empresas e projetos**: cadastro multi-empresa com histórico de projetos de consultoria.
- **Agentes de IA para documentos**: geração automática de PGR, PCMSO, PGRS, políticas (ambiental, SST, canal de denúncia), procedimentos (APR, auditoria interna, controle operacional ambiental) e matrizes (riscos, aspectos/impactos, treinamentos, requisitos legais).
- **Gap analysis e perfil operacional**: agentes que avaliam a empresa e apontam lacunas de conformidade antes de gerar os documentos.
- **Validador de fidelidade legal**: confere se o conteúdo gerado pela IA está alinhado às leis canônicas aplicáveis, com regeneração automática quando encontra divergência.
- **Exportação em PDF**: geração de documentos finais com capa, sumário e formatação pronta para entrega ao cliente.
- **Auto-revisão e chain-of-thought**: agentes revisam e corrigem a própria saída antes de entregar o documento.

## Stack

Next.js (App Router) · TypeScript · Prisma + PostgreSQL · NextAuth · OpenAI · Tailwind CSS

## Requisitos

- Node.js 20 ou superior
- npm
- Banco PostgreSQL
- Chave da OpenAI para os agentes de IA

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`.

```env
DATABASE_URL=""
OPENAI_API_KEY=""
NEXTAUTH_SECRET=""
NEXTAUTH_URL=""
```

Descrição:

- `DATABASE_URL`: URL de conexão PostgreSQL usada pelo Prisma.
- `OPENAI_API_KEY`: chave da OpenAI usada pelos agentes de perfil operacional, gap analysis e documentos.
- `NEXTAUTH_SECRET`: segredo usado pelo NextAuth.
- `NEXTAUTH_URL`: URL base da aplicação. Em desenvolvimento, use `http://localhost:3000` ou a porta local em uso. Na Vercel, use a URL de produção.

## Setup Local

Instale as dependências:

```bash
npm install
```

Gere o Prisma Client:

```bash
npx prisma generate
```

Sincronize o banco em desenvolvimento:

```bash
npx prisma db push
```

Opcionalmente, rode o seed com dados de teste:

```bash
npm run seed
```

Inicie o servidor local:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Scripts

- `npm run dev`: inicia o Next.js em desenvolvimento.
- `npm run build`: gera o Prisma Client e executa o build de produção.
- `npm run start`: inicia a versão de produção após o build.
- `npm run lint`: roda ESLint.
- `npm run seed`: popula o banco com dados de teste.

## Deploy na Vercel

1. Crie ou conecte o projeto na Vercel.
2. Configure as variáveis de ambiente em `Project Settings > Environment Variables`:
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
3. Garanta que o banco PostgreSQL esteja acessível pela Vercel.
4. Use o comando padrão de build:

```bash
npm run build
```

5. Depois do primeiro deploy, rode as migrações ou sincronização do schema conforme o ambiente escolhido.

Para ambiente inicial sem migrations versionadas, use localmente:

```bash
npx prisma db push
```

Para produção com fluxo mais rigoroso, crie migrations Prisma antes do deploy:

```bash
npx prisma migrate dev --name init
```

Depois aplique em produção:

```bash
npx prisma migrate deploy
```

## Observações de Produção

- Não suba `.env` para o repositório.
- Configure `NEXTAUTH_URL` com a URL final da Vercel.
- Os recursos de IA dependem de `OPENAI_API_KEY`.
- O banco precisa conter as tabelas Prisma antes do uso da aplicação.
