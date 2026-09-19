import type { Database } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { TenantRepository, type TenantTable } from "./base";
import { ControlPlaneRepository } from "./control-plane";

export { TenantRepository } from "./base";
export { ControlPlaneRepository } from "./control-plane";
export type { TenantTable } from "./base";

/**
 * The complete set of tenant repositories, one per tenant-owned table. This is
 * the entire surface for tenant data — app/route code takes a repository from
 * here and calls it with a TenantContext. Add a table? Add it here, and the
 * isolation test will automatically require it to be org-scoped.
 */
export function createTenantRepositories(db: Database) {
  const repo = <T extends TenantTable>(table: T) => new TenantRepository(db, table);
  return {
    orgSettings: repo(t.orgSettings),
    sessionSlot: repo(t.sessionSlot),
    roleType: repo(t.roleType),
    qualificationType: repo(t.qualificationType),
    complianceType: repo(t.complianceType),
    equipmentType: repo(t.equipmentType),
    locationType: repo(t.locationType),
    courseType: repo(t.courseType),
    courseTypeStaffing: repo(t.courseTypeStaffing),
    courseTypeEquipment: repo(t.courseTypeEquipment),
    instructor: repo(t.instructor),
    qualification: repo(t.qualification),
    complianceItem: repo(t.complianceItem),
    equipment: repo(t.equipment),
    location: repo(t.location),
    course: repo(t.course),
    courseSession: repo(t.courseSession),
    courseStaff: repo(t.courseStaff),
    courseEquipment: repo(t.courseEquipment),
    courseLocation: repo(t.courseLocation),
    availability: repo(t.availability),
    payRate: repo(t.payRate),
    hoursRecord: repo(t.hoursRecord),
    notification: repo(t.notification),
    auditLog: repo(t.auditLog),
  } as const;
}

export type TenantRepositories = ReturnType<typeof createTenantRepositories>;

/** The list of tenant tables the isolation test must cover. */
export const TENANT_TABLES = [
  t.orgSettings,
  t.sessionSlot,
  t.roleType,
  t.qualificationType,
  t.complianceType,
  t.equipmentType,
  t.locationType,
  t.courseType,
  t.courseTypeStaffing,
  t.courseTypeEquipment,
  t.instructor,
  t.qualification,
  t.complianceItem,
  t.equipment,
  t.location,
  t.course,
  t.courseSession,
  t.courseStaff,
  t.courseEquipment,
  t.courseLocation,
  t.availability,
  t.payRate,
  t.hoursRecord,
  t.notification,
  t.auditLog,
] as const;

/** Everything a request needs: tenant repos + control-plane repo. */
export function createRepositories(db: Database) {
  return {
    tenant: createTenantRepositories(db),
    control: new ControlPlaneRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
