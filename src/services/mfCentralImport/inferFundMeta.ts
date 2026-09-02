export type InferredFundMeta = {
  fund_type: string;
  asset_type: string;
};

function has(name: string, pattern: RegExp) {
  return pattern.test(name);
}

export function inferFundMeta(schemeName: string): InferredFundMeta {
  const n = schemeName.toLowerCase();

  let assetType = "equity";
  if (
    has(n, /\b(debt|gilt|bond|income|credit risk|corporate bond|money market|floater|duration)\b/) ||
    has(n, /\b(liquid|overnight|ultra short|short duration)\b/)
  ) {
    assetType = "debt";
  } else if (
    has(n, /\b(hybrid|balanced|multi asset|conservative hybrid|aggressive hybrid|equity savings|arbitrage)\b/)
  ) {
    assetType = "hybrid";
  } else if (has(n, /\b(retirement|children'?s?|child)\b/)) {
    assetType = "solution_oriented";
  } else if (has(n, /\b(gold|silver|platinum)\b/) && has(n, /\b(fof|fund of fund|etf)\b/)) {
    assetType = "other";
  }

  if (has(n, /\belss\b/)) return { fund_type: "elss", asset_type: "equity" };
  if (has(n, /\b(index|nifty|sensex)\b/)) return { fund_type: "index", asset_type: assetType };
  if (has(n, /\b(fund of fund|fof)\b/)) return { fund_type: "fof", asset_type: assetType };
  if (has(n, /\b(international|global|nasdaq|s&p 500|us equity|overseas)\b/)) {
    return { fund_type: "international", asset_type: assetType };
  }
  if (has(n, /\bsmall[\s-]?cap\b/)) return { fund_type: "small_cap", asset_type: assetType };
  if (has(n, /\bmid[\s-]?cap\b/)) return { fund_type: "mid_cap", asset_type: assetType };
  if (has(n, /\b(large[\s-]?cap|bluechip|blue chip)\b/)) {
    return { fund_type: "large_cap", asset_type: assetType };
  }
  if (has(n, /\bflexi[\s-]?cap\b/)) return { fund_type: "flexi_cap", asset_type: assetType };
  if (has(n, /\bmulti[\s-]?cap\b/)) return { fund_type: "multi_cap", asset_type: assetType };
  if (has(n, /\bliquid\b/)) return { fund_type: "liquid", asset_type: "debt" };
  if (has(n, /\bultra short\b/)) return { fund_type: "ultra_short", asset_type: "debt" };
  if (has(n, /\bshort (duration|term)\b/)) return { fund_type: "short_duration", asset_type: "debt" };
  if (
    has(
      n,
      /\b(sector|thematic|pharma|technology|infra|banking|psu|consumption|energy|defence|healthcare|fmcg)\b/
    )
  ) {
    return { fund_type: "sectoral", asset_type: assetType };
  }

  return { fund_type: "other", asset_type: assetType };
}
