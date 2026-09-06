import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Hash, MessageSquare, Flame, Play, ArrowRight, ChevronRight, Mic, Square, Check, X } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { EmptyState } from '../components/EmptyState'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { api } from '../lib/api'
import type { Opportunity } from '../lib/types'

const FOCUS = [
  { id: 'structure', icon: Layers },
  { id: 'specifics', icon: Hash },
  { id: 'delivery', icon: MessageSquare },
  { id: 'pressure', icon: Flame },
]

const MOCK_QUESTIONS = [
  '请做一个简短的自我介绍，重点说明你为什么适合这个岗位。',
  '描述一个你主导的项目，你在其中扮演了什么角色，取得了什么成果？',
  '当你和团队成员在方案上有分歧时，你是如何处理的？',
  '你如何衡量一个产品功能的成功？请举例说明。',
  '如果给你三个月时间提升我们产品的用户留存，你会怎么做？',
]

const MOCK_FEEDBACK = [
  { score: 82, comment: '回答结构清晰，STAR 框架运用得当。建议在成果部分增加更多量化数据。' },
  { score: 75, comment: '项目描述完整，但对个人贡献的突出不够。建议更明确地说明你做了什么决策。' },
  { score: 88, comment: '冲突处理案例很好，体现了沟通和协调能力。可以补充最终结果的长期影响。' },
  { score: 70, comment: '指标选择合理，但案例不够具体。建议准备一个完整的数据驱动决策案例。' },
  { score: 85, comment: '思路清晰，优先级合理。建议增加对风险和资源约束的考虑。' },
]

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

  useEffect(() => {
    api
      .get<{ items: Opportunity[] }>('/api/opportunities')
      .then((r) => setOpportunities(r.items ?? []))
      .catch(() => setOpportunities([]))
      .finally(() => setLoaded(true))
  }, [])

  const opp = useMemo(
    () => opportunities.find((o) => o.id === oppId) ?? opportunities[0],
    [opportunities, oppId],
  )

  const questionCount = MOCK_QUESTIONS.length
  const total = length === 'quick' ? 3 : length === 'standard' ? 5 : questionCount
  const estMin = Math.max(6, total * 3)

  const toggleFocus = (id: string) =>
    setFocus((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? [cur[1], id] : [...cur, id]))

  const startInterview = () => {
    setPhase('interview')
    setCurrentQ(0)
    setAnswers([])
    setFeedbackList([])
    setAnswer('')
  }

  const submitAnswer = () => {
    if (!answer.trim()) return
    setIsThinking(true)
    const newAnswers = [...answers, answer]
    setAnswers(newAnswers)

    setTimeout(() => {
      const fb = MOCK_FEEDBACK[currentQ % MOCK_FEEDBACK.length]
      const newFeedback = [...feedbackList, fb]
      setFeedbackList(newFeedback)
      setIsThinking(false)

      if (currentQ + 1 >= total) {
        setPhase('result')
      } else {
        setCurrentQ(currentQ + 1)
        setAnswer('')
      }
    }, 1200)
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
            <h2 className="mock-interview-question-text">{MOCK_QUESTIONS[currentQ % MOCK_QUESTIONS.length]}</h2>
          </div>

          {feedbackList[currentQ] && (
            <div className="mock-feedback">
              <div className="mock-feedback-h">
                <span>AI 评分反馈</span>
                <span className="mock-feedback-score">{feedbackList[currentQ].score} 分</span>
              </div>
              <p className="mock-feedback-text">{feedbackList[currentQ].comment}</p>
            </div>
          )}

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
