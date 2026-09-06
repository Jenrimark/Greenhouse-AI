// 短 ID 生成（规则版 AI 的题目 ID、演示检索岗位 ID 等非主键场景）
export function id(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
