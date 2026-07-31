// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Finance Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessFinanceDTO, FinancialItemDTO } from './BusinessDTO.js';

export class BusinessFinanceService {
  private readonly finances = new Map<string, BusinessFinanceDTO>();

  getFinance(userId: string): BusinessFinanceDTO {
    const existing = this.finances.get(userId);
    if (existing) return existing;
    const finance = this.createDefault();
    this.finances.set(userId, finance);
    return finance;
  }

  setFinance(userId: string, finance: BusinessFinanceDTO): void {
    this.finances.set(userId, { ...finance, lastUpdated: new Date().toISOString() });
  }

  updateRevenue(userId: string, items: FinancialItemDTO[]): BusinessFinanceDTO {
    const finance = this.getFinance(userId);
    const total = items.reduce((s, i) => s + i.amount, 0);
    finance.revenue = {
      ...finance.revenue,
      currentPeriod: total,
      items,
      trend: total >= finance.revenue.previousPeriod ? 'up' : 'down',
      variance: total - finance.revenue.budgeted,
    };
    this.finances.set(userId, finance);
    return finance;
  }

  updateExpenses(userId: string, items: FinancialItemDTO[]): BusinessFinanceDTO {
    const finance = this.getFinance(userId);
    const total = items.reduce((s, i) => s + i.amount, 0);
    finance.expenses = {
      ...finance.expenses,
      currentPeriod: total,
      items,
      trend: total <= finance.expenses.previousPeriod ? 'up' : 'down',
      variance: total - finance.expenses.budgeted,
    };
    this.finances.set(userId, finance);
    return finance;
  }

  calculateProfitability(userId: string): BusinessFinanceDTO {
    const finance = this.getFinance(userId);
    const revenue = finance.revenue.currentPeriod;
    const expenses = finance.expenses.currentPeriod;
    const cogs = revenue * 0.4;
    finance.profitability = {
      grossMargin: revenue > 0 ? Math.round(((revenue - cogs) / revenue) * 100) : 0,
      netMargin: revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : 0,
      operatingMargin: revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : 0,
      ebitda: revenue - expenses,
      revenue,
      costOfGoodsSold: cogs,
      operatingExpenses: expenses,
    };
    this.finances.set(userId, finance);
    return finance;
  }

  resetFinance(userId: string): BusinessFinanceDTO {
    const finance = this.createDefault();
    this.finances.set(userId, finance);
    return finance;
  }

  private createDefault(): BusinessFinanceDTO {
    return {
      revenue: {
        currentPeriod: 0,
        previousPeriod: 0,
        budgeted: 0,
        variance: 0,
        trend: 'stable',
        items: [],
      },
      expenses: {
        currentPeriod: 0,
        previousPeriod: 0,
        budgeted: 0,
        variance: 0,
        trend: 'stable',
        items: [],
      },
      cashFlow: {
        operating: 0,
        investing: 0,
        financing: 0,
        netCashFlow: 0,
        beginningBalance: 0,
        endingBalance: 0,
      },
      profitability: {
        grossMargin: 0,
        netMargin: 0,
        operatingMargin: 0,
        ebitda: 0,
        revenue: 0,
        costOfGoodsSold: 0,
        operatingExpenses: 0,
      },
      currency: 'USD',
      fiscalYear: new Date().getFullYear().toString(),
      lastUpdated: new Date().toISOString(),
    };
  }
}
