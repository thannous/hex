import { describe, expect, it } from 'vitest';
import {
  calculateCoutAchatU,
  calculateQuote,
  calculateQuoteLine,
} from './pricing';
import type { QuoteLine, SupplierPrice } from './types';

const dayMs = 24 * 60 * 60 * 1000;

const futureDate = (daysFromNow: number) => new Date(Date.now() + daysFromNow * dayMs);
const pastDate = (daysAgo: number) => new Date(Date.now() - daysAgo * dayMs);

const buildSupplierPrice = (overrides: Partial<SupplierPrice> = {}): SupplierPrice => ({
  id: overrides.id ?? 'sp',
  supplerName: overrides.supplerName ?? 'Vendor',
  prixBrut: overrides.prixBrut ?? 100,
  remisePct: overrides.remisePct ?? 0,
  prixNet: overrides.prixNet ?? overrides.prixBrut ?? 100,
  validiteFin: overrides.validiteFin,
});

describe('calculateCoutAchatU', () => {
  it('returns the provided base cost when no prices or index exist', () => {
    expect(calculateCoutAchatU([], undefined, 150)).toBe(150);
  });

  it('relies on the last material index multiplier when no price matches', () => {
    const amount = calculateCoutAchatU(
      [],
      {
        matiere: 'acier',
        coefficient: 1.2,
        date: new Date(),
      },
      200
    );

    expect(amount).toBeCloseTo(240, 5);
  });

  it('picks the cheapest valid supplier price and ignores expired ones', () => {
    const prices: SupplierPrice[] = [
      buildSupplierPrice({ id: 'expired', prixNet: 70, validiteFin: pastDate(1) }),
      buildSupplierPrice({ id: 'valid-a', prixNet: 95, validiteFin: futureDate(5) }),
      buildSupplierPrice({ id: 'valid-b', prixNet: 90, validiteFin: futureDate(30) }),
    ];

    expect(calculateCoutAchatU(prices, undefined, 100)).toBe(90);
  });
});

describe('calculateQuoteLine and calculateQuote', () => {
  const baseLine: QuoteLine = {
    quantite: 5,
    catalogueItem: {
      id: 'sku-1',
      hexCode: 'HX-01',
      designation: 'Support acier',
      tempsUnitaireH: 1.5,
    },
    supplierPrices: [
      buildSupplierPrice({ id: 'main', prixNet: 80, validiteFin: futureDate(15) }),
    ],
    lastMaterialIndex: {
      matiere: 'acier',
      date: new Date(),
      coefficient: 1.1,
    },
    context: {
      tauxHoraireEur: 60,
      margePct: 25,
    },
  };

  it('derives the full pricing breakdown for a single line', () => {
    const result = calculateQuoteLine(baseLine);

    expect(result.coutAchatU).toBe(80);
    expect(result.moU).toBe(90);
    expect(result.pvU).toBeCloseTo(226.6666667, 6);
    expect(result.totalLigne).toBeCloseTo(1133.3333333, 6);
    expect(result.flags).toEqual([]);
  });

  it('aggregates a full quote and propagates quality flags', () => {
    const missingTempsLine: QuoteLine = {
      quantite: 2,
      catalogueItem: {
        id: 'sku-2',
        hexCode: 'HX-02',
        designation: 'Profil aluminium',
      },
      supplierPrices: [],
      lastMaterialIndex: {
        matiere: 'alu',
        date: new Date(),
        coefficient: 1.1,
      },
      context: {
        tauxHoraireEur: 50,
        margePct: 20,
      },
    };

    const quote = calculateQuote([baseLine, missingTempsLine]);

    expect(quote.lines).toHaveLength(2);
    expect(quote.lines[1].flags).toContain('temps_manquant');
    expect(quote.totalAchats).toBeCloseTo(190, 5);
    expect(quote.totalMO).toBeCloseTo(90, 5);
    expect(quote.totalPV).toBeCloseTo(1408.3333333, 6);
  });
});
