import { misQuery } from "../../connections/mis-mysql.js";

export async function getCustomerContracts(
  accountNumber: string,
  includeExpired: boolean = false
) {
  const expiredClause = includeExpired
    ? ""
    : "AND (ct.endDate IS NULL OR ct.endDate >= CURDATE())";

  return misQuery(
    `SELECT ct.id, ct.contractNumber, ct.description,
            ct.startDate, ct.endDate, ct.status, ct.approved,
            ct.approvedBy, ct.approvedDate, ct.createdAt,
            c.accountNumber, c.name AS customer_name
     FROM contract ct
     JOIN customer c ON ct.customer = c.id
     WHERE c.accountNumber = ?
       ${expiredClause}
     ORDER BY ct.startDate DESC`,
    [accountNumber]
  );
}

export async function getContractProducts(
  contractId: number,
  limit: number = 1000
) {
  return misQuery(
    `SELECT cp.id, cp.productCode, cp.contractPrice,
            cp.listPrice, cp.discount,
            p.description AS productDescription,
            p.costPrice
     FROM contract_product cp
     LEFT JOIN product p ON cp.productCode = p.productCode
     WHERE cp.contract = ?
     ORDER BY cp.productCode
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
    : "AND (d.endDate IS NULL OR d.endDate >= CURDATE())";

  return misQuery(
    `SELECT d.id, d.dealNumber, d.description, d.productCode,
            d.dealPrice, d.startDate, d.endDate, d.status,
            c.accountNumber, c.name AS customer_name,
            p.description AS productDescription, p.listPrice
     FROM deal d
     JOIN customer c ON d.customer = c.id
     LEFT JOIN product p ON d.productCode = p.productCode
     WHERE c.accountNumber = ?
       ${expiredClause}
     ORDER BY d.startDate DESC`,
    [accountNumber]
  );
}

export async function getDiscountGroups(groupId?: number, productCode?: string) {
  if (groupId) {
    return misQuery(
      `SELECT dg.id, dg.name, dg.description, dg.discount,
              dgp.productCode, p.description AS productDescription
       FROM discount_group dg
       LEFT JOIN discount_group_product dgp ON dgp.discountGroup = dg.id
       LEFT JOIN product p ON dgp.productCode = p.productCode
       WHERE dg.id = ?
       ORDER BY dgp.productCode`,
      [groupId]
    );
  }
  if (productCode) {
    return misQuery(
      `SELECT dg.id, dg.name, dg.description, dg.discount
       FROM discount_group dg
       JOIN discount_group_product dgp ON dgp.discountGroup = dg.id
       WHERE dgp.productCode = ?`,
      [productCode]
    );
  }
  return misQuery(
    `SELECT dg.id, dg.name, dg.description, dg.discount,
            COUNT(dgp.id) AS product_count
     FROM discount_group dg
     LEFT JOIN discount_group_product dgp ON dgp.discountGroup = dg.id
     GROUP BY dg.id, dg.name, dg.description, dg.discount
     ORDER BY dg.name`,
    []
  );
}

export async function getEffectivePrice(
  accountNumber: string,
  productCode: string
) {
  // Get deal price
  const deals = await misQuery(
    `SELECT d.dealPrice, d.dealNumber, 'deal' AS source
     FROM deal d
     JOIN customer c ON d.customer = c.id
     WHERE c.accountNumber = ? AND d.productCode = ?
       AND d.status = 'active'
       AND (d.startDate IS NULL OR d.startDate <= CURDATE())
       AND (d.endDate IS NULL OR d.endDate >= CURDATE())
     ORDER BY d.dealPrice ASC
     LIMIT 1`,
    [accountNumber, productCode]
  );

  // Get contract price
  const contracts = await misQuery(
    `SELECT cp.contractPrice, ct.contractNumber, 'contract' AS source
     FROM contract_product cp
     JOIN contract ct ON cp.contract = ct.id
     JOIN customer c ON ct.customer = c.id
     WHERE c.accountNumber = ? AND cp.productCode = ?
       AND ct.status = 'active'
       AND (ct.endDate IS NULL OR ct.endDate >= CURDATE())
     ORDER BY cp.contractPrice ASC
     LIMIT 1`,
    [accountNumber, productCode]
  );

  // Get list price
  const listPrices = await misQuery(
    `SELECT p.listPrice, p.costPrice, p.salePrice
     FROM product p
     WHERE p.productCode = ?`,
    [productCode]
  );

  const listInfo = listPrices[0] || null;
  const dealInfo = deals[0] || null;
  const contractInfo = contracts[0] || null;

  let bestPrice = listInfo?.listPrice || 0;
  let source = "list";
  let reference = null;

  if (listInfo?.salePrice && listInfo.salePrice < bestPrice) {
    bestPrice = listInfo.salePrice;
    source = "sale";
  }
  if (contractInfo && contractInfo.contractPrice < bestPrice) {
    bestPrice = contractInfo.contractPrice;
    source = "contract";
    reference = contractInfo.contractNumber;
  }
  if (dealInfo && dealInfo.dealPrice < bestPrice) {
    bestPrice = dealInfo.dealPrice;
    source = "deal";
    reference = dealInfo.dealNumber;
  }

  return {
    productCode,
    accountNumber,
    effectivePrice: bestPrice,
    source,
    reference,
    listPrice: listInfo?.listPrice || null,
    salePrice: listInfo?.salePrice || null,
    costPrice: listInfo?.costPrice || null,
    contractPrice: contractInfo?.contractPrice || null,
    dealPrice: dealInfo?.dealPrice || null,
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
    `SELECT ct.id, ct.contractNumber, ct.description,
            ct.startDate, ct.endDate, ct.status,
            c.accountNumber, c.name AS customer_name,
            b.name AS branchName,
            COUNT(cp.id) AS product_count
     FROM contract ct
     JOIN customer c ON ct.customer = c.id
     LEFT JOIN branch b ON c.branch = b.id
     LEFT JOIN contract_product cp ON cp.contract = ct.id
     WHERE ct.endDate IS NOT NULL
       AND ct.endDate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND ct.status = 'active'
       ${branchClause}
     GROUP BY ct.id, ct.contractNumber, ct.description, ct.startDate, ct.endDate,
              ct.status, c.accountNumber, c.name, b.name
     ORDER BY ct.endDate ASC`,
    params
  );
}
