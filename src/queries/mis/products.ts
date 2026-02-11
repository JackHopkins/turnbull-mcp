import { proxyQuery } from "../../connections/db-proxy.js";

export async function searchProducts(
  query: string,
  status: string = "active",
  limit: number = 100
) {
  return proxyQuery("mis.products.search", { query, status, limit });
}

export async function getProductDetail(productCode: string) {
  const results = await proxyQuery("mis.products.detail", { productCode });
  return results || null;
}

export async function getProductsBySupplier(
  supplierName: string,
  limit: number = 500
) {
  return proxyQuery("mis.products.by_supplier", { supplierName, limit });
}

export async function getSupplierList(
  limit: number = 500,
  sortBy: string = "name"
) {
  return proxyQuery("mis.products.supplier_list", { limit, sortBy });
}

export async function getProductCategories() {
  return proxyQuery("mis.products.categories");
}

export async function getProductsOnSale(limit: number = 100) {
  return proxyQuery("mis.products.on_sale", { limit });
}
