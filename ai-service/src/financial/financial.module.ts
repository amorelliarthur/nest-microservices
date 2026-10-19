import { Module } from '@nestjs/common';
import { FinancialDataService } from './application/financial-data.service';
import { FINANCIAL_CLIENT } from './domain/financial-client.port';
import { HttpFinancialClient } from './infra/http-financial.client';

@Module({
  providers: [
    { provide: FINANCIAL_CLIENT, useClass: HttpFinancialClient },
    FinancialDataService,
  ],
  exports: [FinancialDataService],
})
export class FinancialModule {}
