import type { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

const dataSourceThat = (query: () => Promise<unknown>) => ({ query }) as unknown as DataSource;

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    const controller = new HealthController(dataSourceThat(() => Promise.resolve([{ '?column?': 1 }])));

    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('reports degraded rather than throwing when the database is unreachable', async () => {
    const controller = new HealthController(
      dataSourceThat(() => Promise.reject(new Error('connection refused'))),
    );

    await expect(controller.check()).resolves.toEqual({ status: 'degraded', database: 'down' });
  });

  it('stays a 200-shaped answer so a probe can read the body', async () => {
    const controller = new HealthController(dataSourceThat(() => Promise.reject(new Error('x'))));

    const report = await controller.check();

    expect(report.status).toBe('degraded');
    expect(report.database).toBe('down');
  });
});
