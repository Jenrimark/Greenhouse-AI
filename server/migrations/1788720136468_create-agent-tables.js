// Agent 预留表：conversations / messages / agent_traces / user_profiles
// 对应 docs/AGENT-IMPLEMENTATION.md §3（阶段 1 同步建，避免二次迁移）
// 注意：node-pg-migrate 的 references 使用字符串列名时会对 user_id 等做自动映射，
// 这里显式写 references: 'users' 即外键到 users(id)。

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  // ---- conversations ----
  pgm.createTable('conversations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    title: { type: 'text', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('conversations', ['user_id', pgm.func('updated_at desc')], { name: 'idx_conv_user' })

  // ---- messages ----
  pgm.createTable('messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    conversation_id: { type: 'uuid', notNull: true, references: 'conversations', onDelete: 'CASCADE' },
    role: {
      type: 'text',
      notNull: true,
      check: "role IN ('user','assistant','tool','system')",
    },
    content: { type: 'text', notNull: false },
    tool_calls: { type: 'jsonb', notNull: false },
    tool_results: { type: 'jsonb', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('messages', ['conversation_id', 'created_at'], { name: 'idx_msg_conv' })

  // ---- agent_traces ----
  pgm.createTable('agent_traces', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    run_id: { type: 'uuid', notNull: true },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    conversation_id: { type: 'uuid', notNull: false, references: 'conversations', onDelete: 'SET NULL' },
    node: { type: 'text', notNull: true },
    action: { type: 'text', notNull: false },
    input: { type: 'jsonb', notNull: false },
    output: { type: 'jsonb', notNull: false },
    provider: { type: 'text', notNull: false },
    model: { type: 'text', notNull: false },
    prompt_tokens: { type: 'integer', notNull: false },
    completion_tokens: { type: 'integer', notNull: false },
    cost: { type: 'numeric(10,4)', notNull: false },
    duration_ms: { type: 'integer', notNull: false },
    status: { type: 'text', notNull: true, default: 'ok' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('agent_traces', 'run_id', { name: 'idx_trace_run' })

  // ---- user_profiles ----
  pgm.createTable('user_profiles', {
    user_id: { type: 'uuid', primaryKey: true, references: 'users', onDelete: 'CASCADE' },
    target_roles: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    skills: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    experience_years: { type: 'integer', notNull: false },
    preferences: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    raw: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
  pgm.dropTable('user_profiles', { cascade: true })
  pgm.dropTable('agent_traces', { cascade: true })
  pgm.dropTable('messages', { cascade: true })
  pgm.dropTable('conversations', { cascade: true })
}
