# New Chester Clinic: plan

An online psychiatry and psychology clinic with two apps on one Supabase backend:

- **Patient app** (iOS, Android and web) in the dark style of the reference design.
- **Practitioner dashboard** (web) in English and Arabic, with full right-to-left layout.

Screenshots of the app running on demo data are in [`docs/screenshots`](screenshots).

## Stack

| Part | Choice | Why |
|---|---|---|
| Patient app | Expo SDK 58, React Native, Expo Router | One codebase for iOS, Android and web. Builds and store submission through EAS. |
| Dashboard | Next.js 16, exported as static files | Runs fully in the browser, so any static host works (Vercel, Netlify, GitHub Pages). |
| Backend | Supabase: Postgres, Auth, Realtime | Free plan to start. Every rule lives in the database, so a modified app can't skip it. |
| Shared code | `packages/shared` | Row types, colours, slot calculation and questionnaire scoring used by both apps. |
| Region | West EU (Ireland, `eu-west-1`) | Keeps patient data in the EU. A Supabase project's region can't be changed later. |

The free plan has no automatic backups and pauses a project after a week with no activity. Before real patients use it, move to the Pro plan ($25 a month), which adds daily backups and stays on.

## Who can do what

Roles live in the `profiles` table. Only database functions can change them, and every access rule reads them.

| Role | How they get it | Can |
|---|---|---|
| Patient | Signs up in the app | Book, cancel, message their practitioners, fill in check-ins |
| Practitioner | An admin adds them on the dashboard's Team page | See only the patients on their care team |
| Admin (clinic owner) | Set once in the SQL editor (see setup step 5) | Everything practitioners can, plus approve availability requests and add staff |

## Data model

All tables have row level security on. Column grants also limit which fields each person can change: a patient can edit their phone number but never their care team or session count.

| Table | What it holds | Who reads it |
|---|---|---|
| `profiles` | Name, email, role, language | The user and admins |
| `practitioners` | Public profile, weekly hours, blocked days | Anyone signed in |
| `patients` | Patient file: status, session count, main practitioner | The patient and their care team |
| `care_team` | Which practitioners may open which patient file | The people in it |
| `notes` | Clinical notes | **Care team only, never the patient** |
| `tasks` | To-do list for a patient | Care team only |
| `appointments` | Session time, type, status, meeting link | The patient, the practitioner, the care team |
| `transfers` | A request to hand a patient to a colleague | The two practitioners |
| `availability_requests` | "I won't see patients" or "I'm available" requests | The practitioner and admins |
| `templates` | Saved messages and assessment links | Practitioners |
| `assessment_forms` | Questionnaires (PHQ-9 and GAD-7 included) | Anyone signed in |
| `assessment_assignments` | A form sent to a patient, and their answers | The patient and the care team |
| `assessment_results` | Score, severity and safety flag | **Care team only** |
| `conversations`, `messages` | Chat, including templates and form links | The two people in it |

Anything that has to be checked across tables is a database function the apps call:

| Function | Does |
|---|---|
| Sign-up trigger | Creates the profile and patient file when someone signs up |
| `book_appointment` | Checks the time is offered and free, books it, adds the practitioner to the care team and opens the chat. A unique index makes double booking impossible. |
| `booked_times` | Lists taken times for a day, with no patient details, so the app can hide them |
| `cancel_appointment` | Cancels a future session |
| `respond_to_transfer` | Accepting moves the patient to the new practitioner and, unless "keep my access" was ticked, removes the old one |
| `review_availability_request` | Admin approval updates the practitioner's schedule and reports how many booked sessions clash |
| `submit_assessment` | Scores the answers and flags PHQ-9 item 9 (self-harm). Each form can be submitted once. |
| Session trigger | Keeps the session count right when a session is marked completed |
| `promote_to_practitioner` | Admin turns an existing account into a practitioner or admin |

## Patient app screens

