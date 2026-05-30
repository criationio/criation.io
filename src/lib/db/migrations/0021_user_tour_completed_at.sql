-- Sessao 1.5 restruct — `users.tour_completed_at` rastreia se o user ja
-- viu o tour interativo no dashboard (react-joyride). NULL = nunca viu —
-- tour dispara automaticamente. Setado uma vez quando user finaliza ou
-- skipa o tour. Help icon na topbar permite replay (nao zera essa flag).
--
-- Aditivo puro, zero-downtime. Nullable sem default.

ALTER TABLE "users" ADD COLUMN "tour_completed_at" timestamptz;
