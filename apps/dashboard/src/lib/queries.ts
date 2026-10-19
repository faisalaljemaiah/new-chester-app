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

import { useRows } from "./hooks";
import { supabase } from "./supabase";

export function useMyAppointments(uid: string | undefined) {
  return useRows<Appointment>(
    uid ? `appointments:${uid}` : null,
    () => supabase.from("appointments").select("*").eq("practitioner_id", uid!).order("start_at"),
    ["appointments"],
  );
}

/** Patients on this practitioner's care team. */
export function useMyPatients(uid: string | undefined) {
  return useRows<Patient>(
    uid ? `patients:${uid}` : null,
    () =>
      supabase
        .from("patients")
        .select("*, care_team!inner(practitioner_id)")
        .eq("care_team.practitioner_id", uid!)
        .order("display_name"),
    ["patients", "care_team"],
  );
}

export function usePractitioners() {
  return useRows<Practitioner>(
    "practitioners",
    () => supabase.from("practitioners").select("*").eq("active", true).order("display_name"),
    ["practitioners"],
  );
}

export function useTransfers(uid: string | undefined, direction: "to_practitioner_id" | "from_practitioner_id") {
  return useRows<Transfer>(
    uid ? `transfers:${direction}:${uid}` : null,
    () => supabase.from("transfers").select("*").eq(direction, uid!).order("created_at", { ascending: false }),
    ["transfers"],
  );
}

/** Results for patients on this practitioner's care team (admins see only their own patients here too). */
export function useMyResults(uid: string | undefined) {
  return useRows<AssessmentResult>(
    uid ? `results:${uid}` : null,
    () =>
      supabase
        .from("assessment_results")
        .select("*, patients!inner(care_team!inner(practitioner_id))")
        .eq("patients.care_team.practitioner_id", uid!)
        .order("completed_at", { ascending: false }),
    ["assessment_results", "care_team"],
  );
}

export function useMyAvailabilityRequests(uid: string | undefined) {
  return useRows<AvailabilityRequest>(
    uid ? `requests:${uid}` : null,
    () =>
      supabase
        .from("availability_requests")
        .select("*")
        .eq("practitioner_id", uid!)
        .order("created_at", { ascending: false }),
    ["availability_requests"],
  );
}

export function usePendingAvailabilityRequests(isAdmin: boolean) {
  return useRows<AvailabilityRequest>(
    isAdmin ? "requests:pending" : null,
    () =>
      supabase
        .from("availability_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ["availability_requests"],
  );
}

/** Clinic-wide templates plus the practitioner's own (access rules return exactly these). */
export function useTemplates(uid: string | undefined) {
  return useRows<MessageTemplate>(
    uid ? `templates:${uid}` : null,
    () => supabase.from("templates").select("*").order("created_at"),
    ["templates"],
  );
}

export function useForms() {
  return useRows<AssessmentForm>(
    "forms",
    () => supabase.from("assessment_forms").select("*").eq("active", true).order("code"),
    ["assessment_forms"],
  );
}
