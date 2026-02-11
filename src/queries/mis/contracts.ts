import { misQuery } from "../../connections/mis-mysql.js";

export async function getCustomerContracts(
  accountNumber: string,
  includeExpired: boolean = false
) {
  const expiredClause = includeExpired
    ? ""
    : "AND (td.expiry_date IS NULL OR td.expiry_date >= CURDATE())";

  return misQuery(
    `SELECT td.id, td.term_code, td.description,
            td.effective_date, td.expiry_date,
            td.approved_by, td.negotiation_date, td.price_fixed_until,
            c.account_number, c.name AS customer_name,
            b.name AS branchName
     FROM termDetails td
     JOIN customer c ON td.customer = c.id
     LEFT JOIN branch b ON td.branch = b.id
     WHERE c.account_number = ?
       ${expiredClause}
     ORDER BY td.effective_date DESC`,
    [accountNumber]
  );
}

export async function getContractProducts(
  contractId: number,
  limit: number = 1000
) {
  return misQuery(
    `SELECT ct.id, ct.term_type, ct.description, ct.supply_type,
            ct.basePrice, ct.discount1, ct.discount2, ct.price,
            p.product_code, p.description AS productDescription,
            p.retail, p.cost
     FROM contractTerms ct
     LEFT JOIN pricebook p ON ct.product = p.id
     WHERE ct.termDetail = ?
     ORDER BY p.product_code
     LIMIT ?`,
    [contractId, limit]
  );
}

export async function getCustomerDeals(
  accountNumber: string,
  includeExpired: boolean = false
) {
  const expiredClause = includeExpired
    ? ""
    : "AND (d.dealEndDate IS NULL OR d.dealEndDate >= CURDATE())";

  return misQuery(
    `SELECT d.id, d.dealReference, d.offerPrice, d.notes, d.narrative,
            d.dealStartDate, d.dealEndDate,
            d.customerRefundType, d.customerRefund,
            d.supplierRefundType, d.supplierRefund,
            c.account_number, c.name AS customer_name,
            p.product_code, p.description AS productDescription, p.retail,
            pdg.discountGroup AS discountGroupName
     FROM deals d
     LEFT JOIN customer c ON d.customer = c.id
     LEFT JOIN pricebook p ON d.product = p.id
     LEFT JOIN productDiscountGroups pdg ON d.discountGroup = pdg.id
     WHERE c.account_number = ?
       ${expiredClause}
     ORDER BY d.dealStartDate DESC`,
    [accountNumber]
  );
}

export async function getDiscountGroups(groupId?: number, productCode?: string) {
  if (groupId) {
    return misQuery(
      `SELECT pdg.id, pdg.discountGroup AS groupName, pdg.description, pdg.active,
              p.product_code, p.description AS productDescription
       FROM productDiscountGroups pdg
       LEFT JOIN productDiscountGroupProduct pdgp ON pdgp.productDiscountGroup = pdg.id
       LEFT JOIN pricebook p ON pdgp.product = p.id
       WHERE pdg.id = ?
       ORDER BY p.product_code`,
      [groupId]
    );
  }
  if (productCode) {
    return misQuery(
      `SELECT pdg.id, pdg.discountGroup AS groupName, pdg.description, pdg.active
       FROM productDiscountGroups pdg
       JOIN productDiscountGroupProduct pdgp ON pdgp.productDiscountGroup = pdg.id
       JOIN pricebook p ON pdgp.product = p.id
       WHERE p.product_code = ?`,
      [productCode]
    );
  }
  return misQuery(
    `SELECT pdg.id, pdg.discountGroup AS groupName, pdg.description, pdg.active,
            COUNT(pdgp.id) AS product_count
     FROM productDiscountGroups pdg
     LEFT JOIN productDiscountGroupProduct pdgp ON pdgp.productDiscountGroup = pdg.id
     GROUP BY pdg.id, pdg.discountGroup, pdg.description, pdg.active
     ORDER BY pdg.discountGroup`,
    []
  );
}

