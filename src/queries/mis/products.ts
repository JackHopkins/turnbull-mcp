import { misQuery } from "../../connections/mis-mysql.js";

export async function searchProducts(
  query: string,
  status: string = "active",
  limit: number = 100
) {
  const statusClause = status === "all" ? "" : "AND p.status = ?";
  const params: any[] = [`%${query}%`, `%${query}%`, `%${query}%`];
  if (status !== "all") params.push(status);
  params.push(limit);

  return misQuery(
    `SELECT p.id, p.product_code, p.description, p.status,
            p.productType, p.productGroup, p.priceUnitText,
            p.retail, p.cost, p.tradePrice, p.salePrice,
            s.name AS supplierName
     FROM pricebook p
     LEFT JOIN supplier s ON p.supplier = s.id
     WHERE (p.product_code LIKE ? OR p.description LIKE ? OR p.keyword LIKE ?)
       ${statusClause}
     ORDER BY p.product_code
     LIMIT ?`,
    params
  );
}

export async function getProductDetail(productCode: string) {
  const results = await misQuery(
    `SELECT p.*,
            s.name AS supplierName, s.strAccountCode AS supplierCode
     FROM pricebook p
     LEFT JOIN supplier s ON p.supplier = s.id
     WHERE p.product_code = ?`,
    [productCode]
  );
  return results[0] || null;
}

export async function getProductsBySupplier(
  supplierName: string,
  limit: number = 500
) {
  return misQuery(
    `SELECT p.id, p.product_code, p.description, p.status,
            p.productType, p.productGroup, p.retail, p.cost, p.tradePrice,
            p.priceUnitText
     FROM pricebook p
     JOIN supplier s ON p.supplier = s.id
     WHERE s.name LIKE ?
     ORDER BY p.product_code
     LIMIT ?`,
    [`%${supplierName}%`, limit]
  );
}

export async function getSupplierList(
  limit: number = 500,
  sortBy: string = "name"
) {
  const allowedSorts: Record<string, string> = {
    name: "s.name",
    productCount: "product_count",
  };
  const sortField = allowedSorts[sortBy] || "s.name";

  return misQuery(
    `SELECT s.id, s.name, s.strAccountCode AS supplierCode, s.supplierType,
            COUNT(p.id) AS product_count
     FROM supplier s
     LEFT JOIN pricebook p ON p.supplier = s.id
     GROUP BY s.id, s.name, s.strAccountCode, s.supplierType
     ORDER BY ${sortField} DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getProductCategories() {
  return misQuery(
    `SELECT p3.pac AS pac3_code, p3.description, p3.short_description,
            COUNT(DISTINCT t.product) AS product_count
     FROM pac3 p3
     LEFT JOIN transactions t ON t.pac3 = p3.pac
     GROUP BY p3.pac, p3.description, p3.short_description
     ORDER BY p3.pac`,
    []
  );
}

export async function getProductsOnSale(limit: number = 100) {
  return misQuery(
    `SELECT p.id, p.product_code, p.description,
            p.retail, p.salePrice, p.cost, p.tradePrice,
            p.saleFromDate, p.saleToDate,
            s.name AS supplierName
     FROM pricebook p
     LEFT JOIN supplier s ON p.supplier = s.id
     WHERE p.salePrice IS NOT NULL
       AND p.salePrice > 0
       AND (p.saleFromDate IS NULL OR p.saleFromDate <= NOW())
       AND (p.saleToDate IS NULL OR p.saleToDate >= NOW())
     ORDER BY p.product_code
     LIMIT ?`,
    [limit]
  );
}