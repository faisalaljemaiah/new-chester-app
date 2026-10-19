import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { as, createDb, signUp, type Db } from "./db.mts";

let db: Db;
let admin: string, drA: string, drB: string, patient: string, other: string;
let appt: string;

// A date at least a week ahead, so bookings are always in the future.
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const D1 = day(8);
const D2 = day(9);

const rejects = (p: Promise<unknown>, pattern?: RegExp) => assert.rejects(p, pattern);

before(async () => {
  db = await createDb();
  admin = await signUp(db, "owner@clinic.test", "Owner");
  drA = await signUp(db, "a@clinic.test", "Dr A");
  drB = await signUp(db, "b@clinic.test", "Dr B");
  patient = await signUp(db, "p@clinic.test", "Sara", "+966500000000");
  other = await signUp(db, "o@clinic.test", "Omar");
  // The first admin is set up from the SQL editor (no signed-in user), as the setup guide says.
  await db.query("select promote_to_practitioner('owner@clinic.test', 'Owner', 'Psychiatrist', 'psychiatry', true)");
  await as(db, admin, "select promote_to_practitioner('a@clinic.test', 'Dr A', 'Psychiatrist', 'psychiatry')");
  await as(db, admin, "select promote_to_practitioner('b@clinic.test', 'Dr B', 'Psychologist', 'psychology')");
  // Open every day so the test dates are always working days.
  const allWeek = JSON.stringify(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ start: "09:00", end: "17:00" }]])));
  await as(db, drA, "update practitioners set weekly_hours = $1 where id = auth.uid()", [allWeek]);
  await as(db, drB, "update practitioners set weekly_hours = $1 where id = auth.uid()", [allWeek]);
});

describe("accounts and roles", () => {
  test("sign-up creates a patient profile and file", async () => {
    const [p] = await as(db, patient, "select role, display_name from profiles where id = auth.uid()");
    assert.deepEqual(p, { role: "patient", display_name: "Sara" });
    const [f] = await as(db, patient, "select phone from patients where id = auth.uid()");
    assert.equal(f.phone, "+966500000000");
  });

  test("nobody can change their own role", async () => {
    await rejects(as(db, patient, "update profiles set role = 'admin' where id = auth.uid()"), /permission denied/);
  });

  test("only admins add practitioners", async () => {
    await rejects(as(db, drA, "select promote_to_practitioner('o@clinic.test', 'X', 'Y', 'psychology')"), /Only admins/);
    const [p] = await as(db, admin, "select role from profiles where id = $1", [drA]);
    assert.equal(p.role, "practitioner");
  });

  test("signed-out visitors can read nothing and call nothing", async () => {
    await rejects(as(db, null, "select * from practitioners"), /permission denied/);
    await rejects(as(db, null, "select booked_times($1, $2)", [drA, D1]), /permission denied/);
  });

  test("practitioners can't block their own days directly", async () => {
    await rejects(as(db, drA, "update practitioners set blocked_ranges = '[]' where id = auth.uid()"), /permission denied/);
  });
});

describe("booking", () => {
  test("patients can't insert appointments directly", async () => {
    await rejects(
      as(db, patient, `insert into appointments (patient_id, patient_name, practitioner_id, practitioner_name, start_at, end_at)
        values (auth.uid(), 'x', $1, 'y', now() + interval '9 days', now() + interval '9 days 1 hour')`, [drA]),
      /permission denied/,
    );
  });

  test("a patient books a free slot and joins the care team", async () => {
    [{ id: appt }] = await as<{ id: string }>(db, patient, "select book_appointment($1, $2, '10:40') as id", [drA, D1]);
    const [team] = await as(db, patient, "select count(*)::int as n from care_team where patient_id = auth.uid()");
    assert.equal(team.n, 1);
    const [conv] = await as(db, patient, "select count(*)::int as n from conversations");
    assert.equal(conv.n, 1);
  });

  test("the same slot can't be booked twice", async () => {
    await rejects(as(db, other, "select book_appointment($1, $2, '10:40')", [drA, D1]), /just taken/);
  });

  test("times outside working hours or off the session grid are refused", async () => {
    await rejects(as(db, other, "select book_appointment($1, $2, '20:00')", [drA, D1]), /not available/);
    await rejects(as(db, other, "select book_appointment($1, $2, '10:15')", [drA, D1]), /not available/);
  });

  test("practitioners can't book as patients", async () => {
    await rejects(as(db, drB, "select book_appointment($1, $2, '09:00')", [drA, D1]), /Only patients/);
  });

  test("booked times are visible without patient details", async () => {
    const [r] = await as(db, other, "select booked_times($1, $2) as t", [drA, D1]);
    assert.deepEqual(r.t, ["10:40"]);
    const rows = await as(db, other, "select * from appointments");
    assert.equal(rows.length, 0);
  });
});

