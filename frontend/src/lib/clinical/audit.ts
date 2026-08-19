/**
 * One structured line per clinical write and per clinical refusal (D6, FR-061).
 *
 * D6 chose logs over an `access_events` table on the grounds that a third table
 * would be the audit-event bus arriving through the side door. The consequence
 * is that this is a *record*, not a queryable store — so the line has to carry
 * everything an answer needs in one place: who, what, which resource, what
 * happened, and when.
 *
 * WHAT NEVER GOES IN. Not the content that was refused, not the clinician's
 * note, not a diagnosis, not a score, not a storage path. A refusal log that
 * quotes the thing withheld has handed it to whoever reads logs — which is a
 * wider audience than the role that was just refused. `outcome` and the resource
 * id are enough to reconstruct the event from the database, by someone who is
 * allowed to read it.
 *
 * `console.log` rather than a logging library: nothing else in this repo has one,
 * and adding a dependency to emit six lines is a larger change than the feature.
 * One JSON object per line, so a collector can parse it without a grammar.
 */

/** What was attempted. Named after the endpoint, not the SQL. */
export type ClinicalAction =
  | "queue.read"
  | "case.read"
  | "case.claim"
  | "case.review"
  /** The return loop (T051, FR-007). Distinct from `case.review` because no review was recorded. */
  | "case.resume"
  | "version.sign"
  | "version.release"

export interface ClinicalAuditLine {
  event: "clinical.audit"
  actor: string
  /** The role the *session* carried — never one the request claimed (FR-032). */
  actor_role: string
  action: ClinicalAction
  resource_id: string | null
  outcome: "allowed" | "refused"
  /** The contract §2 code on a refusal; absent when allowed. */
  code?: string
  at: string
}

export function logClinical(line: Omit<ClinicalAuditLine, "event" | "at">): void {
  const entry: ClinicalAuditLine = {
    event: "clinical.audit",
    ...line,
    at: new Date().toISOString(),
  }
  console.log(JSON.stringify(entry))
}

/**
 * The refusal half, as one call.
 *
 * Taking `code` rather than a message keeps the prose out of the log: the codes
 * are a closed set from contract §2 and the messages are user-facing copy that
 * will be reworded. A log that stores copy goes stale the first time someone
 * edits a sentence.
 */
export function logRefusal(
  actor: string,
  actorRole: string,
  action: ClinicalAction,
  resourceId: string | null,
  code: string,
): void {
  logClinical({
    actor,
    actor_role: actorRole,
    action,
    resource_id: resourceId,
    outcome: "refused",
    code,
  })
}

export function logAllowed(
  actor: string,
  actorRole: string,
  action: ClinicalAction,
  resourceId: string | null,
): void {
  logClinical({ actor, actor_role: actorRole, action, resource_id: resourceId, outcome: "allowed" })
}
