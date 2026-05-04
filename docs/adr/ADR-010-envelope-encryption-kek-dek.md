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