describe("patient files", () => {
  test("the care team sees the file, other practitioners don't", async () => {
    assert.equal((await as(db, drA, "select * from patients where id = $1", [patient])).length, 1);
    assert.equal((await as(db, drB, "select * from patients where id = $1", [patient])).length, 0);
  });

  test("notes: care team writes, patient and outsiders can't read", async () => {
    const [n] = await as(db, drA, "insert into notes (patient_id, body) values ($1, 'First session notes') returning author_name", [patient]);
    assert.equal(n.author_name, "Dr A");
    assert.equal((await as(db, patient, "select * from notes")).length, 0);
    assert.equal((await as(db, drB, "select * from notes")).length, 0);
    await rejects(as(db, drB, "insert into notes (patient_id, body) values ($1, 'x')", [patient]), /row-level security/);
  });

  test("to-dos are care team only", async () => {
    await as(db, drA, "insert into tasks (patient_id, title) values ($1, 'Send PHQ-9')", [patient]);
    assert.equal((await as(db, patient, "select * from tasks")).length, 0);
    await rejects(as(db, patient, "insert into tasks (patient_id, title) values (auth.uid(), 'x')"), /permission denied|row-level/);
  });

  test("patients edit their phone but not their status or care team", async () => {
    await as(db, patient, "update patients set phone = '+966511111111' where id = auth.uid()");
    await rejects(as(db, patient, "update patients set status = 'discharged' where id = auth.uid()"), /care team/);
    await rejects(as(db, patient, "update patients set primary_practitioner_id = null where id = auth.uid()"), /permission denied/);
    await rejects(as(db, patient, "insert into care_team values (auth.uid(), $1)", [drB]), /permission denied/);
    await as(db, drA, "update patients set status = 'on_hold' where id = $1", [patient]);
    await as(db, drA, "update patients set status = 'active' where id = $1", [patient]);
  });

  test("completing a session counts it", async () => {
    // Row level security hides the row from the update, so nothing changes.
    await as(db, patient, "update appointments set status = 'completed' where id = $1", [appt]);
    const [before] = await as(db, patient, "select status from appointments where id = $1", [appt]);
    assert.equal(before.status, "scheduled");
    await as(db, drA, "update appointments set status = 'completed' where id = $1", [appt]);
    const [p] = await as(db, drA, "select completed_sessions from patients where id = $1", [patient]);
    assert.equal(p.completed_sessions, 1);
  });
});

describe("assessments", () => {
  let assignment: string;

  test("only the care team sends forms, and names come from the database", async () => {
    await rejects(
      as(db, drB, "insert into assessment_assignments (patient_id, form_id) values ($1, 'phq9')", [patient]),
      /row-level/,
    );
    [{ id: assignment }] = await as<{ id: string }>(db, drA,
      "insert into assessment_assignments (patient_id, form_id, patient_name, form_code) values ($1, 'phq9', 'Fake', 'Fake') returning id",
      [patient]);
    const [a] = await as(db, patient, "select patient_name, form_code from assessment_assignments where id = $1", [assignment]);
    assert.deepEqual(a, { patient_name: "Sara", form_code: "PHQ-9" });
  });

  test("submitting scores the answers and flags item 9, hidden from the patient", async () => {
    const answers = { q1: 2, q2: 2, q3: 1, q4: 1, q5: 0, q6: 1, q7: 0, q8: 0, q9: 1 };
    await as(db, patient, "select submit_assessment($1, $2)", [assignment, JSON.stringify(answers)]);
    const [r] = await as(db, drA, "select score, max_score, severity, safety_flag, incomplete from assessment_results");
    assert.deepEqual(r, { score: 8, max_score: 27, severity: "Mild", safety_flag: true, incomplete: false });
    assert.equal((await as(db, patient, "select * from assessment_results")).length, 0);
    assert.equal((await as(db, drB, "select * from assessment_results")).length, 0);
  });

  test("a form can only be submitted once", async () => {
    await rejects(as(db, patient, "select submit_assessment($1, '{}')", [assignment]), /already submitted/);
  });

  test("sending a form posts it in the chat in one step", async () => {
    await rejects(as(db, drB, "select send_assessment($1, 'gad7', 'Please fill this in')", [patient]), /care team/);
    const [{ id }] = await as<{ id: string }>(db, drA, "select send_assessment($1, 'gad7', 'Please fill this in') as id", [patient]);
    const [m] = await as(db, patient, "select text from messages where assessment_assignment_id = $1", [id]);
    assert.equal(m.text, "Please fill this in");
  });

  test("results can only be marked reviewed", async () => {
    await rejects(as(db, drA, "update assessment_results set score = 0"), /permission denied/);
    await as(db, drA, "update assessment_results set reviewed = true");
  });
});

