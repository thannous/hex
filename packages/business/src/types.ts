export interface CatalogueItem {
  id: string;
  hexCode: string;
  designation: string;
  tempsUnitaireH?: number;
  matiere?: string;
}

export interface SupplierPrice {
  id: string;
  supplerName: string;
  prixBrut: number;
  remisePct: number;
  prixNet: number;
  validiteFin?: Date;
}

export interface MaterialIndex {
  matiere: string;
  date: Date;
  coefficient: number;
}

export interface PricingContext {
  tauxHoraireEur: number;
  margePct: number;
  lot?: string;
}

export interface QuoteLine {
  quantite: number;
  catalogueItem: CatalogueItem;
  supplierPrices: SupplierPrice[];
  lastMaterialIndex?: MaterialIndex;
  context: PricingContext;
}

export interface CalculatedQuoteLine {
  coutAchatU: number;
  moU: number;
  pvU: number;
  totalLigne: number;
  flags: QualityFlag[];
}

export type QualityFlag =
  | 'prix_obsolete'
  | 'prix_manquant'
  | 'incoherence_um'
  | 'temps_manquant';

export interface CalculationResult {
  lines: CalculatedQuoteLine[];
  totalAchats: number;
  totalMO: number;
  totalPV: number;
}
