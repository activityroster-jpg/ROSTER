/**
 * Who can teach what, and who can fill which place. Pure: the caller loads the
 * centre's instructor types, its course map (qualification_course_type) and
 * what each person holds.
 *
 * - A course with rows in the map can be taught only by someone holding one of
 *   those instructor types (plus the also-required one, and the Principal's
 *   approval where a row needs it). A course with none falls back to the
 *   activity (handled by the caller).
 * - A place on a course is an instructor type. Someone can fill it if they hold
 *   that type, or a higher type on the same ladder (a Senior Instructor in a
 *   Dinghy Instructor place), never a lower one.
 * - Some types teach under a Senior Instructor's supervision: the roster warns
 *   when one of them is on and no supervisor for that ladder is on duty in the
 *   same slot anywhere at the centre.
 */

export interface TeachRule {
  qualificationTypeId: string;
  courseTypeId: string;
  alsoRequiresTypeId: string | null;
  needsApproval: boolean;
}

export interface TypeInfo {
  id: string;
  name: string;
  /** The ladder ("dinghy", "windsurf"…); null for a held certificate or an examiner. */
  discipline: string | null;
  rank: number;
  needsSupervision: boolean;
  supervises: boolean;
}

/** The rules for each course. */
export function rulesByCourse(rules: readonly TeachRule[]): Map<string, TeachRule[]> {
  const out = new Map<string, TeachRule[]>();
  for (const r of rules) out.set(r.courseTypeId, [...(out.get(r.courseTypeId) ?? []), r]);
  return out;
}

/**
 * Whether the course's rules let this person teach it, or null when the course
 * has no rules (the caller falls back to the activity).
 */
export function canTeachByRules(rules: readonly TeachRule[] | undefined, held: ReadonlySet<string>, approved: ReadonlySet<string>): boolean | null {
  if (!rules || rules.length === 0) return null;
  return rules.some((r) => held.has(r.qualificationTypeId)
    && (!r.alsoRequiresTypeId || held.has(r.alsoRequiresTypeId))
    && (!r.needsApproval || approved.has(r.courseTypeId)));
}

/** Can someone holding these types fill a place of this type? A place with no type (Volunteer, an older generic place) is open to anyone. */
export function canFillPlace(held: ReadonlySet<string>, placeTypeId: string | null | undefined, types: ReadonlyMap<string, TypeInfo>): boolean {
  if (!placeTypeId) return true;
  if (held.has(placeTypeId)) return true;
  const place = types.get(placeTypeId);
  if (!place?.discipline) return false;
  for (const id of held) {
    const t = types.get(id);
    if (t && t.discipline === place.discipline && t.rank > place.rank) return true;
  }
  return false;
}

/** The place ids (role ids) this person can fill. */
export function fillablePlaces(held: ReadonlySet<string>, places: readonly { id: string; qualificationTypeId: string | null }[], types: ReadonlyMap<string, TypeInfo>): string[] {
  return places.filter((p) => canFillPlace(held, p.qualificationTypeId, types)).map((p) => p.id);
}

/**
 * The instructor type a course's places default to: of the types that teach it
 * without conditions, the lowest one that isn't an assistant, preferring the
 * course's own ladder (Dinghy Instructor for Youth Stage 1, Powerboat
 * Instructor for Level 1, Advanced Powerboat Instructor for Advanced). Null when
 * nothing teaches it.
 */
export function defaultPlaceType(courseRules: readonly TeachRule[] | undefined, types: ReadonlyMap<string, TypeInfo>, courseDiscipline: string | null): string | null {
  const candidates = (courseRules ?? [])
    .filter((r) => !r.needsApproval)
    .map((r) => types.get(r.qualificationTypeId))
    .filter((t): t is TypeInfo => Boolean(t?.discipline));
  if (candidates.length === 0) {
    const any = (courseRules ?? []).map((r) => types.get(r.qualificationTypeId)).filter((t): t is TypeInfo => Boolean(t?.discipline));
    return any.sort((a, b) => a.rank - b.rank)[0]?.id ?? null;
  }
  const lead = candidates.filter((t) => t.rank >= 20);
  const pool = lead.length ? lead : candidates;
  const own = pool.filter((t) => t.discipline === courseDiscipline);
  return (own.length ? own : pool).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))[0]!.id;
}

/** The instructor types that can teach a course (for the "relevant" part of a place picker). */
export function typesForCourse(courseRules: readonly TeachRule[] | undefined): Set<string> {
  return new Set((courseRules ?? []).map((r) => r.qualificationTypeId));
}

export interface SlotPerson { instructorId: string; name: string; placeTypeId: string | null; held: ReadonlySet<string> }

/**
 * People on in one slot who teach under supervision while no supervisor for
 * their ladder is on duty in that slot (on any session at the centre). Someone
 * who is a supervisor themselves never needs one.
 */
export function unsupervised(slotStaff: readonly SlotPerson[], types: ReadonlyMap<string, TypeInfo>): { person: SlotPerson; placeType: TypeInfo }[] {
  const supervisesLadder = (held: ReadonlySet<string>, discipline: string) => [...held].some((id) => {
    const t = types.get(id);
    return Boolean(t?.supervises && t.discipline === discipline);
  });
  const out: { person: SlotPerson; placeType: TypeInfo }[] = [];
  const seen = new Set<string>();
  for (const p of slotStaff) {
    const placeType = p.placeTypeId ? types.get(p.placeTypeId) : undefined;
    if (!placeType?.needsSupervision || !placeType.discipline) continue;
    if (supervisesLadder(p.held, placeType.discipline)) continue;
    const covered = slotStaff.some((o) => o.instructorId !== p.instructorId && supervisesLadder(o.held, placeType.discipline!));
    if (!covered && !seen.has(p.instructorId)) { seen.add(p.instructorId); out.push({ person: p, placeType }); }
  }
  return out;
}

/** What a picker knows about one person: the course types they can teach and the places they can fill. */
export interface PersonFit {
  /** Something is on file for them; with nothing, nobody is judged. */
  knownQualifications: boolean;
  teaches: readonly string[];
  fills: readonly string[];
}
export interface PlaceFacts { id: string; name: string; countsTowardRatio: boolean; qualificationTypeId: string | null }

/**
 * Why this person doesn't suit this place on this course, or null when they
 * do. The same two checks the server makes (lib/services/place-check): a
 * teaching place needs someone who can teach the course type ("course"), and a
 * place that is an instructor type needs that type or a higher one on its
 * ladder ("place"). Nobody is judged until something is on file for them.
 */
export function placeFitIssue(person: PersonFit, courseTypeId: string | null, place: PlaceFacts | undefined): "course" | "place" | null {
  if (!person.knownQualifications) return null;
  if (courseTypeId && (!place || place.countsTowardRatio) && !person.teaches.includes(courseTypeId)) return "course";
  if (place?.qualificationTypeId && !person.fills.includes(place.id)) return "place";
  return null;
}
