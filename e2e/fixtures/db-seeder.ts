import { Pool } from 'pg';
import {
  testUsers,
  testJobs,
  testVideos,
  testTranscripts,
  testSegments,
  type TestUser,
  type TestJob,
  type TestVideo,
  type TestTranscript,
  type TestSegment,
} from './test-data';

const FIXTURE_ID_PREFIX = '00000000-0000-0000-0000-%';

/**
 * Seeds a Rekolekt core database (the schema of the pinned `core` submodule
 * with every migration applied) so the frontend can be exercised against the
 * real API. The browser suite itself mocks the API and does not need this.
 */
export class DatabaseSeeder {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async connect() {
    try {
      await this.pool.query('SELECT 1');
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    const fixtureVideos = `SELECT id FROM videos WHERE job_id IN (SELECT id FROM jobs WHERE id::text LIKE $1)`;
    await this.pool.query(`DELETE FROM transcript_blocks WHERE video_id IN (${fixtureVideos})`, [
      FIXTURE_ID_PREFIX,
    ]);
    await this.pool.query(`DELETE FROM segments WHERE video_id IN (${fixtureVideos})`, [FIXTURE_ID_PREFIX]);
    await this.pool.query(`DELETE FROM transcripts WHERE video_id IN (${fixtureVideos})`, [FIXTURE_ID_PREFIX]);
    await this.pool.query(`DELETE FROM videos WHERE job_id IN (SELECT id FROM jobs WHERE id::text LIKE $1)`, [
      FIXTURE_ID_PREFIX,
    ]);
    await this.pool.query('DELETE FROM jobs WHERE id::text LIKE $1', [FIXTURE_ID_PREFIX]);
    await this.pool.query('DELETE FROM sessions WHERE user_id::text LIKE $1', [FIXTURE_ID_PREFIX]);
    await this.pool.query('DELETE FROM user_identities WHERE user_id::text LIKE $1', [FIXTURE_ID_PREFIX]);
    await this.pool.query('DELETE FROM users WHERE id::text LIKE $1', [FIXTURE_ID_PREFIX]);
    console.log('✅ Test data cleaned up');
  }

  async seedUsers(users: TestUser[] = testUsers) {
    console.log(`📝 Seeding ${users.length} test users...`);
    for (const user of users) {
      await this.pool.query(
        `INSERT INTO users (id, email, name, oauth_provider, oauth_subject, plan, role, created_at)
         VALUES ($1, $2, $3, 'google', $4, $5, $6, COALESCE($7::timestamptz, NOW()))
         ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             name = EXCLUDED.name,
             plan = EXCLUDED.plan,
             role = EXCLUDED.role`,
        [user.id, user.email, user.name, `fixture-${user.id}`, user.plan, user.role, user.created_at ?? null]
      );
    }
    console.log('✅ Test users seeded');
  }

  async seedJobs(jobs: TestJob[] = testJobs) {
    console.log(`📝 Seeding ${jobs.length} test jobs...`);
    for (const job of jobs) {
      await this.pool.query(
        `INSERT INTO jobs (id, owner_user_id, input_url, kind, state, stage, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::job_state, CASE WHEN $5 = 'completed' THEN 'completed' ELSE 'queued' END,
                 COALESCE($6::timestamptz, NOW()), NOW())
         ON CONFLICT (id) DO UPDATE
         SET input_url = EXCLUDED.input_url,
             kind = EXCLUDED.kind,
             state = EXCLUDED.state`,
        [job.id, job.owner_user_id, job.input_url, job.kind, job.state, job.created_at ?? null]
      );
    }
    console.log('✅ Test jobs seeded');
  }

