import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Hash, MessageSquare, Flame, Play, ArrowRight, ChevronRight, Mic, Square, Check, X } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { EmptyState } from '../components/EmptyState'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { api } from '../lib/api'
import { agentChat } from '../lib/agent'
import type { Opportunity } from '../lib/types'

const FOCUS = [
  { id: 'structure', icon: Layers },
  { id: 'specifics', icon: Hash },
  { id: 'delivery', icon: MessageSquare },
  { id: 'pressure', icon: Flame },
]

// 兜底题库：Agent 出题失败时使用
const MOCK_QUESTIONS = [
  '请做一个简短的自我介绍，重点说明你为什么适合这个岗位。',
  '描述一个你主导的项目，你在其中扮演了什么角色，取得了什么成果？',
  '当你和团队成员在方案上有分歧时，你是如何处理的？',
  '你如何衡量一个产品功能的成功？请举例说明。',
  '如果给你三个月时间提升我们产品的用户留存，你会怎么做？',
]

function scoreFromReply(reply: string): number {
  const m = reply.match(/总分\s*[:：]?\s*(\d{1,3})|(\d{1,3})\s*分/)
  if (!m) return 75
  const n = Number(m[1] ?? m[2])
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 75
}

type Phase = 'setup' | 'interview' | 'result'

