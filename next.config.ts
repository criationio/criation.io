import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Webhooks de gateways (Hotmart, etc) podem chegar com ou sem trailing
  // slash. Hotmart NAO segue redirects 308, entao deixamos o handler aceitar
  // ambas as variantes em vez de redirecionar.
  skipTrailingSlashRedirect: true,
}

export default nextConfig
