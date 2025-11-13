import { describe, expect, it } from 'vitest';
import { generateQualityReport, getQualityFlags, requiresUpdate } from './quality';
import type { CalculatedQuoteLine, QuoteLine } from './types';

const baseLine = (): QuoteLine => ({
  quantite: 1,
  catalogueItem: {
    id: 'sku',
    hexCode: 'HX',
    designation: 'Pièce',
    tempsUnitaireH: 1,
  },
  supplierPrices: [],
  context: {
    tauxHoraireEur: 50,
    margePct: 20,
  },
});

const calculatedSkeleton = (overrides: Partial<CalculatedQuoteLine> = {}): CalculatedQuoteLine => ({
  coutAchatU: 0,
  moU: 0,
  pvU: 0,
  totalLigne: 0,
  flags: [],
  ...overrides,
});

describe('getQualityFlags', () => {
  it('marks missing prices when no supplier data nor index exist', () => {
    const line = baseLine();

    const flags = getQualityFlags(line, calculatedSkeleton());

    expect(flags).toContain('prix_manquant');
    expect(flags).not.toContain('temps_manquant');
  });

  it('marks obsolete prices when every supplier price is expired', () => {
    const line: QuoteLine = {
      ...baseLine(),
      supplierPrices: [
        {
          id: 'old',
          supplerName: 'Legacy Vendor',
          prixBrut: 120,
          remisePct: 10,
          prixNet: 108,
          validiteFin: new Date('2023-01-01'),
        },
      ],
    };

    const flags = getQualityFlags(line, calculatedSkeleton());

    expect(flags).toContain('prix_obsolete');
  });
});

describe('requiresUpdate & generateQualityReport', () => {
  it('returns true when any flag is present', () => {
    const line = baseLine();
    const needsRefresh = requiresUpdate(line);

    expect(needsRefresh).toBe(true);
  });

  it('summarizes flag counts across calculated lines', () => {
    const lines = [baseLine(), baseLine()];
    const calculated: CalculatedQuoteLine[] = [
      calculatedSkeleton({ flags: ['prix_manquant', 'temps_manquant'] }),
      calculatedSkeleton(),
    ];

    const report = generateQualityReport(lines, calculated);

    expect(report.linesWithFlags).toBe(1);
    expect(report.flagCounts.prix_manquant).toBe(1);
    expect(report.flagCounts.temps_manquant).toBe(1);
    expect(report.requiresAction).toBe(true);
  });
});
