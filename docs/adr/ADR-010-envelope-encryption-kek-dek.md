# ADR-010 — Envelope Encryption para Credenciais

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** Tokens OAuth de integracoes (Meta Ads, Google Ads) e credenciais de gateways precisam ser armazenados encriptados no banco. Rotacao de chaves nao pode exigir re-encrypt de todos os registros simultaneamente.
**Drivers de decisao:** Seguranca em repouso, rotacao de chaves sem downtime, performance de encrypt/decrypt, simplicidade operacional.
**Opcoes consideradas:**

1. Criptografia por campo com chave unica — rotacao exige re-encrypt total
2. Envelope encryption (KEK/DEK) — rotacao transparente via versionamento
3. KMS externo (AWS KMS, GCP) — mais seguro mas adiciona latencia e vendor lock
4. Sem criptografia — inaceitavel para tokens OAuth

**Decisao:** Envelope encryption com AES-256-GCM. Formato do ciphertext: `version:iv_base64:authTag_base64:encrypted_base64`. Versao no prefixo permite decrypt com chave correta mesmo apos rotacao. `reEncryptIfNeeded()` migra registros on-read para a versao mais recente (lazy rotation).

Chaves gerenciadas via env vars (`ENCRYPTION_KEY`, `ENCRYPTION_KEY_V1`). Rotacao: atualizar ENCRYPTION_KEY e mover a antiga para ENCRYPTION_KEY_V1. Registros sao re-encriptados lazily ou via job batch.

**Consequencias:**

- Positivo: rotacao sem downtime, IV aleatorio por registro (sem pattern leakage), formato auto-descritivo, implementacao pura em Node.js
- Negativo: nao usa HSM/KMS (chave em memoria do processo), operador precisa gerenciar rotacao manual de env vars

---

## Status de implementacao (2026-05-07)

Design alvo (preservado): envelope encryption (KEK + DEK por linha encriptada com KEK central). Esta e a decisao oficial para o produto, alinhada com a Sessao 0.2 do v0.6 e com a necessidade de rotacao trimestral de chaves sem downtime.

Implementacao atual (Fase 0/1 — interim): single-key versionada com prefixo de versao (`v1:iv:authTag:encrypted`), chave em `ENCRYPTION_KEY` lida via `process.env`. 6 testes Vitest cobrem encrypt/decrypt, rotacao por versao, e cross-version decrypt.

Razao do interim: na Fase 0/1 nao ha token de OAuth de cliente persistido. O custo de implementar envelope encryption agora e desproporcional ao risco coberto, considerando que o vetor de ataque (acesso ao banco sem acesso a KEK) nao existe ainda.

**Trigger obrigatorio de migracao: antes do inicio da Sessao 1.3 (Conexao OAuth Meta Ads).** Esta e a primeira sessao a persistir token sensivel real (`meta_connections.access_token`). Sem KEK/DEK, um vazamento do banco expoe tokens diretamente.

Tarefa concreta para a 1.3: refatorar `src/lib/encryption.ts` para gerar DEK por linha, criptografar DEK com KEK, armazenar DEK encriptada junto com payload encriptado. Manter single-key como fallback de leitura para dados antigos durante migracao (se houver). Remover `ENCRYPTION_KEY_V1` e `ENCRYPTION_VERSION` do `process.env` neste momento — passam a ser substituidos pela infraestrutura KEK/DEK.