1. **Welcome**: "Your Mind, Cared For" with Get Started, after the reference's first screen.
2. **Sign in / sign up**, with password reset.
3. **Home**: greeting, search, services (Psychiatry, Psychology, Messages, Check-ins), next appointment, "Available Today" times, and the specialist list.
4. **Specialist and booking**: profile, the next 14 days, free times, video, voice or chat.
5. **Session**: the "Live Consultation" style screen, with a countdown, a Join button that opens 10 minutes before, messaging and cancelling.
6. **Appointments**: upcoming and past.
7. **Messages**: chat with each practitioner. Forms sent by the practitioner show an "Open check-in" button.
8. **Check-in form**: the questionnaire. If the self-harm question is answered above zero, it shows emergency contact details right away.
9. **Profile**: sessions done, upcoming sessions, check-ins to fill in, and sign out.

## Dashboard pages

| Page | What practitioners do there |
|---|---|
| Overview | Today's sessions, safety alerts, new results, transfers waiting |
| Appointments | Upcoming and past sessions. Add the meeting link, mark completed or no-show, cancel. |
| Patient files | Search their patients and open a file |
| Patient file | Status, sessions done, last session, score charts over time, private notes, to-do list, send assessments, chat with templates, session history, transfer |
| Transfers | Accept or decline incoming transfers. Withdraw outgoing ones. |
| Availability | Request time off ("this week" or "next week" in one tap) or extra days. Set weekly hours. Admins approve requests here. |
| Templates | Clinic templates and their own, in English or Arabic, as messages or assessment links |
| Assessments | Every result, with safety flags and unreviewed results first |
| Team (admin) | Add practitioners |

The language switch in the sidebar flips the whole dashboard to Arabic and right-to-left, and remembers the choice.

## What's tested

- 28 access tests (`npm run test:db`). They run the real migration on PGlite, an in-process Postgres, with a small stand-in for Supabase's auth schema, so no Docker or project is needed. They cover: notes, to-dos and scores hidden from patients and from other practitioners, no self-promotion to admin, booking only through `book_appointment` with no double booking and no times outside working hours, a form submitted once and scored correctly with the safety flag, only the care team can transfer a patient and only the receiver can accept, only admins approve schedule changes, and patients can't send templates or forms.
- Type checks pass for all packages. The patient web build and the dashboard static build both succeed.
- Not yet run end to end against a real Supabase project. That is the next step once the project has the tables (setup steps 2 and 3).

## Decisions for you

1. **Video calls.** Right now the practitioner pastes a Zoom or Meet link into the session. A built-in call (for example Daily, Agora or Twilio) can come next. That choice affects cost and where call data is processed.
2. **Backups.** The free plan has none. Move to Supabase Pro before real patient data goes in.
3. **Arabic for the patient app.** The dashboard is fully bilingual. The patient app is English for now, and I can add Arabic next. For PHQ-9 and GAD-7 in Arabic, use the clinic's validated translations rather than new ones.
4. **Photos and branding.** The welcome screen has room for a clinic photo like the reference's doctor image. Send a logo and photo when you have them.
5. **Payments and notifications** (session reminders, new message alerts) are not built yet.
6. **Repository visibility.** `new-chester-app` is public. The code contains no keys or patient data, but you may want it private.

## Setting up the Supabase project

The project `new-chester-app` exists in West EU (Ireland). To finish it:

1. **Keys.** In Project Settings > API Keys, copy the project URL and the **publishable** (anon) key into `apps/patient/.env.local` and `apps/dashboard/.env.local`, using the `.env.example` files as the template. Never put the secret (`service_role`) key in either app.
2. **Tables and rules.** Open the SQL Editor, paste all of `supabase/migrations/20261019000000_clinic.sql`, and run it. (Or with the Supabase CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.)
3. **Forms and templates.** In the SQL Editor, paste and run `supabase/seed.sql`.
4. **Sign-in settings.** In Authentication > URL Configuration, set the Site URL to where the dashboard is hosted (or `http://localhost:3000` for now). Email confirmation is on by default; leave it on.
5. **First admin.** Sign up in the patient app (or Authentication > Users > Add user), then run this in the SQL Editor with your own details:
   ```sql
   select promote_to_practitioner('you@clinic.com', 'Dr Your Name', 'Consultant Psychiatrist', 'psychiatry', true);
   ```
6. **Practitioners.** Invite each one from Authentication > Users > Invite user, then add them by email on the dashboard's Team page.
