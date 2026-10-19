import { collection, orderBy, query, where } from 'firebase/firestore';
import { useMemo } from 'react';

import type { Appointment, AssessmentAssignment, Conversation, Practitioner } from '@chester/shared';

import { db } from './firebase';
import { useQuery } from './hooks';

export function usePractitioners() {
  const q = useMemo(() => query(collection(db, 'practitioners'), where('active', '==', true)), []);
  return useQuery<Practitioner>(q);
}

export function useMyAppointments(uid: string | undefined) {
  const q = useMemo(
    () => (uid ? query(collection(db, 'appointments'), where('patientId', '==', uid), orderBy('start', 'desc')) : null),
    [uid],
  );
  return useQuery<Appointment>(q);
}

export function useMyConversations(uid: string | undefined) {
  const q = useMemo(
    () => (uid ? query(collection(db, 'conversations'), where('patientId', '==', uid)) : null),
    [uid],
  );
  return useQuery<Conversation>(q);
}

export function useMyAssessments(uid: string | undefined) {
  const q = useMemo(
    () =>
      uid
        ? query(collection(db, 'assessmentAssignments'), where('patientId', '==', uid), orderBy('sentAt', 'desc'))
        : null,
    [uid],
  );
  return useQuery<AssessmentAssignment>(q);
}
