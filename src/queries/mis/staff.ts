import { misQuery } from "../../connections/mis-mysql.js";

export async function getBranchList() {
  return misQuery(
    `SELECT b.id, b.name, b.brevoUserId,
            COUNT(DISTINCT c.id) AS customer_count
     FROM branch b
     LEFT JOIN customer c ON c.branch = b.id
     GROUP BY b.id, b.name, b.brevoUserId
     ORDER BY b.name`,
    []
  );
}

export async function getRepList(
  branchName?: string,
  activeOnly: boolean = true
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }
  if (activeOnly) {
    conditions.push("r.active = 1");
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  return misQuery(
    `SELECT r.id, r.name, r.k8UserId, r.active,
            b.name AS branchName,
            COUNT(DISTINCT c.id) AS customer_count
     FROM rep r
     LEFT JOIN branch b ON r.branch = b.id
     LEFT JOIN customer c ON c.rep = r.id
     ${whereClause}
     GROUP BY r.id, r.name, r.k8UserId, r.active, b.name
     ORDER BY r.name`,
    params
  );
}

export async function getStaffByBranch(branchName: string) {
  return misQuery(
    `SELECT r.id, r.name, r.k8UserId, r.active, r.role,
            b.name AS branchName
     FROM rep r
     JOIN branch b ON r.branch = b.id
     WHERE b.name = ?
     ORDER BY r.name`,
    [branchName]
  );
}
