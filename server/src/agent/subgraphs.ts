// A5 四个子工作流：strategy / resume / interview / qa
// 每个子图可独立编译执行；LLM 由外部注入（mock 或真实 ChatModelClient）
import { StateGraph, START, END, Annotation } from '@langchain/langgraph'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { AgentStateAnnotation, type AgentState, type ChatModelLike } from './state.js'
import { searchJobs } from '../services/jobSearch.js'
import { createOpportunity } from '../services/opportunities.js'
import { listStories } from '../services/stories.js'
import { getProfile } from '../services/agentMemory.js'
import { getLatestResume, createResume } from '../services/resumes.js'

/** 子图输出：与主 AgentState 兼容的 Partial */
type SubgraphOutput = Partial<AgentState>

// ================= 1. 求职策略子图 =================
// read_profile → search_jobs → evaluate_match → 推荐清单 →（用户确认）→ add_opportunity

export function createStrategySubgraph(llm: ChatModelLike) {
  const readProfile = async (state: AgentState): Promise<SubgraphOutput> => {
    const profile = state.userId ? await getProfile(state.userId) : null
    return { profile: (profile as unknown as Record<string, unknown>) ?? {} }
  }

  const searchJobsNode = async (state: AgentState): Promise<SubgraphOutput> => {
    const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
    const text = typeof lastUser?.content === 'string' ? lastUser.content : ''
    const profile = state.profile as { targetRoles?: string[]; skills?: string[] } | undefined
    const keywords = profile?.targetRoles?.[0] ?? text.slice(0, 30)
    const { items, total } = searchJobs({ keywords, city: 'any' })
    return { memory: { jobs: items, jobTotal: total } }
  }

  const evaluateMatch = async (state: AgentState): Promise<SubgraphOutput> => {
    const jobs = (state.memory.jobs ?? []) as Array<Record<string, unknown>>
    const profile = state.profile as { targetRoles?: string[]; skills?: string[] } | undefined
    const want = [...(profile?.skills ?? []), ...(profile?.targetRoles ?? [])].map((s) => String(s).toLowerCase())
    const scored = jobs.map((j) => {
      const tags = (j.tags ?? []) as unknown[]
      const text = `${String(j.role)} ${String(j.company)} ${tags.join(' ')} ${String(j.summary)}`.toLowerCase()
      const hits = want.filter((w) => text.includes(w)).length
      return { ...j, matchScore: Math.min(96, 55 + hits * 8) }
    })
    scored.sort((a, b) => (b.matchScore as number) - (a.matchScore as number))
    return { memory: { recommendations: scored } }
  }

  const recommend = async (state: AgentState): Promise<SubgraphOutput> => {
    const recs = (state.memory.recommendations ?? []) as Array<Record<string, unknown>>
    const top = recs.slice(0, 3)
    const lines = top
      .map((r, i) => `${i + 1}. ${String(r.company)} · ${String(r.role)}｜${String(r.salary)}｜匹配度 ${r.matchScore}%`)
      .join('\n')
    const content = `根据你的画像，为你推荐以下岗位：\n${lines || '（暂无可匹配岗位）'}\n\n回复「确认」即可把第 1 个岗位加入你的求职管线。`
    return { messages: [new AIMessage(content)] }
  }

  const confirmAdd = async (state: AgentState): Promise<SubgraphOutput> => {
    const recs = (state.memory.recommendations ?? []) as Array<Record<string, unknown>>
    const top = recs[0]
    if (!top || !state.userId) return { messages: [new AIMessage('没有可加入的岗位。')] }
    const opp = await createOpportunity(state.userId, {
      company: String(top.company),
      role: String(top.role),
      jd: String(top.summary ?? ''),
      location: String(top.location ?? ''),
      salary: String(top.salary ?? ''),
    })
    return {
      messages: [new AIMessage(`已将「${opp.company} · ${opp.role}」加入求职管线，匹配度 ${top.matchScore}%。`)],
      pendingTools: [],
    }
  }

  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('read_profile', readProfile)
    .addNode('search_jobs', searchJobsNode)
    .addNode('evaluate_match', evaluateMatch)
    .addNode('recommend', recommend)
    .addNode('confirm_add', confirmAdd)
    .addEdge(START, 'read_profile')
    .addEdge('read_profile', 'search_jobs')
    .addEdge('search_jobs', 'evaluate_match')
    .addEdge('evaluate_match', 'recommend')
    .addConditionalEdges('recommend', (state) => {
      const last = state.messages.at(-1)
      const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
      const text = typeof lastUser?.content === 'string' ? lastUser.content : ''
      void last
      return /确认|加入|添加/.test(text) ? 'confirm_add' : END
    })
    .addEdge('confirm_add', END)

  return graph
}

