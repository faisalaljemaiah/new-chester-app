"use client";

import type {
  Appointment,
  AssessmentForm,
  AssessmentResult,
  AvailabilityRequest,
  MessageTemplate,
  Patient,
  Practitioner,
  Transfer,
} from "@chester/shared";
import { collection, orderBy, query, where } from "firebase/firestore";
import { useMemo } from "react";

import { db } from "./firebase";
import { useQuery } from "./hooks";

export function useMyAppointments(uid: string | undefined) {
  const q = useMemo(
    () => (uid ? query(collection(db, "appointments"), where("practitionerId", "==", uid), orderBy("start", "asc")) : null),
    [uid],
  );
  return useQuery<Appointment>(q);
}

export function useMyPatients(uid: string | undefined) {
  const q = useMemo(
    () => (uid ? query(collection(db, "patients"), where("careTeam", "array-contains", uid)) : null),
    [uid],
  );
  return useQuery<Patient>(q);
}

export function usePractitioners() {
  const q = useMemo(() => query(collection(db, "practitioners"), where("active", "==", true)), []);
  return useQuery<Practitioner>(q);
}

export function useTransfers(uid: string | undefined, direction: "toPractitionerId" | "fromPractitionerId") {
  const q = useMemo(
    () => (uid ? query(collection(db, "transfers"), where(direction, "==", uid), orderBy("createdAt", "desc")) : null),
    [uid, direction],
  );
  return useQuery<Transfer>(q);
}

export function useMyResults(uid: string | undefined) {
  const q = useMemo(
    () =>
      uid
        ? query(collection(db, "assessmentResults"), where("practitionerId", "==", uid), orderBy("completedAt", "desc"))
        : null,
    [uid],
  );
  return useQuery<AssessmentResult>(q);
}

export function useMyAvailabilityRequests(uid: string | undefined) {
  const q = useMemo(
    () =>
      uid
        ? query(collection(db, "availabilityRequests"), where("practitionerId", "==", uid), orderBy("createdAt", "desc"))
        : null,
    [uid],
  );
  return useQuery<AvailabilityRequest>(q);
}

export function usePendingAvailabilityRequests(isAdmin: boolean) {
  const q = useMemo(
    () =>
      isAdmin
        ? query(collection(db, "availabilityRequests"), where("status", "==", "pending"), orderBy("createdAt", "desc"))
        : null,
    [isAdmin],
  );
  return useQuery<AvailabilityRequest>(q);
}

/** Clinic-wide templates plus the practitioner's own. Two queries because rules check each case. */
export function useTemplates(uid: string | undefined) {
  const sharedQ = useMemo(() => query(collection(db, "templates"), where("shared", "==", true)), []);
  const mineQ = useMemo(
    () => (uid ? query(collection(db, "templates"), where("ownerId", "==", uid)) : null),
    [uid],
  );
  const shared = useQuery<MessageTemplate>(sharedQ);
  const mine = useQuery<MessageTemplate>(mineQ);
  const data = useMemo(() => {
    const seen = new Set<string>();
    return [...mine.data, ...shared.data].filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  }, [mine.data, shared.data]);
  return { data, loading: shared.loading || mine.loading };
}

export function useForms() {
  const q = useMemo(() => query(collection(db, "assessmentForms"), where("active", "==", true)), []);
  return useQuery<AssessmentForm>(q);
}
