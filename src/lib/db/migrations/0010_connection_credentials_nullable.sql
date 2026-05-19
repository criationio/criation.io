-- 0010_connection_credentials_nullable.sql — Audit fix A2 (Sessao 1.4.A.10)
--
-- Aditivo zero-downtime: torna `encrypted_credentials` NULLABLE para suportar
-- conexoes que nao tem credenciais (CDP/analytics — usa `config.originAllowlist`
-- em vez de OAuth/token). Gateways/Meta continuam exigindo via app-level check.
--
-- Antes deste fix, `ensureTrackingConnection` passava '' (string vazia) pra
-- contornar NOT NULL — violava contrato do schema.

ALTER TABLE connections
  ALTER COLUMN encrypted_credentials DROP NOT NULL;

COMMENT ON COLUMN connections.encrypted_credentials IS
  'Cifrado via encrypt(). Nullable: CDP/analytics nao tem credenciais (origin allowlist via config). Gateways/Meta tem credenciais obrigatorias enforced em app-level.';
