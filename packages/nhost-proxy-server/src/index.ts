import { createServer } from 'http';
import { createProxyServer } from 'http-proxy';

const proxy = createProxyServer({ changeOrigin: true });

const nHostUrls = {
  wsGraphql: 'wss://local.hasura.nhost.run/v1',
  graphql: 'https://local.graphql.nhost.run/v1',
  auth: 'https://local.auth.nhost.run/v1',
  storage: 'https://local.storage.nhost.run/v1',
  functions: 'http://127.0.0.1:8787',
  mailhog: 'https://local.mailhog.nhost.run/v1',
  // Access to dashboards
  hasura: 'https://local.hasura.nhost.run',
  dashboard: 'https://local.dashboard.nhost.run',
};

// Http proxy
const server = createServer((req, res) => {
  const nhostService = req.url?.split('/')[1];

  if (!nhostService) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  req.url = req.url?.replace(`/${nhostService}`, '') || '';

  const target = nHostUrls[nhostService as keyof typeof nHostUrls];

  proxy.web(req, res, { target });
});

// Websocket proxy
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: nHostUrls.wsGraphql });
});

server.listen(5050);
console.log(`nhost-proxy-server listening on port 5050`);
