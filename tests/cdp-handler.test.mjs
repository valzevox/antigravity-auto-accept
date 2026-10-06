import http from 'http';
import { createRequire } from 'module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { CDPHandler } = require('../main_scripts/cdp-handler');

function listen(server) {
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });
}

function close(server) {
    return new Promise((resolve) => server.close(resolve));
}

describe('CDPHandler target discovery', () => {
    test('keeps document-backed iframe targets and skips non-document targets', async () => {
        const server = http.createServer((req, res) => {
            if (req.url !== '/json/list') {
                res.writeHead(404);
                res.end();
                return;
            }

            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify([
                {
                    id: 'page-1',
                    type: 'page',
                    url: 'https://example.test',
                    webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/page-1'
                },
                {
                    id: 'iframe-1',
                    type: 'iframe',
                    url: 'https://example.test/frame',
                    webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/iframe-1'
                },
                {
                    id: 'worker-1',
                    type: 'service_worker',
                    url: 'https://example.test/sw.js',
                    webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/worker-1'
                },
                {
                    id: 'devtools-1',
                    type: 'page',
                    url: 'devtools://devtools/bundled/inspector.html',
                    webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/devtools-1'
                }
            ]));
        });

        const port = await listen(server);
        try {
            const handler = new CDPHandler(() => {});
            const pages = await handler._getPages(port);
            expect(pages.map(page => page.id)).toEqual(['page-1', 'iframe-1']);
        } finally {
            await close(server);
        }
    });

    test('counts attached child sessions as live CDP connections', () => {
        const handler = new CDPHandler(() => {});
        handler.connections.set('9222:page-1', {
            childSessions: new Map([
                ['session-1', {}],
                ['session-2', {}]
            ])
        });

        expect(handler.getConnectionCount()).toBe(3);
    });
});
