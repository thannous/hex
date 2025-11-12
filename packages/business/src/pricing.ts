import type {
  SupplierPrice,
  MaterialIndex,
  QuoteLine,
  CalculatedQuoteLine,
  CalculationResult,
} from './types';
import { getQualityFlags } from './quality';

/**
 * Calcul du prix d'achat unitaire
 * Règle : priorité au prix fournisseur valide le moins cher, sinon indice matière
 */
export function calculateCoutAchatU(
  supplierPrices: SupplierPrice[],
  lastMaterialIndex?: MaterialIndex,
  baseCost: number = 100 // valeur par défaut si aucun prix/indice
): number {
  if (supplierPrices.length === 0) {
    // Pas de prix fournisseur
    if (!lastMaterialIndex) {
      // Pas d'indice non plus
      return baseCost;
    }
    // Appliquer indice matière
    return baseCost * lastMaterialIndex.coefficient;
  }

  // Filtrer les prix valides (validité_fin > aujourd'hui ou null)
  const today = new Date();
  const validPrices = supplierPrices.filter(
    (p) => !p.validiteFin || new Date(p.validiteFin) > today
  );

  if (validPrices.length === 0) {
    // Aucun prix valide, utiliser indice matière si dispo
    if (!lastMaterialIndex) {
      return baseCost;
    }
    return baseCost * lastMaterialIndex.coefficient;
  }

  // Retourner le prix net minimum
  return Math.min(...validPrices.map((p) => p.prixNet));
}

/**
 * Calcul de la main-d'œuvre unitaire
 * Règle : Temps_U_h × Taux_Horaire
 */
export function calculateMOU(
  tempsUnitaireH: number | undefined,
  tauxHoraireEur: number
): number {
  if (!tempsUnitaireH || tempsUnitaireH <= 0) {
    return 0; // Pas de temps estimé
  }

  return tempsUnitaireH * tauxHoraireEur;
}

/**
 * Calcul du prix de vente unitaire
 * Règle : PV = (Achats + MO) / (1 - marge%)
 */
export function calculatePVU(
  coutAchatU: number,
  moU: number,
  margePct: number
): number {
  const coutTotalU = coutAchatU + moU;
  const margineFraction = margePct / 100;

  if (margineFraction >= 1) {
    // Marge invalide (>=100%)
    console.warn(`Marge invalide: ${margePct}%`);
    return coutTotalU * 2; // Fallback: doubler le coût
  }

  return coutTotalU / (1 - margineFraction);
}

/**
 * Calcul de la ligne totale
 * Règle : Quantité × PV_U
 */
export function calculateTotalLigne(
  quantite: number,
  pvU: number
): number {
  return quantite * pvU;
}

/**
 * Calcul complet d'une ligne de devis
 */
export function calculateQuoteLine(line: QuoteLine): CalculatedQuoteLine {
  const { quantite, catalogueItem, supplierPrices, lastMaterialIndex, context } =
    line;

  // 1. Coût d'achat unitaire
  const coutAchatU = calculateCoutAchatU(
    supplierPrices,
    lastMaterialIndex,
    100
  );

  // 2. MO unitaire
  const moU = calculateMOU(catalogueItem.tempsUnitaireH, context.tauxHoraireEur);

  // 3. PV unitaire
  const pvU = calculatePVU(coutAchatU, moU, context.margePct);

  // 4. Total ligne
  const totalLigne = calculateTotalLigne(quantite, pvU);

  const calculated: CalculatedQuoteLine = {
    coutAchatU,
    moU,
    pvU,
    totalLigne,
    flags: [],
  };

  // 5. Flags qualité
  calculated.flags = getQualityFlags(line, calculated);

  return calculated;
}

/**
 * Calcul complet d'un devis
 */
export function calculateQuote(lines: QuoteLine[]): CalculationResult {
  const calculatedLines = lines.map(calculateQuoteLine);

  const totalAchats = calculatedLines.reduce(
    (sum, line) => sum + line.coutAchatU,
    0
  );
  const totalMO = calculatedLines.reduce((sum, line) => sum + line.moU, 0);
  const totalPV = calculatedLines.reduce(
    (sum, line) => sum + line.totalLigne,
    0
  );

  return {
    lines: calculatedLines,
    totalAchats,
    totalMO,
    totalPV,
  };
}

/**
 * Déterminer le prix net d'un prix brut avec remise
 * Règle : prix_net = prix_brut × (1 - remise%)
 */
export function calculatePrixNet(
  prixBrut: number,
  remisePct: number
): number {
  return prixBrut * (1 - remisePct / 100);
}
