import dns from 'node:dns'

export function configureDnsFromEnv() {
  const servers = (process.env.MONGODB_DNS_SERVERS || '').split(',').map((server) => server.trim()).filter(Boolean)
  if (servers.length) dns.setServers(servers)
}
