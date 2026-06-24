export function normalizePlanHoldingAsset(data: {
  asset_type?: string;
  asset_metal?: string | null;
  asset_other_name?: string | null;
}) {
  const assetType = data.asset_type ?? "equity";
  if (assetType !== "other") {
    return { asset_metal: null, asset_other_name: null };
  }
  return {
    asset_metal: data.asset_metal?.trim() ? data.asset_metal.trim() : null,
    asset_other_name: data.asset_other_name?.trim() ? data.asset_other_name.trim() : null,
  };
}