// ================= 2. 简历子图 =================
// list_stories → analyze_jd → generate_resume（异步占位）→ save_resume

export function createResumeSubgraph(llm: ChatModelLike) {
  const listStoriesNode = async (state: AgentState): Promise<SubgraphOutput> => {
    const stories = state.userId ? await listStories(state.userId) : []
    return { memory: { stories, storyCount: stories.length } }
  }

  const analyzeJd = async (state: AgentState): Promise<SubgraphOutput> => {
    const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
    const text = typeof lastUser?.content === 'string' ? lastUser.content : ''
    const res = await llm.invoke([
      { getType: () => 'system', content: '你是资深 HR。从用户消息中提取目标岗位的关键要求，用中文输出要点清单。' } as never,
      { getType: () => 'human', content: text } as never,
    ])
    return { memory: { jdAnalysis: typeof res.content === 'string' ? res.content : '（无 JD 信息）' } }
  }

  const generateResumeNode = async (state: AgentState): Promise<SubgraphOutput> => {
    const stories = (state.memory.stories ?? []) as Array<Record<string, unknown>>
    const analysis = String(state.memory.jdAnalysis ?? '')
    const bullets = stories.slice(0, 3).map((s) => `- ${String(s.title)}：${((s.bullets ?? []) as string[]).slice(0, 2).join('；')}`).join('\n')
    const content = `已根据 ${stories.length} 条经历生成简历草稿（目标：${analysis.slice(0, 40)}）：\n${bullets || '（经历库为空，请先补充经历）'}`
    return { messages: [new AIMessage(content)], memory: { resumeDraft: content } }
  }

  const saveResume = async (state: AgentState): Promise<SubgraphOutput> => {
    const draft = String(state.memory.resumeDraft ?? '')
    if (!state.userId) return { messages: [new AIMessage('未登录，无法保存简历。')] }
    const saved = await createResume(state.userId, {
      title: 'AI 生成简历',
      content: { draft, jdAnalysis: String(state.memory.jdAnalysis ?? '') },
    })
    return { messages: [new AIMessage(`简历已保存（${saved.title}）。可在「简历」页查看。`)] }
  }

  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('list_stories', listStoriesNode)
    .addNode('analyze_jd', analyzeJd)
    .addNode('generate_resume', generateResumeNode)
    .addNode('save_resume', saveResume)
    .addEdge(START, 'list_stories')
    .addEdge('list_stories', 'analyze_jd')
    .addEdge('analyze_jd', 'generate_resume')
    .addConditionalEdges('generate_resume', (state) => {
      const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
      const text = typeof lastUser?.content === 'string' ? lastUser.content : ''
      return /保存|确认|可以/.test(text) ? 'save_resume' : END
    })
    .addEdge('save_resume', END)

  return graph
}

// ================= 3. 面试子图 =================
// load_questions → ask_question → score_answer（Reflection）→ 复盘建议

