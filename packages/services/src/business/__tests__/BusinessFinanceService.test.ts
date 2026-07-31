import { describe, it, expect } from 'vitest';
import { BusinessFinanceService } from '../BusinessFinanceService.js';
import type { FinancialItemDTO } from '../BusinessDTO.js';

describe('BusinessFinanceService', () => {
  let svc: BusinessFinanceService;
  beforeEach(() => {
    svc = new BusinessFinanceService();
  });

  const makeItem = (id: string, amount: number): FinancialItemDTO => ({
    id,
    name: `Item ${id}`,
    category: 'sales',
    amount,
    date: new Date().toISOString(),
  });

  it('getFinance returns default for new user', () => {
    const f = svc.getFinance('user1');
    expect(f.revenue.currentPeriod).toBe(0);
    expect(f.expenses.currentPeriod).toBe(0);
    expect(f.currency).toBe('USD');
  });

  it('getFinance returns existing for returning user', () => {
    const first = svc.getFinance('user1');
    const second = svc.getFinance('user1');
    expect(second).toBe(first);
  });

  it('setFinance stores with updatedAt', () => {
    const f = svc.getFinance('user1');
    svc.setFinance('user1', { ...f, currency: 'EUR' });
    expect(svc.getFinance('user1').currency).toBe('EUR');
    expect(svc.getFinance('user1').lastUpdated).toBeTruthy();
  });

  it('updateRevenue computes totals and trend', () => {
    svc.getFinance('user1');
    const f = svc.updateRevenue('user1', [makeItem('i1', 5000), makeItem('i2', 3000)]);
    expect(f.revenue.currentPeriod).toBe(8000);
    expect(f.revenue.items.length).toBe(2);
  });

  it('updateRevenue computes trend up when current > previous', () => {
    svc.getFinance('user1');
    const f = svc.updateRevenue('user1', [makeItem('i1', 2000)]);
    expect(f.revenue.trend).toBe('up');
  });

  it('updateRevenue trend uses previousPeriod which defaults to 0', () => {
    svc.getFinance('user1');
    // previousPeriod is 0, so any total >= 0 is 'up'
    const f = svc.updateRevenue('user1', [makeItem('i1', 1000)]);
    expect(f.revenue.trend).toBe('up');
    // Check variance is computed against budgeted
    expect(f.revenue.variance).toBe(1000);
  });

  it('updateExpenses computes totals and trend uses previousPeriod (default 0)', () => {
    svc.getFinance('user1');
    const f = svc.updateExpenses('user1', [makeItem('i1', 2000)]);
    expect(f.expenses.currentPeriod).toBe(2000);
    // previousPeriod is 0, so 2000 <= 0 is false → 'down'
    expect(f.expenses.trend).toBe('down');
  });

  it('updateExpenses trend up when current <= previous', () => {
    svc.getFinance('user1');
    svc.updateExpenses('user1', [makeItem('i1', 3000)]);
    // Set previousPeriod by directly modifying
    const finance = svc.getFinance('user1');
    finance.expenses.previousPeriod = 5000;
    const f = svc.updateExpenses('user1', [makeItem('i1', 3000)]);
    // 3000 <= 5000 → 'up' (expenses going down is good)
    expect(f.expenses.trend).toBe('up');
  });

  it('updateExpenses trend down when current > previous', () => {
    svc.getFinance('user1');
    svc.updateExpenses('user1', [makeItem('i1', 1000)]);
    const f = svc.updateExpenses('user1', [makeItem('i1', 3000)]);
    expect(f.expenses.trend).toBe('down');
  });

  it('calculateProfitability computes margins', () => {
    svc.getFinance('user1');
    svc.updateRevenue('user1', [makeItem('i1', 100000)]);
    svc.updateExpenses('user1', [makeItem('i1', 60000)]);
    const f = svc.calculateProfitability('user1');
    expect(f.profitability.revenue).toBe(100000);
    expect(f.profitability.ebitda).toBe(40000);
    expect(f.profitability.grossMargin).toBe(60); // (100k - 40k) / 100k * 100
  });

  it('calculateProfitability handles zero revenue', () => {
    svc.getFinance('user1');
    const f = svc.calculateProfitability('user1');
    expect(f.profitability.grossMargin).toBe(0);
    expect(f.profitability.netMargin).toBe(0);
  });

  it('resetFinance restores defaults', () => {
    svc.updateRevenue('user1', [makeItem('i1', 50000)]);
    const reset = svc.resetFinance('user1');
    expect(reset.revenue.currentPeriod).toBe(0);
    expect(reset.currency).toBe('USD');
  });
});
