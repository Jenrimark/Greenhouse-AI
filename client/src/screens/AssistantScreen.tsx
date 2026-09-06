import { useMemo, useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowUp, PenLine, Target, ListChecks, ChevronRight, Paperclip, FileText, Sparkles } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { useAppData } from '../shell/AppData'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

function greetingKey(hour: number) {
  const part = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return `greeting_${part}_anon`
}

function todayZh() {
  const d = new Date()
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${'日一二三四五六'[d.getDay()]}`
}

// Mock AI 回复生成
function mockAIReply(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('简历') || lower.includes('resume')) {
    return '好的，我来帮你优化简历。建议你先在「简历工作室」中选择一个目标岗位，我会根据岗位要求帮你提炼项目经历和技能关键词。你目前最想投递哪类岗位？'
  }
  if (lower.includes('面试') || lower.includes('interview')) {
    return '面试准备建议：1）先在「岗位地图」中查看目标岗位的面试重点和高频问题；2）在「模拟面试」中进行实战演练；3）用「实时助手」在真实面试中获得提词提示。需要我针对某个具体岗位生成准备计划吗？'
  }
  if (lower.includes('岗位') || lower.includes('job') || lower.includes('工作')) {
    return '找岗位的话，你可以在「找岗位」页面按关键词、城市、经验、薪资筛选。我也可以帮你分析当前市场趋势。你对哪个行业或职能方向感兴趣？'
  }
  if (lower.includes('你好') || lower.includes('hi') || lower.includes('hello')) {
    return '你好！我是 Greenroom AI 求职助手。我可以帮你：优化简历、准备面试、分析岗位、制定求职计划。有什么我可以帮你的？'
  }
  return `收到你的问题：「${input}」。\n\n作为你的 AI 求职助手，我建议从以下几个方面入手：\n1. 明确目标岗位和行业\n2. 梳理相关经历和技能\n3. 针对性优化简历和面试准备\n\n需要我深入分析某个具体方面吗？你也可以点击下方的快捷建议开始。`
}

export function AssistantScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { me } = useAppData()
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const hour = new Date().getHours()
  const greeting = t(greetingKey(hour))

  const suggestions = useMemo(
    () => [
      { key: 'home_sug_resume', icon: PenLine, to: '/app/studio', primary: true, arrow: true },
      { key: 'home_sug_jd', icon: Target, to: '/app/discover', primary: true, arrow: true },
      { key: 'home_sug_look', icon: ListChecks, to: '/app/pipeline', primary: false, arrow: false },
    ],
    [],
  )

  const autoSize = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const ready = value.trim().length > 0

  const sendMessage = () => {
    if (!ready || isTyping) return
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: value.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setValue('')
    setIsTyping(true)
    setShowAttach(false)

    // Mock AI 回复延迟
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: mockAIReply(userMsg.content),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)
    }, 800 + Math.random() * 600)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const hasChat = messages.length > 0

  return (
    <div className="home">
      <div className={`home-wrap ${hasChat ? 'home-chat' : 'home-center'}`}>
        {!hasChat ? (
          <>
            <div className="hw">
              <h1 className="hw-h">{greeting}</h1>
              <p className="hw-sub">
                <span>{todayZh()}</span>
              </p>
            </div>

            <div className="home-composer">
              <div className="home-composer-top">
                <textarea
                  ref={taRef}
                  className="hc-input"
                  rows={1}
                  placeholder={t('home_composer_ph')}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    autoSize()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                />
              </div>
              <div className="home-composer-bar">
                <div style={{ position: 'relative' }}>
                  <button
                    className="hc-plus"
                    type="button"
                    aria-label={t('hc_attach')}
                    title={t('hc_attach')}
                    onClick={() => setShowAttach(!showAttach)}
                  >
                    <Plus size={18} />
                  </button>
                  {showAttach && (
                    <div className="hc-attach-menu">
                      <button className="hc-attach-item" onClick={() => { setShowAttach(false); setValue((v) => v + '请帮我优化这份简历：') }}>
                        <FileText size={15} /> 粘贴简历文本
                      </button>
                      <button className="hc-attach-item" onClick={() => { setShowAttach(false); navigate('/app/studio') }}>
                        <PenLine size={15} /> 从简历工作室选择
                      </button>
                      <button className="hc-attach-item" onClick={() => { setShowAttach(false); setValue((v) => v + '请帮我分析这个岗位：') }}>
                        <Target size={15} /> 粘贴岗位描述
                      </button>
                    </div>
                  )}
                </div>
                <span className="grow" />
                <button
                  className={`hc-run ${ready ? 'is-ready' : ''}`}
                  type="button"
                  disabled={!ready}
                  aria-label={t('ask_greenroom')}
                  onClick={sendMessage}
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>

            <ul className="hw-sugs is-track" aria-label={t('ai_suggestions')}>
              {suggestions.map((s) => {
                const Icon = s.icon
                return (
                  <li className="hw-sug-item" key={s.key}>
                    <button
                      type="button"
                      className={`hw-sug ${s.primary ? 'is-primary' : ''}`}
                      onClick={() => navigate(s.to)}
                    >
                      <span className="hw-sug-ico" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <span className="hw-sug-copy">
                        <span className="hw-sug-title truncate">{t(s.key)}</span>
                      </span>
                      {s.arrow && <ChevronRight size={14} className="hw-sug-arrow" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <div className="chat-container">
            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`chat-msg ${msg.role === 'user' ? 'is-user' : 'is-ai'}`}>
                  <div className="chat-msg-avatar">
                    {msg.role === 'user' ? (
                      <span className="chat-avatar-user">{me?.name?.[0] ?? 'U'}</span>
                    ) : (
                      <Sparkles size={16} className="chat-avatar-ai" />
                    )}
                  </div>
                  <div className="chat-msg-body">
                    <div className="chat-msg-name">{msg.role === 'user' ? me?.name ?? '我' : 'Greenroom AI'}</div>
                    <div className="chat-msg-content">{msg.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}</div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="chat-msg is-ai">
                  <div className="chat-msg-avatar">
                    <Sparkles size={16} className="chat-avatar-ai" />
                  </div>
                  <div className="chat-msg-body">
                    <div className="chat-msg-name">Greenroom AI</div>
                    <div className="chat-typing">
                      <span /> <span /> <span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-composer-wrap">
              <div className="home-composer chat-composer">
                <div className="home-composer-top">
                  <textarea
                    ref={taRef}
                    className="hc-input"
                    rows={1}
                    placeholder={t('home_composer_ph')}
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value)
                      autoSize()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                  />
                </div>
                <div className="home-composer-bar">
                  <button
                    className="hc-plus"
                    type="button"
                    aria-label={t('hc_attach')}
                    title={t('hc_attach')}
                    onClick={() => setShowAttach(!showAttach)}
                  >
                    <Plus size={18} />
                  </button>
                  <span className="grow" />
                  <button
                    className={`hc-run ${ready ? 'is-ready' : ''}`}
                    type="button"
                    disabled={!ready || isTyping}
                    aria-label={t('ask_greenroom')}
                    onClick={sendMessage}
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