  async seedVideos(videos: TestVideo[] = testVideos) {
    console.log(`📝 Seeding ${videos.length} test videos...`);
    for (const video of videos) {
      await this.pool.query(
        `INSERT INTO videos (id, job_id, youtube_id, title, duration_seconds, idx, state, channel_name,
                             uploaded_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::job_state, $8, $9::timestamptz,
                 COALESCE($10::timestamptz, NOW()), NOW())
         ON CONFLICT (id) DO UPDATE
         SET youtube_id = EXCLUDED.youtube_id,
             title = EXCLUDED.title,
             duration_seconds = EXCLUDED.duration_seconds,
             state = EXCLUDED.state,
             channel_name = EXCLUDED.channel_name,
             uploaded_at = EXCLUDED.uploaded_at`,
        [
          video.id,
          video.job_id,
          video.youtube_id,
          video.title,
          video.duration_seconds,
          video.idx,
          video.state,
          video.channel_name ?? null,
          video.uploaded_at ?? null,
          video.created_at ?? null,
        ]
      );
    }
    console.log('✅ Test videos seeded');
  }

  async seedTranscripts(
    transcripts: TestTranscript[] = testTranscripts,
    segments: TestSegment[] = testSegments
  ) {
    console.log(`📝 Seeding ${transcripts.length} test transcripts...`);
    for (const transcript of transcripts) {
      const fullText = segments
        .filter((segment) => segment.transcript_id === transcript.id)
        .map((segment) => segment.text)
        .join(' ');
      await this.pool.query(
        `INSERT INTO transcripts (id, video_id, model, language, full_text, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))
         ON CONFLICT (id) DO UPDATE
         SET model = EXCLUDED.model,
             language = EXCLUDED.language,
             full_text = EXCLUDED.full_text`,
        [
          transcript.id,
          transcript.video_id,
          transcript.model,
          transcript.language,
          fullText,
          transcript.created_at ?? null,
        ]
      );
    }
    console.log('✅ Test transcripts seeded');
  }

  async seedSegments(segments: TestSegment[] = testSegments, transcripts: TestTranscript[] = testTranscripts) {
    console.log(`📝 Seeding ${segments.length} test segments...`);
    const videoByTranscript = new Map(transcripts.map((transcript) => [transcript.id, transcript.video_id]));
    const indexByTranscript = new Map<string, number>();
    for (const segment of segments) {
      const videoId = videoByTranscript.get(segment.transcript_id);
      if (!videoId) throw new Error(`segment references unknown transcript ${segment.transcript_id}`);
      const idx = indexByTranscript.get(segment.transcript_id) ?? 0;
      indexByTranscript.set(segment.transcript_id, idx + 1);
      await this.pool.query(
        `INSERT INTO segments (video_id, transcript_id, idx, start_ms, end_ms, text, speaker_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          videoId,
          segment.transcript_id,
          idx,
          segment.start_ms,
          segment.end_ms,
          segment.text,
          segment.speaker_label ?? null,
        ]
      );
    }
    console.log('✅ Test segments seeded');
  }

  async seedAll() {
    console.log('🌱 Seeding all test data...');
    await this.cleanup();
    await this.seedUsers();
    await this.seedJobs();
    await this.seedVideos();
    await this.seedTranscripts();
    await this.seedSegments();
    console.log('✅ All test data seeded successfully');
  }

  async close() {
    await this.pool.end();
  }
}

function connectionStringFrom(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL to the core PostgreSQL database to seed');
  // The core uses SQLAlchemy URLs; node-postgres wants a plain postgresql:// URL.
  return url.replace(/^postgresql\+[a-z0-9]+:\/\//i, 'postgresql://');
}

/**
 * Helper function to seed test data before manual browser testing
 */
export async function seedTestData(connectionString?: string) {
  const seeder = new DatabaseSeeder(connectionStringFrom(connectionString));
  try {
    await seeder.connect();
    await seeder.seedAll();
  } finally {
    await seeder.close();
  }
}

/**
 * Helper function to clean up test data after manual browser testing
 */
export async function cleanupTestData(connectionString?: string) {
  const seeder = new DatabaseSeeder(connectionStringFrom(connectionString));
  try {
    await seeder.connect();
    await seeder.cleanup();
  } finally {
    await seeder.close();
  }
}