export function MockScreen() {
  const t = useT()
  const navigate = useNavigate()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loaded, setLoaded] = useState(false)

  const [oppId, setOppId] = useState('')
  const [persona, setPersona] = useState('behavioral')
  const [mode, setMode] = useState('text')
  const [length, setLength] = useState('standard')
  const [focus, setFocus] = useState<string[]>(['structure'])

  const [phase, setPhase] = useState<Phase>('setup')
  const [currentQ, setCurrentQ] = useState(0)
  const [answer, setAnswer] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [feedbackList, setFeedbackList] = useState<Array<{ score: number; comment: string }>>([])
  const [isThinking, setIsThinking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [questions, setQuestions] = useState<string[]>(MOCK_QUESTIONS)
  const convRef = useRef<string | undefined>(undefined)
  const [mockError, setMockError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ data: { items: Opportunity[] } }>('/api/opportunities')
      .then((r) => setOpportunities(r.data.items ?? []))
      .catch(() => setOpportunities([]))
      .finally(() => setLoaded(true))
  }, [])

  const opp = useMemo(
    () => opportunities.find((o) => o.id === oppId) ?? opportunities[0],
    [opportunities, oppId],
  )

  const questionCount = questions.length
  const total = length === 'quick' ? 3 : length === 'standard' ? 5 : questionCount
  const estMin = Math.max(6, total * 3)

  const toggleFocus = (id: string) =>
    setFocus((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? [cur[1], id] : [...cur, id]))

  const startInterview = async () => {
    setPhase('interview')
    setCurrentQ(0)
    setAnswers([])
    setFeedbackList([])
    setAnswer('')
    setMockError(null)
    setQuestions(MOCK_QUESTIONS)
    convRef.current = undefined
    // Agent 面试子图出题（失败时用兜底题库）
    try {
      const resp = await agentChat(`开始模拟面试，目标岗位：${opp?.role ?? '目标岗位'}（${opp?.company ?? ''}），请出第一道面试题并简要说明考察点`, undefined, 'interview')
      convRef.current = resp.conversationId
      setQuestions([resp.reply, ...MOCK_QUESTIONS.slice(1)])
    } catch {
      setMockError('Agent 出题失败，已使用内置题库')
    }
  }

  const submitAnswer = async () => {
    if (!answer.trim() || isThinking) return
    const text = answer.trim()
    setIsThinking(true)
    const newAnswers = [...answers, text]
    setAnswers(newAnswers)
    setAnswer('')
    setMockError(null)
    try {
      // Agent 点评当前回答，并随回复附带下一题
      const fb = await agentChat(text, convRef.current, 'interview')
      convRef.current = fb.conversationId
      const nextMark = fb.reply.indexOf('【下一题】')
      const comment = nextMark >= 0 ? fb.reply.slice(0, nextMark).trim() : fb.reply
      const nextQuestion = nextMark >= 0 ? fb.reply.slice(nextMark).replace(/^【下一题】\s*/, '').trim() : ''
      const score = scoreFromReply(comment)
      const newFeedback = [...feedbackList, { score, comment }]
      setFeedbackList(newFeedback)
      if (nextQuestion && currentQ + 1 < total) {
        setQuestions((prev) => prev.map((q, i) => (i === currentQ + 1 ? nextQuestion : q)))
        setCurrentQ(currentQ + 1)
      } else {
        setPhase('result')
      }
    } catch (e) {
      setMockError('Agent 点评失败：' + (e instanceof Error ? e.message : '未知错误'))
      const fallback = { score: 75, comment: '（Agent 暂不可用）回答已记录，建议补充量化成果与 STAR 结构。' }
      setFeedbackList((prev) => [...prev, fallback])
      if (currentQ + 1 >= total) {
        setPhase('result')
      } else {
        setCurrentQ(currentQ + 1)
      }
    } finally {
      setIsThinking(false)
    }
  }

  const avgScore = feedbackList.length > 0
    ? Math.round(feedbackList.reduce((sum, f) => sum + f.score, 0) / feedbackList.length)
    : 0

  // 与线上一致：尚无岗位/预测题时展示空状态
  if (loaded && !opp) {
    return (
      <div className="page live-setup mock-warm">
        <div className="ls-wrap">
          <EmptyState
            artWebp="/art/empty-interview.webp"
            art="/art/empty-interview.png"
            title={t('mock_no_q')}
            action={
              <Button variant="secondary" onClick={() => navigate('/app/pipeline?add=1')}>
                {t('add_role')}
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  if (phase === 'interview') {
    return (
      <div className="page mock-interview">
        <div className="mock-interview-wrap">
          <div className="mock-interview-head">
            <div className="mock-interview-progress">
              <span className="mock-interview-qn">第 {currentQ + 1} / {total} 题</span>
              <div className="mock-interview-bar">
                <div className="mock-interview-bar-fill" style={{ width: `${((currentQ + 1) / total) * 100}%` }} />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPhase('setup')}>退出</Button>
          </div>

          <div className="mock-interview-question">
            <div className="mock-interview-question-label">面试官提问</div>
            <h2 className="mock-interview-question-text">{questions[currentQ] ?? MOCK_QUESTIONS[currentQ % MOCK_QUESTIONS.length]}</h2>
          </div>

          {feedbackList[currentQ - 1] && (
            <div className="mock-feedback">
              <div className="mock-feedback-h">
                <span>AI 评分反馈</span>
                <span className="mock-feedback-score">{feedbackList[currentQ - 1].score} 分</span>
              </div>
              <p className="mock-feedback-text">{feedbackList[currentQ - 1].comment}</p>
            </div>
          )}
          {mockError && <div className="chat-error">{mockError}</div>}

          <div className="mock-interview-answer">
            <div className="mock-interview-answer-label">你的回答</div>
            <textarea
              className="mock-interview-textarea"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="输入你的回答，或点击麦克风开始语音输入…"
              rows={5}
              disabled={isThinking}
            />
            <div className="mock-interview-actions">
              <Button
                variant={isRecording ? 'danger' : 'secondary'}
                size="sm"
                icon={isRecording ? <Square size={13} /> : <Mic size={13} />}
                onClick={() => setIsRecording(!isRecording)}
              >
                {isRecording ? '停止录音' : '语音输入'}
              </Button>
              <span className="grow" />
              <Button
                variant="primary"
                icon={isThinking ? undefined : <ChevronRight size={15} />}
                onClick={submitAnswer}
                disabled={!answer.trim() || isThinking}
              >
                {isThinking ? 'AI 评分中…' : currentQ + 1 >= total ? '完成面试' : '下一题'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    return (
      <div className="page mock-result">
        <div className="mock-result-wrap">
          <div className="mock-result-card card">
            <div className="mock-result-h">
              <Check size={32} className="mock-result-icon" />
              <h2>面试完成</h2>
              <p className="faint">{opp?.role} · {opp?.company}</p>
            </div>
            <div className="mock-result-score">
              <div className="mock-result-score-num">{avgScore}</div>
              <div className="mock-result-score-label">综合评分</div>
            </div>
            <div className="mock-result-details">
              {feedbackList.map((f, i) => (
                <div key={i} className="mock-result-item">
                  <div className="mock-result-item-h">
                    <span>第 {i + 1} 题</span>
                    <span className={`mock-result-item-score ${f.score >= 80 ? 'is-good' : f.score >= 70 ? 'is-mid' : 'is-low'}`}>
                      {f.score} 分
                    </span>
                  </div>
                  <p className="mock-result-item-comment faint">{f.comment}</p>
                </div>
              ))}
            </div>
            <div className="mock-result-actions">
              <Button variant="primary" onClick={startInterview}>再来一次</Button>
              <Button variant="secondary" onClick={() => setPhase('setup')}>返回设置</Button>
              <Button variant="ghost" onClick={() => navigate('/app/studio')}>优化简历</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page live-setup mock-warm">
      <div className="ls-wrap">
        <div className="mw-flow rise-seq">
          <div className="ls-main">
            <section className="ls-block">
              <h2 className="mw-h">{t('mw_pick')}</h2>
              <Select
                value={opp?.id ?? ''}
                onChange={setOppId}
                ariaLabel={t('mw_pick')}
                options={opportunities.map((o) => ({
                  value: o.id,
                  label: `${o.role} · ${o.company}`,
                }))}
              />
            </section>

            <section className="ls-block">
              <h2 className="mw-h">{t('mw_tune')}</h2>
              <div className="mw-tune">
                <div>
                  <h2 className="mw-h">
                    {t('mw_focus_h')} <span className="mw-h-sub faint">{t('mw_focus_sub')}</span>
                  </h2>
                  <div className="mw-focus">
                    {FOCUS.map((c) => {
                      const Icon = c.icon
                      const on = focus.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          className={`mw-chip ${on ? 'is-on' : ''}`}
                          onClick={() => toggleFocus(c.id)}
                        >
                          <Icon size={15} /> {t(`focus_${c.id}`)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <h2 className="mw-h mw-h-quiet">{t('mw_how')}</h2>
                  <div className="mw-settings">
                    <div className="mw-set">
                      <span className="mw-set-l">{t('mock_persona')}</span>
                      <Select
                        size="sm"
                        value={persona}
                        onChange={setPersona}
                        options={[
                          { value: 'behavioral', label: t('persona_behavioral') },
                          { value: 'technical', label: t('persona_technical') },
                          { value: 'stress', label: t('persona_stress') },
                          { value: 'case', label: t('persona_case') },
                        ]}
                      />
                    </div>
                    <div className="mw-set">
                      <span className="mw-set-l">{t('mock_mode')}</span>
                      <Select
                        size="sm"
                        value={mode}
                        onChange={setMode}
                        options={[
                          { value: 'text', label: t('mode_text') },
                          { value: 'voice', label: t('mode_voice') },
                        ]}
                      />
                    </div>
                    <div className="mw-set">
                      <span className="mw-set-l">{t('mock_length')}</span>
                      <Select
                        size="sm"
                        value={length}
                        onChange={setLength}
                        options={[
                          { value: 'quick', label: t('len_quick') },
                          { value: 'standard', label: t('len_standard') },
                          { value: 'full', label: t('len_full') },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mw-go">
          <div className="mw-go-meta">
            <span className="mw-go-len">{t('mw_sum_len', { n: total, min: estMin })}</span>
            <span className="mw-go-sub faint">{t('mw_report_promise')}</span>
          </div>
          <Button
            variant="primary"
            size="lg"
            icon={<Play size={17} />}
            onClick={startInterview}
          >
            {t('mw_start')}
          </Button>
        </div>
      </div>
    </div>
  )
}
