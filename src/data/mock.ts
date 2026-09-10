export interface QuizOption {
  id: string;
  label: string;
}

export const QUIZ_OPTIONS: QuizOption[] = [
  { id: 'anxiety', label: 'Anxiety or stress' },
  { id: 'mood', label: 'Low mood or depression' },
  { id: 'physical', label: 'A physical health concern' },
  { id: 'ongoing', label: 'Ongoing condition check-in' },
  { id: 'unsure', label: 'Not sure yet' },
];

export interface Specialist {
  id: string;
  name: string;
  initials: string;
  title: string;
  specialty: string;
  rating: number;
  reviews: number;
  yearsExperience: number;
  school: string;
  bio: string;
  nextSlot: string;
}

export const SPECIALISTS: Specialist[] = [
  {
    id: 'renn',
    name: 'Dr. Sofia Renn',
    initials: 'SR',
    title: 'Psychologist',
    specialty: 'Anxiety & Trauma',
    rating: 4.9,
    reviews: 312,
    yearsExperience: 13,
    school: 'Yale',
    bio: 'Trauma-focused therapy with a calm, structured approach — a strong fit for anxiety and stress support.',
    nextSlot: 'Today, 2:30 PM',
  },
  {
    id: 'lee',
    name: 'Dr. Marcus Lee',
    initials: 'ML',
    title: 'Dermatologist',
    specialty: 'Dermatology',
    rating: 4.8,
    reviews: 198,
    yearsExperience: 9,
    school: 'Johns Hopkins',
    bio: 'Board-certified dermatologist focused on acne, eczema, and routine skin checks — known for a calm, thorough bedside manner.',
    nextSlot: 'Tomorrow, 9:15 AM',
  },
  {
    id: 'osei',
    name: 'Dr. Amara Osei',
    initials: 'AO',
    title: 'Internal Medicine',
    specialty: 'Internal Medicine',
    rating: 5.0,
    reviews: 481,
    yearsExperience: 11,
    school: 'Duke',
    bio: 'Whole-person primary care with a focus on preventive health and clear, unhurried explanations.',
    nextSlot: 'Today, 4:00 PM',
  },
  {
    id: 'kade',
    name: 'Dr. Elias Kade',
    initials: 'EK',
    title: 'Cardiologist',
    specialty: 'Cardiology',
    rating: 4.8,
    reviews: 156,
    yearsExperience: 15,
    school: 'Stanford',
    bio: 'Preventive cardiology and long-term risk management, with an emphasis on lifestyle-first care.',
    nextSlot: 'Thu, 1:45 PM',
  },
];

export interface SessionHistoryItem {
  id: string;
  month: string;
  day: string;
  doctorName: string;
  note: string;
  status: 'upcoming' | 'completed';
}

export const SESSION_HISTORY: SessionHistoryItem[] = [
  { id: 's1', month: 'Sep', day: '14', doctorName: 'Dr. Sofia Renn', note: 'Follow-up · 2:30 PM', status: 'upcoming' },
  { id: 's2', month: 'Aug', day: '28', doctorName: 'Dr. Sofia Renn', note: 'Therapy session · 45 min', status: 'completed' },
  { id: 's3', month: 'Aug', day: '14', doctorName: 'Dr. Sofia Renn', note: 'Intake session · 50 min', status: 'completed' },
];

export const PATIENT = {
  firstName: 'Kevin',
  fullName: 'Kevin Merico',
  initials: 'KM',
};

export const SESSIONS_USED = 3;
export const SESSIONS_TOTAL = 6;
export const PRIMARY_PROVIDER = SPECIALISTS[0];
