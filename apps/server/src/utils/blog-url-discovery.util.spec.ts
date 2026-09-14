import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, describe, it } from 'node:test';
import {
  blogRootCandidates,
  findBlogArticleForDay,
} from '../api/services/daily-content/blog-url-discovery.util';

type Routes = Record<string, { status?: number; body: string; type?: string }>;

const servers: Server[] = [];

async function startServer(routes: Routes): Promise<string> {
  const server = createServer((req, res) => {
    const path = (req.url || '').split('?')[0];
    const route = routes[path];
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html>not found</html>');
      return;
    }
    res.writeHead(route.status ?? 200, {
      'Content-Type': route.type ?? 'application/json',
    });
    res.end(route.body);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return `http://127.0.0.1:${address.port}`;
}

after(async () => {
  await Promise.all(
    servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});

describe('blogRootCandidates', () => {
  it('adds a scheme and keeps both the path and the bare origin', () => {
    assert.deepEqual(blogRootCandidates('example.com/blog'), [
      'https://example.com/blog',
      'https://example.com',
    ]);
  });

  it('collapses to one root when there is no path', () => {
    assert.deepEqual(blogRootCandidates('https://example.com/'), [
      'https://example.com',
    ]);
  });

  it('rejects empty and non-http input', () => {
    assert.deepEqual(blogRootCandidates(''), []);
    assert.deepEqual(blogRootCandidates('mailto:a@b.com'), []);
    assert.deepEqual(blogRootCandidates('ftp://example.com'), []);
  });

  it('treats host:port as a host, not a scheme', () => {
    assert.deepEqual(blogRootCandidates('example.com:8080/blog'), [
      'https://example.com:8080/blog',
      'https://example.com:8080',
    ]);
  });
});

describe('findBlogArticleForDay via WordPress REST', () => {
  it('returns the newest article on the target local day', async () => {
    const base = await startServer({
      '/wp-json/wp/v2/posts': {
        body: JSON.stringify([
          { link: 'https://blog.test/newest', date_gmt: '2026-09-14T18:00:00' },
          { link: 'https://blog.test/earlier', date_gmt: '2026-09-14T06:00:00' },
        ]),
      },
    });

    const found = await findBlogArticleForDay({
      baseUrl: base,
      localDate: '2026-09-14',
      timeZone: 'UTC',
    });

    assert.equal(found?.url, 'https://blog.test/newest');
    assert.equal(found?.source, 'wp-rest');
  });

  it('skips articles that fall on a different day in the account timezone', async () => {
    // 22:30 UTC on the 14th is already 01:30 on the 15th in Asia/Nicosia (+3).
    const routes: Routes = {
      '/wp-json/wp/v2/posts': {
        body: JSON.stringify([
          { link: 'https://blog.test/late', date_gmt: '2026-09-14T22:30:00' },
        ]),
      },
    };

    const base = await startServer(routes);

    const onThe14th = await findBlogArticleForDay({
      baseUrl: base,
      localDate: '2026-09-14',
      timeZone: 'Asia/Nicosia',
    });
    assert.equal(onThe14th, null);

    const onThe15th = await findBlogArticleForDay({
      baseUrl: base,
      localDate: '2026-09-15',
      timeZone: 'Asia/Nicosia',
    });
    assert.equal(onThe15th?.url, 'https://blog.test/late');
  });

  it('ignores a non-JSON response instead of throwing', async () => {
    const base = await startServer({
      '/wp-json/wp/v2/posts': { body: '<html>nope</html>', type: 'text/html' },
    });

    const found = await findBlogArticleForDay({
      baseUrl: base,
      localDate: '2026-09-14',
      timeZone: 'UTC',
    });
    assert.equal(found, null);
  });
});

describe('findBlogArticleForDay via feed fallback', () => {
  it('falls back to RSS and picks the newest same-day item', async () => {
    const base = await startServer({
      '/feed': {
        type: 'application/rss+xml',
        body: `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Older</title>
    <link>https://blog.test/rss-older</link>
    <pubDate>Mon, 14 Sep 2026 07:00:00 +0000</pubDate>
  </item>
  <item>
    <title>Newer</title>
    <link><![CDATA[https://blog.test/rss-newer]]></link>
    <pubDate>Mon, 14 Sep 2026 19:00:00 +0000</pubDate>
  </item>
  <item>
    <title>Wrong day</title>
    <link>https://blog.test/rss-wrong-day</link>
    <pubDate>Sun, 13 Sep 2026 19:00:00 +0000</pubDate>
  </item>
</channel></rss>`,
      },
    });

    const found = await findBlogArticleForDay({
      baseUrl: base,
      localDate: '2026-09-14',
      timeZone: 'UTC',
    });

    assert.equal(found?.url, 'https://blog.test/rss-newer');
    assert.equal(found?.source, 'feed');
  });

  it('reads Atom entries with href links', async () => {
    const base = await startServer({
      '/atom.xml': {
        type: 'application/xml',
        body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom post</title>
    <link rel="alternate" href="https://blog.test/atom-post"/>
    <published>2026-09-14T12:00:00Z</published>
  </entry>
</feed>`,
      },
    });

    const found = await findBlogArticleForDay({
      baseUrl: base,
      localDate: '2026-09-14',
      timeZone: 'UTC',
    });
    assert.equal(found?.url, 'https://blog.test/atom-post');
  });
});

describe('findBlogArticleForDay failure handling', () => {
  it('returns null for an unreachable host rather than throwing', async () => {
    const found = await findBlogArticleForDay({
      baseUrl: 'http://127.0.0.1:1',
      localDate: '2026-09-14',
      timeZone: 'UTC',
      timeoutMs: 500,
    });
    assert.equal(found, null);
  });

  it('returns null when nothing was published that day', async () => {
    const base = await startServer({
      '/wp-json/wp/v2/posts': { body: '[]' },
    });
    const found = await findBlogArticleForDay({
      baseUrl: base,
      localDate: '2026-09-14',
      timeZone: 'UTC',
    });
    assert.equal(found, null);
  });
});
