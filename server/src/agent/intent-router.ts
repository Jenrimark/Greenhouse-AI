// A5 意图路由：把用户消息分类到 strategy/resume/interview/qa/chat
// mock：关键词规则版（无 key 可验收）；real：LLM 结构化分类
import { HumanMessage, SystemMessage, type AIMessage } from '@langchain/core/messages'
import type { AgentState, ChatModelLike } from './state.js'

export type Intent = 'strategy' | 'resume' | 'interview' | 'qa' | 'chat'

// ---- mock 规则版 ----

const STRATEGY_KEYS = ['策略', '求职', '机会', '岗位', '投递', '管线', '规划', '方向', '匹配', '找', 'target']
const RESUME_KEYS = ['简历', 'resume', '润色', '优化简历', '写简历']
const INTERVIEW_KEYS = ['面试', 'interview', '面经', '八股', '模拟面试', '反问']
const QA_KEYS = ['问答', '知识', '是什么', '为什么', '怎么', '如何', '解释', '区别', '原理']
const CHAT_KEYS = ['你好', '嗨', '谢谢', '再见', '你是谁', 'hello', 'hi']

export function classifyIntentRuleBased(text: string): Intent {
  const t = text.toLowerCase()
  const hit = (keys: string[]) => keys.some((k) => t.includes(k.toLowerCase()))
  if (hit(RESUME_KEYS)) return 'resume'
  if (hit(INTERVIEW_KEYS)) return 'interview'
  if (hit(STRATEGY_KEYS)) return 'strategy'
  if (hit(QA_KEYS)) return 'qa'
  if (hit(CHAT_KEYS)) return 'chat'
  return 'qa'
}

// ---- LLM 版 ----

const ROUTER_SYSTEM = `你是求职助手 Greenhouse 的意图路由器。只输出一个单词：strategy / resume / interview / qa / chat。
- strategy：求职策略、岗位机会、投递管线、职业规划
- resume：简历相关（生成/润色/分析）
- interview：面试准备、模拟面试、面经
- qa：一般知识问答（技术/行业问题）
- chat：寒暄、身份询问、感谢
不要输出任何其他内容。`

export function createIntentRouter(llm: ChatModelLike) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
    const text = typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content ?? '')
    const res = await llm.invoke([new SystemMessage(ROUTER_SYSTEM), new HumanMessage(text)])
    const raw = typeof res.content === 'string' ? res.content.trim().toLowerCase() : ''
    const intent = (['strategy', 'resume', 'interview', 'qa', 'chat'] as Intent[]).find((i) => raw.includes(i)) ?? 'qa'
    return { intent }
  }
}

/** mock LLM 路由器：规则分类，但保持 LLM 调用形态（供真实/模拟切换） */
export function createMockIntentRouter() {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
    const text = typeof lastUser?.content === 'string' ? lastUser.content : ''
    return { intent: classifyIntentRuleBased(text) }
  }
}

export type { AIMessage }
