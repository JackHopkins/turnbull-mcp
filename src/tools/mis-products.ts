import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  searchProducts,
  getProductDetail,
  getProductsBySupplier,
  getSupplierList,
  getProductCategories,
  getProductsOnSale,
} from "../queries/mis/products.js";
import type { ToolDefinition } from "./index.js";

const MIS_PRODUCT_TTL = 3_600_000;

export const misProductTools: ToolDefinition[] = [
  {
    name: "mis_product_search",
    description:
      "Search the MIS pricebook by product code, description, or keyword. Returns product details with pricing and supplier info.",
    inputSchema: z.object({
      query: z.string().describe("Search term: product code or description keyword"),
      status: z
        .string()
        .optional()
        .default("active")
        .describe("Filter by status: active, discontinued, or all"),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum results to return"),
    }),
    handler: async (params) => {
      const { query, status, limit } = params as {
        query: string;
        status: string;
        limit: number;
      };
      return withCache(
        "mis_product_search",
        { query, status, limit },
        MIS_PRODUCT_TTL,
        () => searchProducts(query, status, limit)
      );
    },
  },
  {
    name: "mis_product_detail",
    description:
      "Get full product details including all pricing tiers, supplier, PAC categories, and sale pricing.",
    inputSchema: z.object({
      productCode: z.string().describe("Product code"),
    }),
    handler: async (params) => {
      const { productCode } = params as { productCode: string };
      return withCache(
        "mis_product_detail",
        { productCode },
        MIS_PRODUCT_TTL,
        () => getProductDetail(productCode)
      );
    },
  },
  {
    name: "mis_products_by_supplier",
    description:
      "List all products from a supplier with pricing and category info.",
    inputSchema: z.object({
      supplierName: z.string().describe("Supplier name (partial match supported)"),
      limit: z.number().optional().default(500).describe("Maximum results"),
    }),
    handler: async (params) => {
      const { supplierName, limit } = params as {
        supplierName: string;
        limit: number;
      };
      return withCache(
        "mis_products_by_supplier",
        { supplierName, limit },
        MIS_PRODUCT_TTL,
        () => getProductsBySupplier(supplierName, limit)
      );
    },
  },
  {
    name: "mis_supplier_list",
    description:
      "Get all suppliers with product counts. Sort by name or product count.",
    inputSchema: z.object({
      limit: z.number().optional().default(500).describe("Maximum results"),
      sortBy: z
        .string()
        .optional()
        .default("name")
        .describe("Sort by: name or productCount"),
    }),
    handler: async (params) => {
      const { limit, sortBy } = params as { limit: number; sortBy: string };
      return withCache(
        "mis_supplier_list",
        { limit, sortBy },
        MIS_PRODUCT_TTL,
        () => getSupplierList(limit, sortBy)
      );
    },
  },
  {
    name: "mis_product_categories",
    description:
      "Get the PAC2/PAC3 product category hierarchy with product counts per category.",
    inputSchema: z.object({}),
    handler: async () => {
      return withCache(
        "mis_product_categories",
        {},
        MIS_PRODUCT_TTL,
        () => getProductCategories()
      );
    },
  },
  {
    name: "mis_products_on_sale",
    description:
      "Get products currently on sale with sale prices and date ranges.",
    inputSchema: z.object({
      limit: z.number().optional().default(100).describe("Maximum results"),
    }),
    handler: async (params) => {
      const { limit } = params as { limit: number };
      return withCache(
        "mis_products_on_sale",
        { limit },
        MIS_PRODUCT_TTL,
        () => getProductsOnSale(limit)
      );
    },
  },
];
