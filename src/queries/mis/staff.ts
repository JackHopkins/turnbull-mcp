import { misQuery } from "../../connections/mis-mysql.js";

export async function getBranchList() {
  return misQuery(
    `SELECT b.id, b.branch_id, b.name, b.email, b.brevoUser,
            COUNT(DISTINCT c.id) AS customer_count
     FROM branch b
     LEFT JOIN customer c ON c.branch = b.id
     GROUP BY b.id, b.branch_id, b.name, b.email, b.brevoUser
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

  if (activeOnly) {
    conditions.push("r.is_active = 1");
  }
  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  return misQuery(
    `SELECT r.id, r.rep_id, r.fullname, r.email, r.mobile, r.k8User, r.is_active,
            b.name AS primaryBranch,
            COUNT(DISTINCT c.id) AS customer_count
     FROM repDetails r
     LEFT JOIN customer c ON c.rep = r.id
     LEFT JOIN branch b ON c.branch = b.id
     ${whereClause}
     GROUP BY r.id, r.rep_id, r.fullname, r.email, r.mobile, r.k8User, r.is_active, b.name
     ORDER BY r.fullname`,
    params
  );
}

export async function getStaffByBranch(branchName: string) {
  return misQuery(
    `SELECT u.id, u.userId, u.firstname, u.surname, u.email,
            u.role, u.misRole, u.is_active, u.mobileNo,
            b.name AS branchName,
            r.fullname AS repName, r.rep_id
     FROM k8UserBranchSale ubs
     JOIN k8UserDetails u ON ubs.user = u.id
     JOIN branch b ON ubs.branch = b.id
     LEFT JOIN repDetails r ON u.rep = r.id
     WHERE b.name = ?
     ORDER BY u.surname, u.firstname`,
    [branchName]
  );
}