const SAMPLE_QUESTIONS = [
  { q: '请介绍一下你自己。', hint: '突出与目标岗位匹配的经历' },
  { q: '你最有成就感的一个项目是什么？', hint: '用 STAR 法则：情境-任务-行动-结果' },
  { q: '为什么想加入我们公司？', hint: '结合公司业务与个人规划' },
]

export function createInterviewSubgraph(llm: ChatModelLike) {
  const loadQuestions = async (state: AgentState): Promise<SubgraphOutput> => {
    return { memory: { questions: SAMPLE_QUESTIONS, questionIdx: 0 } }
  }

  const askQuestion = async (state: AgentState): Promise<SubgraphOutput> => {
    const qs = (state.memory.questions ?? SAMPLE_QUESTIONS) as Array<{ q: string; hint: string }>
    const idx = (state.memory.questionIdx as number) ?? 0
    const q = qs[idx]
    const content = `【模拟面试 第 ${idx + 1} 题】\n${q?.q ?? ''}\n\n（提示：${q?.hint ?? ''}）\n\n请作答，我会点评并打分。`
    return { messages: [new AIMessage(content)], memory: { questionIdx: idx + 1 } }
  }

  const scoreAnswer = async (state: AgentState): Promise<SubgraphOutput> => {
    const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
    const answer = typeof lastUser?.content === 'string' ? lastUser.content : ''
    const res = await llm.invoke([
      { getType: () => 'system', content: '你是资深面试官。对候选人的回答按 结构/亮点/改进 点评，并给出 0-100 分。' } as never,
      { getType: () => 'human', content: answer } as never,
    ])
    const qs = (state.memory.questions ?? SAMPLE_QUESTIONS) as Array<{ q: string }>
    const idx = ((state.memory.questionIdx as number) ?? 1) - 1
    const q = qs[idx]
    const content = `【第 ${idx + 1} 题点评】\n题目：${q?.q ?? ''}\n\n${typeof res.content === 'string' ? res.content : '（评分完成）'}`
    return { messages: [new AIMessage(content)] }
  }

  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('load_questions', loadQuestions)
    .addNode('ask_question', askQuestion)
    .addNode('score_answer', scoreAnswer)
    .addEdge(START, 'load_questions')
    .addEdge('load_questions', 'ask_question')
    .addConditionalEdges('ask_question', (state) => {
      const last = state.messages.at(-1)
      const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
      const text = typeof lastUser?.content === 'string' ? lastUser.content : ''
      // 刚问完题（最后是 assistant 提问）→ 等用户作答；用户作答后 → 评分
      return last?.getType?.() === 'human' && text.length > 3 ? 'score_answer' : END
    })
    .addEdge('score_answer', END)

  return graph
}

// ================= 4. 问答子图 =================
// 单步：读画像/经历/机会上下文 → LLM 回答（不写状态）

export function createQaSubgraph(llm: ChatModelLike) {
  const answer = async (state: AgentState): Promise<SubgraphOutput> => {
    const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
    const question = typeof lastUser?.content === 'string' ? lastUser.content : ''
    const profile = state.userId ? await getProfile(state.userId) : null
    const stories = state.userId ? await listStories(state.userId) : []
    const resume = state.userId ? await getLatestResume(state.userId) : null
    const ctx = [
      profile ? `用户画像：${JSON.stringify(profile).slice(0, 200)}` : '用户画像：暂无',
      `经历数：${stories.length}；简历：${resume ? '已有' : '暂无'}`,
    ].join('\n')
    const res = await llm.invoke([
      { getType: () => 'system', content: `你是求职领域助手 Greenhouse，基于以下用户上下文回答：\n${ctx}` } as never,
      { getType: () => 'human', content: question } as never,
    ])
    return { messages: [new AIMessage(typeof res.content === 'string' ? res.content : JSON.stringify(res.content))] }
  }

  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('answer', answer)
    .addEdge(START, 'answer')
    .addEdge('answer', END)

  return graph
}

export type Subgraph = ReturnType<typeof createStrategySubgraph>
export { HumanMessage }
