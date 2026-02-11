import { proxyQuery } from "../../connections/db-proxy.js";

export async function getBranchList() {
  return proxyQuery("mis.staff.branch_list");
}

export async function getRepList(
  branchName?: string,
  activeOnly: boolean = true
) {
  return proxyQuery("mis.staff.rep_list", { branchName, activeOnly });
}

export async function getStaffByBranch(branchName: string) {
  return proxyQuery("mis.staff.by_branch", { branchName });
}
