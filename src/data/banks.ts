/**
 * Curated Indian banks for picker UI; extend as needed.
 * Card PANs must never be stored at rest—persist last4 + brand only; see getCardType() and payment routes.
 */
export type BankCatalogEntry = {
  id: string;
  name: string;
  /** Public HTTPS logo URL (or replace with your CDN asset keys). */
  logo_url: string;
};

export const BANK_CATALOG: readonly BankCatalogEntry[] = [
  {
    id: "sbi",
    name: "State Bank of India",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779122220/sbi_cmldbz.png",
  },
  {
    id: "hdfc",
    name: "HDFC Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779122991/hdfc_dhqdak.png",
  },
  {
    id: "icici",
    name: "ICICI Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779122218/icici_hr6jdm.png",
  },
  {
    id: "axis",
    name: "Axis Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779120364/axis_xpxmfx.png",
  },
  {
    id: "kotak",
    name: "Kotak Mahindra Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779122219/kotak_nlhlco.png",
  },
  {
    id: "pnb",
    name: "Punjab National Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779120792/punjab_kyhqzv.png",
  },
  {
    id: "bob",
    name: "Bank of Baroda",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779120365/bob_end2uc.png",
  },
  {
    id: "boi",
    name: "Bank of India",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779121377/boi_zp6u4z.png",
    // logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779120365/boi_pzxirt.png",
  },
  {
    id: "canara",
    name: "Canara Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779122907/canara_itk4vd.png",
  },
  {
    id: "union",
    name: "Union Bank of India",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779122741/union_xspfqm.png",
  },
  {
    id: "idfc",
    name: "IDFC FIRST Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779130809/627ccb991b2e263b45696aa9_kguyqx.png",
  },
  {
    id: "yes",
    name: "Yes Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779120792/yes_brizgl.png",
  },
  {
    id: "indusind",
    name: "IndusInd Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779120902/indusind_nztl88.png",
  },
  {
    id: "federal",
    name: "Federal Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779120792/federal_qahlvy.png",
  },
  {
    id: "rbl",
    name: "RBL Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779120792/rbl_lvjbvi.png",
  },
  {
    id: "citi",
    name: "Citibank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779122218/citi_ckv0ry.png",
  },
  {
    id: "bandhan",
    name: "Bandhan Bank",
    logo_url: "https://res.cloudinary.com/dsnxu6br1/image/upload/v1779121108/bandhan_swxms9.png",
  },
];

export function bankById(id: string): BankCatalogEntry | undefined {
  return BANK_CATALOG.find((b) => b.id === id);
}
