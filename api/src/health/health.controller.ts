import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type HealthReport = {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
};

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and database reachability' })
  async check(): Promise<HealthReport> {
    const database = await this.pingDatabase();

    return { status: database === 'up' ? 'ok' : 'degraded', database };
  }

  private async pingDatabase(): Promise<'up' | 'down'> {
    try {
      await this.dataSource.query('select 1');
      return 'up';
    } catch {
      return 'down';
    }
  }
}
