const { runFromFile, buildSecurityTemplate } = require('../cli');
const fs = require('fs');
const path = require('path');

describe('CLI helpers', () => {
  const tmpSpecPath = path.join(__dirname, 'tmp-openapi.json');
  const spec = {
    openapi: '3.0.0',
    info: { title: 'CLI Test', version: '1.0.0' },
    servers: [{ url: 'http://example.test' }],
    components: { securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer' } } },
    paths: {
      '/items': {
        get: { operationId: 'listItems', responses: { '200': { description: 'ok' } } },
      },
    },
  };

  beforeAll(() => {
    fs.writeFileSync(tmpSpecPath, JSON.stringify(spec), 'utf8');
  });

  afterAll(() => {
    try { fs.unlinkSync(tmpSpecPath); } catch (_) {}
  });

  test('buildSecurityTemplate outputs handler stubs', () => {
    const tpl = buildSecurityTemplate(spec);
    expect(tpl).toContain('BearerAuth');
  });

  test('runFromFile returns tools JSON summary', async () => {
    const res = await runFromFile({ spec: tmpSpecPath, pretty: false });
    expect(res.type).toBe('json');
    const parsed = JSON.parse(res.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe('listItems');
  });
});