export async function getEffectivePrice(
  accountNumber: string,
  productCode: string
) {
  // Get deal price (customer-specific or global)
  const deals = await misQuery(
    `SELECT d.offerPrice, d.dealReference, 'deal' AS source
     FROM deals d
     LEFT JOIN customer c ON d.customer = c.id
     JOIN pricebook p ON d.product = p.id
     WHERE (c.account_number = ? OR d.customer IS NULL)
       AND p.product_code = ?
       AND (d.dealStartDate IS NULL OR d.dealStartDate <= CURDATE())
       AND (d.dealEndDate IS NULL OR d.dealEndDate >= CURDATE())
     ORDER BY d.offerPrice ASC
     LIMIT 1`,
    [accountNumber, productCode]
  );

  // Get contract price
  const contracts = await misQuery(
    `SELECT ct.price AS contractPrice, td.term_code, 'contract' AS source
     FROM contractTerms ct
     JOIN termDetails td ON ct.termDetail = td.id
     JOIN customer c ON td.customer = c.id
     JOIN pricebook p ON ct.product = p.id
     WHERE c.account_number = ? AND p.product_code = ?
       AND (td.expiry_date IS NULL OR td.expiry_date >= CURDATE())
     ORDER BY ct.price ASC
     LIMIT 1`,
    [accountNumber, productCode]
  );

  // Get list/retail price
  const listPrices = await misQuery(
    `SELECT p.retail, p.cost, p.tradePrice, p.salePrice
     FROM pricebook p
     WHERE p.product_code = ?`,
    [productCode]
  );

  const listInfo = listPrices[0] || null;
  const dealInfo = deals[0] || null;
  const contractInfo = contracts[0] || null;

  let bestPrice = listInfo?.retail || 0;
  let source = "retail";
  let reference = null;

  if (listInfo?.salePrice && listInfo.salePrice < bestPrice) {
    bestPrice = listInfo.salePrice;
    source = "sale";
  }
  if (listInfo?.tradePrice && listInfo.tradePrice < bestPrice) {
    bestPrice = listInfo.tradePrice;
    source = "trade";
  }
  if (contractInfo && contractInfo.contractPrice < bestPrice) {
    bestPrice = contractInfo.contractPrice;
    source = "contract";
    reference = contractInfo.term_code;
  }
  if (dealInfo && dealInfo.offerPrice < bestPrice) {
    bestPrice = dealInfo.offerPrice;
    source = "deal";
    reference = dealInfo.dealReference;
  }

  return {
    productCode,
    accountNumber,
    effectivePrice: bestPrice,
    source,
    reference,
    retailPrice: listInfo?.retail || null,
    tradePrice: listInfo?.tradePrice || null,
    salePrice: listInfo?.salePrice || null,
    costPrice: listInfo?.cost || null,
    contractPrice: contractInfo?.contractPrice || null,
    dealPrice: dealInfo?.offerPrice || null,
  };
}

export async function getContractsExpiring(
  daysAhead: number = 30,
  branchName?: string
) {
  const branchClause = branchName ? "AND b.name = ?" : "";
  const params: any[] = [daysAhead];
  if (branchName) params.push(branchName);

  return misQuery(
    `SELECT td.id, td.term_code, td.description,
            td.effective_date, td.expiry_date,
            td.approved_by,
            c.account_number, c.name AS customer_name,
            b.name AS branchName,
            COUNT(ct.id) AS product_count
     FROM termDetails td
     JOIN customer c ON td.customer = c.id
     LEFT JOIN branch b ON td.branch = b.id
     LEFT JOIN contractTerms ct ON ct.termDetail = td.id
     WHERE td.expiry_date IS NOT NULL
       AND td.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ${branchClause}
     GROUP BY td.id, td.term_code, td.description, td.effective_date, td.expiry_date,
              td.approved_by, c.account_number, c.name, b.name
     ORDER BY td.expiry_date ASC`,
    params
  );
}