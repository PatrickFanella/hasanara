/**
 * Fixtures for seeding a Rekolekt core database for manual browser testing
 * against the real API. Columns follow the schema of the pinned core
 * (`core/sql/schema.sql` and `core/alembic/versions`).
 */

export interface TestUser {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro';
  role: 'user' | 'moderator' | 'admin';
  created_at?: string;
}

export interface TestJob {
  id: string;
  owner_user_id: string;
  input_url: string;
  kind: 'single' | 'channel';
  state: 'pending' | 'expanded' | 'completed' | 'failed';
  created_at?: string;
}

export interface TestVideo {
  id: string;
  job_id: string;
  youtube_id: string;
  title: string;
  duration_seconds: number;
  idx: number;
  state: 'pending' | 'downloading' | 'transcoding' | 'transcribing' | 'completed' | 'failed';
  channel_name?: string;
  uploaded_at?: string;
  created_at?: string;
}

export interface TestTranscript {
  id: string;
  video_id: string;
  model: string;
  language: string;
  created_at?: string;
}

export interface TestSegment {
  transcript_id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_label?: string | null;
}

/**
 * Sample test users
 */
export const testUsers: TestUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'free-user@example.com',
    name: 'Free User',
    plan: 'free',
    role: 'user',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'pro-user@example.com',
    name: 'Pro User',
    plan: 'pro',
    role: 'user',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'admin-user@example.com',
    name: 'Admin User',
    plan: 'pro',
    role: 'admin',
  },
];

/**
 * Sample test jobs
 */
export const testJobs: TestJob[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    owner_user_id: '00000000-0000-0000-0000-000000000001',
    input_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    kind: 'single',
    state: 'completed',
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    owner_user_id: '00000000-0000-0000-0000-000000000002',
    input_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    kind: 'single',
    state: 'completed',
  },
];

/**
 * Sample test videos
 */
export const testVideos: TestVideo[] = [
  {
    id: '00000000-0000-0000-0000-000000000201',
    job_id: '00000000-0000-0000-0000-000000000101',
    youtube_id: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up',
    duration_seconds: 212,
    idx: 0,
    state: 'completed',
    channel_name: 'Rick Astley',
    uploaded_at: '2026-06-15T12:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000202',
    job_id: '00000000-0000-0000-0000-000000000102',
    youtube_id: 'jNQXAC9IVRw',
    title: 'Me at the zoo',
    duration_seconds: 19,
    idx: 0,
    state: 'completed',
    channel_name: 'jawed',
    uploaded_at: '2026-05-20T12:00:00Z',
  },
];

/**
 * Sample test transcripts
 */
export const testTranscripts: TestTranscript[] = [
  {
    id: '00000000-0000-0000-0000-000000000301',
    video_id: '00000000-0000-0000-0000-000000000201',
    model: 'base',
    language: 'en',
  },
  {
    id: '00000000-0000-0000-0000-000000000302',
    video_id: '00000000-0000-0000-0000-000000000202',
    model: 'base',
    language: 'en',
  },
];

/**
 * Sample test segments. Segment ids are assigned by the database.
 */
export const testSegments: TestSegment[] = [
  {
    transcript_id: '00000000-0000-0000-0000-000000000301',
    start_ms: 0,
    end_ms: 5000,
    text: "We're no strangers to love",
    speaker_label: null,
  },
  {
    transcript_id: '00000000-0000-0000-0000-000000000301',
    start_ms: 5000,
    end_ms: 10000,
    text: 'You know the rules and so do I',
    speaker_label: null,
  },
  {
    transcript_id: '00000000-0000-0000-0000-000000000302',
    start_ms: 0,
    end_ms: 3000,
    text: 'All right, so here we are in front of the elephants',
    speaker_label: null,
  },
  {
    transcript_id: '00000000-0000-0000-0000-000000000302',
    start_ms: 3000,
    end_ms: 6000,
    text: 'The cool thing about these guys is that they have really, really, really long trunks',
    speaker_label: null,
  },
];
