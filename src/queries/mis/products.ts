import { misQuery } from "../../connections/mis-mysql.js";

export async function searchProducts(
  query: string,
  status: string = "active",
  limit: number = 100
) {
  const statusClause = status === "all" ? "" : "AND p.status = ?";
  const params: any[] = [`%${query}%`, `%${query}%`];
  if (status !== "all") params.push(status);
  params.push(limit);

  return misQuery(
    `SELECT p.id, p.productCode, p.description, p.status,
            p.pac2, p.pac3, p.unitOfSale,
            p.listPrice, p.costPrice, p.salePrice,
            s.name AS supplierName
     FROM product p
     LEFT JOIN supplier s ON p.supplier = s.id
     WHERE (p.productCode LIKE ? OR p.description LIKE ?)
       ${statusClause}
     ORDER BY p.productCode
     LIMIT ?`,
    params
  );
}

export async function getProductDetail(productCode: string) {
  const results = await misQuery(
    `SELECT p.*,
            s.name AS supplierName, s.code AS supplierCode
     FROM product p
     LEFT JOIN supplier s ON p.supplier = s.id
     WHERE p.productCode = ?`,
    [productCode]
  );
  return results[0] || null;
}

export async function getProductsBySupplier(
  supplierName: string,
  limit: number = 500
) {
  return misQuery(
    `SELECT p.id, p.productCode, p.description, p.status,
            p.pac2, p.pac3, p.listPrice, p.costPrice,
            p.unitOfSale
     FROM product p
     JOIN supplier s ON p.supplier = s.id
     WHERE s.name LIKE ?
     ORDER BY p.productCode
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
    `SELECT s.id, s.name, s.code,
            COUNT(p.id) AS product_count
     FROM supplier s
     LEFT JOIN product p ON p.supplier = s.id
     GROUP BY s.id, s.name, s.code
     ORDER BY ${sortField} DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getProductCategories() {
  return misQuery(
    `SELECT DISTINCT p.pac2, p.pac3,
            COUNT(*) AS product_count
     FROM product p
     WHERE p.pac2 IS NOT NULL
     GROUP BY p.pac2, p.pac3
     ORDER BY p.pac2, p.pac3`,
    []
  );
}

export async function getProductsOnSale(limit: number = 100) {
  return misQuery(
    `SELECT p.id, p.productCode, p.description,
            p.listPrice, p.salePrice, p.costPrice,
            p.saleStartDate, p.saleEndDate,
            s.name AS supplierName
     FROM product p
     LEFT JOIN supplier s ON p.supplier = s.id
     WHERE p.salePrice IS NOT NULL
       AND p.salePrice > 0
       AND (p.saleStartDate IS NULL OR p.saleStartDate <= CURDATE())
       AND (p.saleEndDate IS NULL OR p.saleEndDate >= CURDATE())
     ORDER BY p.productCode
     LIMIT ?`,
    [limit]
  );
}
