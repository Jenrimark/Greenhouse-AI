// 业务核心表：users / sessions / opportunities / stories / resumes / credits_tx
// 对应 docs/ARCHITECTURE.md §7 数据模型

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  // ---- users ----
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true },
    password_hash: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    handle: { type: 'text', notNull: false },
    avatar_url: { type: 'text', notNull: false },
    wx_openid: { type: 'text', notNull: false },
    credits: { type: 'integer', notNull: true, default: 0 },
    status: { type: 'text', notNull: true, default: 'active' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('users', pgm.func('lower(email)'), { unique: true, name: 'users_email_lower_uidx' })
  pgm.createIndex('users', 'wx_openid', { unique: true, where: 'wx_openid IS NOT NULL', name: 'users_wx_openid_uidx' })

  // ---- sessions ----
  pgm.createTable('sessions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    token_hash: { type: 'text', notNull: true, unique: true },
    ip: { type: 'text', notNull: false },
    user_agent: { type: 'text', notNull: false },
    expires_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('sessions', 'user_id')

  // ---- opportunities ----
  pgm.createTable('opportunities', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    company: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true },
    jd: { type: 'text', notNull: false },
    location: { type: 'text', notNull: false },
    salary: { type: 'text', notNull: false },
    stage: { type: 'text', notNull: true, default: 'applied' },
    match: { type: 'integer', notNull: false },
    next_action: { type: 'jsonb', notNull: false },
    questions: { type: 'jsonb', notNull: false },
    rounds: { type: 'jsonb', notNull: false },
    due_at: { type: 'timestamptz', notNull: false },
    sample: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('opportunities', 'user_id')

  // ---- stories ----
  pgm.createTable('stories', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    title: { type: 'text', notNull: true },
    org: { type: 'text', notNull: false },
    start: { type: 'text', notNull: false },
    end: { type: 'text', notNull: false },
    bullets: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    tags: { type: 'text[]', notNull: true, default: pgm.func("'{}'::text[]") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('stories', 'user_id')

  // ---- resumes ----
  pgm.createTable('resumes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    title: { type: 'text', notNull: true },
    template_id: { type: 'text', notNull: false },
    content: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    file_url: { type: 'text', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('resumes', 'user_id')

  // ---- credits_tx ----
  pgm.createTable('credits_tx', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    amount: { type: 'integer', notNull: true },
    reason: { type: 'text', notNull: true },
    ref_id: { type: 'text', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('credits_tx', ['user_id', 'created_at'])
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
  pgm.dropTable('credits_tx', { cascade: true })
  pgm.dropTable('resumes', { cascade: true })
  pgm.dropTable('stories', { cascade: true })
  pgm.dropTable('opportunities', { cascade: true })
  pgm.dropTable('sessions', { cascade: true })
  pgm.dropTable('users', { cascade: true })
}
