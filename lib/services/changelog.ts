/**
 * Turn an audit row into a sentence a centre manager understands, e.g.
 * "assign_staff on course_staff" → "Rostered an instructor onto a course".
 * Pure: names are resolved by the caller and passed in where known.
 */
const ENTITY: Record<string, string> = {
  course: "a course", course_type: "a course type", course_staff: "an instructor on a course", instructor: "an instructor",
  org_settings: "the centre settings", open_shift: "an open shift", integration: "a booking-system connection",
  qualification_type: "a cert type", qualification: "a cert", location_type: "a location category", location: "a location",
  hours_record: "a payroll line", equipment_type: "an equipment type", equipment: "a piece of equipment", time_entry: "a clock entry",
  pay_rate: "a pay rate", leave_request: "a leave request", booking: "a booking", onboarding_item: "an onboarding step",
  compliance_item: "a check", availability: "availability", roster_week: "the week",
  "config:slot": "a session slot", "config:role": "a role", "config:grade": "a cert type", "config:compliance": "a check type",
  "config:equipmentType": "an equipment type", "config:locationType": "a location category",
};

const ACTION: Record<string, string> = {
  create: "Added", update: "Updated", rename: "Renamed", delete: "Deleted", deactivate: "Retired", reactivate: "Brought back",
  update_status: "Changed the status of", set_staff_required: "Set how many instructors are needed on", update_session: "Changed a session on",
  add_session: "Added a session to", remove_session: "Removed a session from", remove_staff: "Took an instructor off", assign_staff: "Rostered",
  assign_staff_override: "Rostered (with an override)", import_courses: "Imported courses", import_instructors: "Imported instructors",
  setup_instructor: "Added", invite_instructor: "Invited", instructor_left: "Marked as left", instructor_returned: "Brought back",
  approve_join_request: "Approved a join request from", decline_join_request: "Declined a join request from", app_join: "Joined via the app:", app_join_requested: "Asked to join via the app:",
  set_pay_rate: "Set a pay rate", update_pay_rate: "Changed a pay rate", delete_pay_rate: "Removed a pay rate",
  payroll_line_edit: "Edited", payroll_approve: "Approved payroll lines", payroll_unapprove: "Re-opened payroll lines", payroll_rebuild: "Refreshed payroll from the roster", set_pay_source: "Changed what payroll pays on",
  update_breaks: "Changed the lunch-break rule", update_timeclock: "Changed the time clock settings", regenerate_join_code: "Issued a new company code", enable_feature: "Switched on a feature",
  onboarding_set_preferences: "Chose how the centre runs", onboarding_set_courses: "Chose the courses the centre runs", onboarding_toggle: "Ticked an onboarding step for",
  add_default_grades: "Added the RYA cert types", add_default_courses: "Added the RYA courses", update_schedule: "Set the default schedule for", list: "Added to the course list:", unlist: "Removed from the course list:", merge: "Merged",
  request_leave: "Asked for leave", leave_approved: "Approved leave for", leave_declined: "Declined leave for",
  open_shift_create: "Broadcast an open shift", open_shift_claim: "Offered to cover an open shift", open_shift_confirm: "Confirmed cover for an open shift", open_shift_cancel: "Cancelled an open shift",
  data_export: "Downloaded a full export of", update_protected_contacts: "Updated the emergency or guardian contacts of", view_emergency_sheet: "Opened the emergency sheet for", view_protected_contacts: "Viewed the emergency or guardian contacts of", clock_in: "Clocked in", clock_out: "Clocked out", set_availability: "Changed availability", attach_document: "Uploaded a document for", update_document_meta: "Updated the details of",
  self_add_licence: "Added a cert to their own record", self_add_licence_type: "Added a new cert type", integration_connect: "Connected", integration_remove: "Disconnected", integration_sync: "Checked", integration_apply_changes: "Applied changes from",
  booking_create: "Added a booking", booking_status: "Changed a booking", publish_week: "Published the roster for", republish_week: "Re-published the roster for", confirm_assignment: "Confirmed their place on", decline_assignment: "Declined their place on",
  export_person: "Downloaded a copy of the data held about", restrict_instructor: "Restricted processing for", unrestrict_instructor: "Lifted the processing restriction on", anonymise_instructor: "Anonymised", replay_deletions: "Re-applied past anonymisations after a restore to",
  export_audit_log: "Downloaded the change log for", export_rota_pdf: "Downloaded a roster PDF for", view_young_worker_register: "Downloaded the young-worker time register for",
  retention_run: "Removed records past their retention period from", retention_keep: "Kept the profile of", update_retention: "Changed the retention periods of", vetting_files_removed: "Removed stored vetting certificates (status-only policy) for",
  set_member_role: "Changed the role of", invite_guardian: "Invited a parent or guardian to view the roster of", revoke_guardian: "Removed a parent or guardian's access to the roster of", set_share_contact: "Changed whether colleagues can see the contact details of",
  set_students: "Set the number of students on", trial_extended: "Answered the trial-end survey: free trial extended by a month", cancel_session: "Cancelled a day of", cancel_course: "Cancelled", restore_session: "Restored a cancelled day of", restore_defaults: "Restored the RYA course list", set_notify_email: "Changed email notifications for", update_profile: "Updated the details of",
};

export function describeAudit(action: string, entity: string, after?: string | null): string {
  const verb = ACTION[action];
  const what = ENTITY[entity] ?? entity.replace(/_/g, " ");
  let detail = "";
  if (after) {
    try {
      const a = JSON.parse(after) as Record<string, unknown>;
      const name = typeof a.name === "string" ? a.name : typeof a.email === "string" ? a.email : typeof a.weekStart === "string" ? `week of ${a.weekStart}` : "";
      if (name) detail = ` “${name}”`;
      else if (typeof a.status === "string") detail = ` to ${a.status}`;
      else if (typeof a.created === "number") detail = ` (${a.created} added${typeof a.skipped === "number" && a.skipped ? `, ${a.skipped} skipped` : ""})`;
      else if (typeof a.count === "number") detail = ` (${a.count})`;
    } catch { /* not JSON */ }
  }
  if (!verb) return `${action.replace(/_/g, " ")} — ${what}${detail}`;
  // Verbs that already name the object don't repeat it.
  const standalone = /^(Imported|Added the RYA|Restored the RYA|Chose|Changed what|Changed the lunch|Changed the time clock|Issued|Switched|Refreshed|Approved payroll|Re-opened payroll|Asked for leave|Broadcast|Offered|Confirmed cover|Cancelled an|Clocked|Changed availability|Added a cert to|Added a new cert|Added a booking|Changed a booking|Set a pay rate|Changed a pay rate|Removed a pay rate|Answered the trial)/.test(verb);
  return standalone ? `${verb}${detail}` : `${verb} ${what}${detail}`;
}