describe("messages and templates", () => {
  test("patients message their practitioner but can't send templates", async () => {
    const [{ id: conv }] = await as<{ id: string }>(db, patient, "select id from conversations");
    await as(db, patient, "insert into messages (conversation_id, text) values ($1, 'Hello')", [conv]);
    const [{ id: tpl }] = await as<{ id: string }>(db, drA, "select id from templates where title = 'Welcome'");
    await rejects(
      as(db, patient, "insert into messages (conversation_id, text, template_id) values ($1, 'x', $2)", [conv, tpl]),
      /row-level/,
    );
    await as(db, drA, "insert into messages (conversation_id, text, template_id) values ($1, 'Welcome', $2)", [conv, tpl]);
    const [c] = await as(db, patient, "select last_message from conversations where id = $1", [conv]);
    assert.equal(c.last_message, "Welcome");
    assert.equal((await as(db, drB, "select * from messages")).length, 0);
  });

  test("templates: staff only, and only admins share with the clinic", async () => {
    assert.equal((await as(db, patient, "select * from templates")).length, 0);
    assert.equal((await as(db, drB, "select * from templates")).length, 4);
    await rejects(as(db, drA, "insert into templates (title, body, shared) values ('x', 'y', true)"), /row-level/);
    await as(db, drA, "insert into templates (title, body) values ('Mine', 'Private template')");
    assert.equal((await as(db, drB, "select * from templates where title = 'Mine'")).length, 0);
  });
});

describe("transfers", () => {
  let transfer: string;

  test("only the care team can start a transfer", async () => {
    await rejects(
      as(db, drB, "insert into transfers (patient_id, to_practitioner_id, reason) values ($1, $2, 'x')", [patient, drA]),
      /row-level/,
    );
    [{ id: transfer }] = await as<{ id: string }>(db, drA,
      "insert into transfers (patient_id, to_practitioner_id, reason) values ($1, $2, 'Needs CBT') returning id",
      [patient, drB]);
  });

  test("the sender can't accept their own transfer", async () => {
    await rejects(as(db, drA, "select respond_to_transfer($1, true)", [transfer]), /addressed to you/);
    await rejects(as(db, drA, "update transfers set status = 'accepted' where id = $1", [transfer]), /row-level/);
  });

  test("accepting moves the file to the new practitioner", async () => {
    await as(db, drB, "select respond_to_transfer($1, true)", [transfer]);
    assert.equal((await as(db, drB, "select * from notes")).length, 1);
    assert.equal((await as(db, drA, "select * from notes")).length, 0);
    const [p] = await as(db, drB, "select primary_practitioner_id from patients where id = $1", [patient]);
    assert.equal(p.primary_practitioner_id, drB);
    await rejects(as(db, drB, "select respond_to_transfer($1, true)", [transfer]), /already handled/);
  });
});

describe("availability requests", () => {
  let req: string;

  test("practitioners ask, only admins approve", async () => {
    [{ id: req }] = await as<{ id: string }>(db, drB,
      "insert into availability_requests (kind, from_date, to_date) values ('unavailable', $1, $1) returning id", [D2]);
    await rejects(as(db, drB, "select review_availability_request($1, true)", [req]), /Only admins/);
    assert.equal((await as(db, drA, "select * from availability_requests")).length, 0);
  });

  test("an approved day off blocks booking and reports clashes", async () => {
    await as(db, other, "select book_appointment($1, $2, '09:00')", [drB, D2]);
    const [r] = await as(db, admin, "select review_availability_request($1, true) as clashes", [req]);
    assert.equal(r.clashes, 1);
    await rejects(as(db, patient, "select book_appointment($1, $2, '11:30')", [drB, D2]), /not available/);
  });

  test("an approved extra day opens new times", async () => {
    const [{ id }] = await as<{ id: string }>(db, drA,
      `insert into availability_requests (kind, from_date, to_date, hours) values ('available', $1, $1, '{"start":"18:00","end":"20:00"}') returning id`,
      [D2]);
    await as(db, admin, "select review_availability_request($1, true)", [id]);
    await as(db, other, "select book_appointment($1, $2, '18:50')", [drA, D2]);
  });
});
