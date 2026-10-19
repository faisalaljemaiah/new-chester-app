# New Chester Clinic: plan

An online psychiatry and psychology clinic with two apps on one Firebase backend:

- **Patient app** (iOS, Android and web) in the dark style of the reference design.
- **Practitioner dashboard** (web) in English and Arabic, with full right-to-left layout.

Screenshots of the current build running on demo data are in [`docs/screenshots`](screenshots).

## Stack

| Part | Choice | Why |
|---|---|---|
| Patient app | Expo SDK 58, React Native, Expo Router | One codebase for iOS, Android and web. Builds and store submission through EAS. |
| Dashboard | Next.js 16, exported as static files | Runs fully in the browser. Hosted on Firebase Hosting. |
| Backend | Firebase Auth, Firestore, Cloud Functions (Node 22), Storage | As requested, instead of Supabase. |
| Shared code | `packages/shared` | Data types, colours, slot calculation and questionnaire scoring used by all three. |
| Region | `me-central2` (Dammam) | Keeps patient data in Saudi Arabia. Change it in one place if the clinic is elsewhere. |

## Who can do what

Roles live in a Firebase Auth custom claim that only Cloud Functions can set. The security rules trust that claim.

| Role | How they get it | Can |
|---|---|---|
| Patient | Signs up in the app | Book, cancel, message their practitioners, fill in check-ins |
| Practitioner | An admin adds them in the dashboard's Team page | See only the patients on their care team |
| Admin (clinic owner) | One-time `make-admin` script | Everything practitioners can, plus approve availability requests and add staff |

## Data model (Firestore)

| Collection | What it holds | Who reads it |
|---|---|---|
| `users/{uid}` | Name, email, role, language | The user and admins |
| `practitioners/{uid}` | Public profile, weekly hours, blocked days | Any signed-in user |
| `patients/{uid}` | Patient file: status, care team, session count | The patient and their care team |
| `patients/{id}/notes` | Clinical notes | **Care team only, never the patient** |
| `patients/{id}/tasks` | To-do list for this patient | Care team only |
| `appointments/{id}` | Session time, type, status, meeting link | The patient, the practitioner, the care team |
| `bookedSlots/{practitioner}_{date}` | Taken start times, with no patient details | Any signed-in user (so the app can hide them) |
| `transfers/{id}` | A request to hand a patient to a colleague | The two practitioners |
| `availabilityRequests/{id}` | "I won't see patients" or "I'm available" requests | The practitioner and admins |
| `templates/{id}` | Saved messages and assessment links | Practitioners |
| `assessmentForms/{id}` | Questionnaires (PHQ-9 and GAD-7 included) | Anyone signed in |
| `assessmentAssignments/{id}` | A form sent to a patient, and their answers | The patient and the care team |
| `assessmentResults/{id}` | Score, severity and safety flag | **Care team only** |
| `conversations/{patient}_{practitioner}/messages` | Chat, including templates and form links | The two people in it |

Anything that has to be checked across documents runs in a Cloud Function, so a modified app can't skip the check:

| Function | Does |
|---|---|
| `registerPatient` | Creates the patient file and sets the patient role after sign-up |
| `bookAppointment` | Checks the slot is free inside a transaction, books it, adds the practitioner to the care team and opens the chat |
| `cancelAppointment` | Cancels a future session and frees the slot |
| `respondToTransfer` | Accepting moves the patient to the new practitioner and, unless "keep my access" was ticked, removes the old one |
| `reviewAvailabilityRequest` | Admin approval updates the practitioner's schedule and reports how many booked sessions clash |
| `onAssessmentSubmitted` | Scores the answers and flags PHQ-9 item 9 (self-harm) |
| `onAppointmentUpdated` | Keeps the session count right when a session is marked completed |
| `createPractitioner` | Admin adds a practitioner and gets a link for them to set their password |

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

- 20 security-rule tests on the Firestore emulator (`npm run test:rules`). They cover: notes and scores hidden from patients, other practitioners kept out, no self-promotion to admin, patients can't book directly or change their care team, a form can only be submitted once, and only the care team can transfer a patient.
- Type checks pass for all four packages. The patient web build and the dashboard static build both succeed.
- Both apps were run against the emulator with demo data (`npm run demo -w functions`), which is where the screenshots come from.
- Not yet run end to end: the Cloud Functions, because the emulator in my sandbox couldn't register the Firestore triggers. They type-check and bundle. They need a run on your machine or a test Firebase project.

## Decisions for you

1. **Video calls.** Right now the practitioner pastes a Zoom or Meet link into the session. A built-in call (for example Daily, Agora or Twilio) can come next. That choice affects cost and where call data is processed.
2. **Data location.** I picked Saudi Arabia (`me-central2`). Firestore's location can't be changed after the project is created, so please confirm the region before we create the real project.
3. **Arabic for the patient app.** The dashboard is fully bilingual. The patient app is English for now, and I can add Arabic next. For PHQ-9 and GAD-7 in Arabic, use the clinic's validated translations rather than new ones.
4. **Photos and branding.** The welcome screen has room for a clinic photo like the reference's doctor image. Send a logo and photo when you have them.
5. **Payments and notifications** (session reminders, new message alerts) are not built yet.
6. **Repository visibility.** `new-chester-app` is public. The code contains no keys or patient data, but you may want it private.

## Setting up the real Firebase project (when you're ready)

I haven't created any Firebase project or credentials. When you approve:

1. Create a Firebase project on the Blaze plan (Cloud Functions need it). Enable Email/Password sign-in. Create Firestore in the chosen region.
2. Add a web app, then copy its config into `apps/patient/.env.local` and `apps/dashboard/.env.local`, using the `.env.example` files as the template.
3. Run `cp firebase/.firebaserc.example firebase/.firebaserc`, then put your project ID in it.
4. Run `npx firebase deploy --config firebase/firebase.json`. This deploys the rules, indexes, functions and the dashboard.
5. Run `npm run seed -w functions` to load the PHQ-9 and GAD-7 forms and the starter templates.
6. Add your own account under Authentication > Users in the Firebase console, then run `npm run make-admin -w functions -- you@clinic.com`.
