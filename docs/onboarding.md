# Onboarding — Criation.io

**Meta:** dev senior operacional em 2 dias. Primeira PR real entregue no dia 3.

---

## Dia 1 — Ambiente local

### Setup basico
- [ ] Clone o repositorio: `git clone git@github.com:criationio/criation.io.git`
- [ ] Instale Node 20.x (use nvm: `nvm install 20 && nvm use 20`)
- [ ] Instale pnpm: `npm install -g pnpm@9`
- [ ] Instale dependencias: `pnpm install`
- [ ] Copie `.env.local` da vault compartilhada para a raiz do projeto

### Banco de dados
- [ ] Crie uma conta Supabase dev pessoal (nao use o projeto de producao)
- [ ] Crie um projeto Supabase novo para desenvolvimento local
- [ ] Copie `DATABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do painel para `.env.local`
- [ ] Rode `pnpm db:push` para criar as tabelas no seu Supabase dev
- [ ] Confirme que as 45 tabelas foram criadas: `pnpm db:studio`
- [ ] Rode `pnpm db:seed` para popular seeds iniciais

### Verificacao do ambiente
- [ ] `pnpm lint` -> zero erros
- [ ] `pnpm tsc --noEmit` -> zero erros
- [ ] `pnpm test` -> todos passando
- [ ] `pnpm dev` -> app rodando em localhost:3000
- [ ] Acesse `/api/health` -> deve retornar `{ status: "ok" }`

### Leitura obrigatoria
- [ ] Leia `CLAUDE.md` completo — sao as 20 regras que governam todo o codigo
- [ ] Leia `AGENTS.md` — entenda os 5 agents disponiveis
- [ ] Leia `docs/domain-glossary.md` — familiarize-se com os termos do dominio
- [ ] Navegue por `docs/adr/` — leia pelo menos ADR-001 a ADR-005

---

## Dia 2 — Contexto do produto

### Fluxo de usuario
- [ ] Faca signup local em `localhost:3000/signup`
- [ ] Complete o onboarding (workspace + configuracoes basicas)
- [ ] Conecte uma conta Meta Ads sandbox (credenciais na vault)
- [ ] Dispare uma analise de teste no Estudio
- [ ] Verifique o resultado no dashboard

### Arquitetura do codigo
- [ ] Entenda a estrutura de route groups: `(public)`, `(app)`, `(admin)`
- [ ] Abra um Server Action em `lib/actions/` e trace seu fluxo ate o service
- [ ] Abra um service em `lib/services/` e entenda o padrao Result<T, AppError>
- [ ] Abra um arquivo de query em `lib/db/queries/` e entenda como workspace_id e aplicado
- [ ] Abra `lib/encryption.ts` e entenda o padrao de envelope encryption

### Abra sua primeira PR
- [ ] Crie branch: `git checkout -b feature/seu-nome-typo-fix`
- [ ] Faca uma mudanca pequena (typo em comentario, melhoria de doc)
- [ ] Commit com mensagem semantica: `docs(onboarding): fix typo in setup instructions`
- [ ] Push e abra PR apontando para `develop`
- [ ] Aguarde CI passar (lint + typecheck + test + build)
- [ ] Solicite review

---

## Referencias rapidas

| Recurso | Link |
|---|---|
| Arquitetura completa | `criation-io-arquitetura-v06.html` |
| Drizzle Studio | `pnpm db:studio` |
| Supabase dashboard dev | Painel pessoal do seu projeto |
| Vault de credenciais | (link interno) |
