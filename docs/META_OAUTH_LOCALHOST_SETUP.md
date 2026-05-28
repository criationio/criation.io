# Meta OAuth em localhost — setup

**Sintoma:** ao clicar "Conectar com Facebook" no `/bem-vindo/meta` rodando em `pnpm dev`, o Meta retorna:

> Não é possível carregar a URL
> O domínio dessa URL não está incluído nos domínios do app.

**Causa:** o Meta App da Criation só aceita `criation.io` como domínio autorizado. `localhost:3001` não está na lista de Valid OAuth Redirect URIs.

## Opção 1 — adicionar localhost ao Meta App (recomendado pra dev iterativo)

1. https://developers.facebook.com/apps → selecione o app **Criation**
2. **Use cases** → **Customize** → **Facebook Login for Business** → **Settings**
3. **Valid OAuth Redirect URIs** — adicione:
   ```
   http://localhost:3001/api/oauth/meta/callback
   http://localhost:3000/api/oauth/meta/callback
   ```
4. **App Domains** (sidebar **Settings → Basic**) — adicione: `localhost`
5. Save changes (precisa ter o app em "In Development" ou Live; localhost só funciona com Test Users em qualquer caso)
6. Adicionar seu user (Vinicius) como **Test User** ou **App Developer/Admin** se ainda não estiver

⚠️ **Importante:** Test Users (e Admin/Developer roles) são os únicos que conseguem fazer OAuth quando o app está em Development mode. Cliente final só funciona pós-App Review.

## Opção 2 — cloudflared tunnel (recomendado pra smoke E2E completo)

Já documentado em `~/.claude/projects/.../memory/reference_webhook_e2e_setup.md`. Resumo:

```bash
cloudflared tunnel --url http://localhost:3001
# vai cuspir uma URL https://random.trycloudflare.com
```

Adicionar essa URL aos Valid OAuth Redirect URIs do Meta App + setar `NEXT_PUBLIC_APP_URL` pra essa URL no `.env.local` + restartar `pnpm dev`.

## Opção 3 — pular Meta no wizard (mais rápido pra UX testing)

Botão "Configurar depois" ou "Pular para a etapa seguinte" no step Meta agora funcionam (Fix #4 aplicado em 2026-05-28). Útil pra validar UX dos próximos steps sem precisar tocar configuração de OAuth.

## Cenário em prod

Em `criation.io`, OAuth Meta funciona pra você + outros admins do app. Pra cliente externo qualquer, precisa concluir App Review do Meta (timeline 4-12 semanas).
