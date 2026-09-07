// A6 异步任务表：agent_tasks（简历生成等异步节点）
/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  pgm.createTable('agent_tasks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    conversation_id: { type: 'uuid', notNull: false, references: 'conversations', onDelete: 'SET NULL' },
    type: { type: 'text', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending','running','done','failed')",
    },
    input: { type: 'jsonb', notNull: false },
    output: { type: 'jsonb', notNull: false },
    error: { type: 'text', notNull: false },
    attempts: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    finished_at: { type: 'timestamptz', notNull: false },
  })
  pgm.createIndex('agent_tasks', ['user_id', pgm.func('created_at desc')], { name: 'idx_tasks_user' })
  pgm.createIndex('agent_tasks', 'status', { name: 'idx_tasks_status' })
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
  pgm.dropTable('agent_tasks', { cascade: true })
}
