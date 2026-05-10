-- 0008_meta_ad_account_link.sql — Liga campaigns/ad_sets/ads a meta_ad_accounts.
--
-- Motivacao: quando cliente troca a conta vinculada no Meta, campaigns/ad_sets/ads
-- da conta antiga ficavam zumbi no banco (sem FK pra ad_account, impossivel filtrar).
-- Listagens (ex: utm-mappings) misturavam ads de contas removidas.
--
-- Esta migration:
-- 1. Adiciona meta_ad_account_id em campaigns/ad_sets/ads (FK opcional, ON DELETE SET NULL)
-- 2. Cria indices pra queries por ad_account
-- 3. Backfill via Meta API + sync atualizado entram no proximo PR
--
-- Aditivo zero-downtime.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS meta_ad_account_id uuid REFERENCES meta_ad_accounts(id) ON DELETE SET NULL;

ALTER TABLE ad_sets
  ADD COLUMN IF NOT EXISTS meta_ad_account_id uuid REFERENCES meta_ad_accounts(id) ON DELETE SET NULL;

ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS meta_ad_account_id uuid REFERENCES meta_ad_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaigns_meta_ad_account_idx ON campaigns(meta_ad_account_id);
CREATE INDEX IF NOT EXISTS ad_sets_meta_ad_account_idx ON ad_sets(meta_ad_account_id);
CREATE INDEX IF NOT EXISTS ads_meta_ad_account_idx ON ads(meta_ad_account_id);
