import type { QuoteLine, QualityFlag, CalculatedQuoteLine } from './types';

/**
 * Évaluer les flags de qualité d'une ligne
 *
 * Règles :
 * - "prix_obsolete": prix valide depuis plus de 90 jours
 * - "prix_manquant": aucun prix fournisseur valide et pas d'indice matière
 * - "incoherence_um": problème d'unité de mesure (non implémenté pour MVP)
 * - "temps_manquant": temps unitaire absent pour calcul MO
 */
export function getQualityFlags(
  line: QuoteLine,
  calculated: CalculatedQuoteLine
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  // Check: temps_manquant
  if (!line.catalogueItem.tempsUnitaireH || line.catalogueItem.tempsUnitaireH <= 0) {
    flags.push('temps_manquant');
  }

  // Check: prix_manquant ou prix_obsolete
  if (line.supplierPrices.length === 0) {
    // Pas de prix fournisseur
    if (!line.lastMaterialIndex) {
      // Pas d'indice non plus
      flags.push('prix_manquant');
    }
  } else {
    // Vérifier validité des prix
    const today = new Date();
    const validPrices = line.supplierPrices.filter(
      (p) => !p.validiteFin || new Date(p.validiteFin) > today
    );

    if (validPrices.length === 0) {
      // Aucun prix valide
      flags.push('prix_obsolete');
    } else {
      // Vérifier si le prix valide le plus ancien dépasse 90 jours
      const oldestValidPrice = validPrices.reduce((oldest, current) => {
        if (!oldest.validiteFin) return oldest;
        if (!current.validiteFin) return current;
        return new Date(current.validiteFin) < new Date(oldest.validiteFin)
          ? current
          : oldest;
      });

      if (oldestValidPrice.validiteFin) {
        const daysOld = Math.floor(
          (today.getTime() - new Date(oldestValidPrice.validiteFin).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysOld > 90) {
          flags.push('prix_obsolete');
        }
      }
    }
  }

  // Check: incoherence_um (simplifié pour MVP)
  // TODO: implémenter une logique plus complexe si besoin

  return flags;
}

/**
 * Déterminer si une ligne nécessite une réactualisation (mise à jour prix/indices)
 * Règle : prix manquant OU >90 j OU prix = 0 OU temps manquant
 */
export function requiresUpdate(line: QuoteLine): boolean {
  const flags = getQualityFlags(line, {
    coutAchatU: 0,
    moU: 0,
    pvU: 0,
    totalLigne: 0,
    flags: [],
  });

  return flags.length > 0;
}

/**
 * Générer un rapport de qualité pour un devis entier
 */
export interface QualityReport {
  totalLines: number;
  linesWithFlags: number;
  flagCounts: Record<QualityFlag, number>;
  requiresAction: boolean;
}

export function generateQualityReport(
  lines: QuoteLine[],
  calculatedLines: CalculatedQuoteLine[]
): QualityReport {
  const flagCounts: Record<QualityFlag, number> = {
    prix_obsolete: 0,
    prix_manquant: 0,
    incoherence_um: 0,
    temps_manquant: 0,
  };

  let linesWithFlags = 0;

  calculatedLines.forEach((calculated) => {
    if (calculated.flags.length > 0) {
      linesWithFlags++;
      calculated.flags.forEach((flag) => {
        flagCounts[flag]++;
      });
    }
  });

  return {
    totalLines: lines.length,
    linesWithFlags,
    flagCounts,
    requiresAction: linesWithFlags > 0,
  };
}
