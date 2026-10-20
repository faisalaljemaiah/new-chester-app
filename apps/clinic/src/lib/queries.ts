import type {
  Appointment,
  AssessmentAssignment,
  Conversation,
  Practitioner,
  PractitionerChangeRequest,
  RescheduleRequest,
} from '@chester/shared';

import { useRows } from './hooks';
import { supabase } from './supabase';

export function usePractitioners() {
  return useRows<Practitioner>(
    'practitioners',
    () => supabase.from('practitioners').select('*').eq('active', true).order('display_name'),
    ['practitioners'],
  );
}

export function useMyAppointments(uid: string | undefined) {
  return useRows<Appointment>(
    uid ? `appointments:${uid}` : null,
    () => supabase.from('appointments').select('*').eq('patient_id', uid!).order('start_at', { ascending: false }),
    ['appointments'],
  );
}

export function useMyConversations(uid: string | undefined) {
  return useRows<Conversation>(
    uid ? `conversations:${uid}` : null,
    () =>
      supabase
        .from('conversations')
        .select('*')
        .eq('patient_id', uid!)
        .order('last_message_at', { ascending: false, nullsFirst: false }),
    ['conversations'],
  );
}

export function useMyAssessments(uid: string | undefined) {
  return useRows<AssessmentAssignment>(
    uid ? `assessments:${uid}` : null,
    () =>
      supabase.from('assessment_assignments').select('*').eq('patient_id', uid!).order('sent_at', { ascending: false }),
    ['assessment_assignments'],
  );
}

/** Start times already booked for a practitioner on a date (no patient details). */
export function useBookedTimes(practitionerId: string | undefined, date: string) {
  return useRows<string>(
    practitionerId ? `booked:${practitionerId}:${date}` : null,
    () => supabase.rpc('booked_times', { p_practitioner: practitionerId!, p_date: date }),
    ['appointments'],
  );
}

export function useMyChangeRequests(uid: string | undefined) {
  return useRows<PractitionerChangeRequest>(
    uid ? `change-requests:${uid}` : null,
    () =>
      supabase
        .from('practitioner_change_requests')
        .select('*')
        .eq('patient_id', uid!)
        .order('created_at', { ascending: false }),
    ['practitioner_change_requests'],
  );
}

/** Postpone requests for one session, newest first. */
export function useRescheduleRequests(appointmentId: string | undefined) {
  return useRows<RescheduleRequest>(
    appointmentId ? `reschedules:${appointmentId}` : null,
    () =>
      supabase
        .from('reschedule_requests')
        .select('*')
        .eq('appointment_id', appointmentId!)
        .order('created_at', { ascending: false }),
    ['reschedule_requests'],
  );
}
