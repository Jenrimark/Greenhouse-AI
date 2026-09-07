import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowUp, PenLine, Target, ListChecks, ChevronRight, Paperclip, FileText, Sparkles, History } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { useAppData } from '../shell/AppData'
import { agentChat, listConversations, getConversationMessages, type ConversationItem, type HistoryMessage, type AgentChatResp } from '../lib/agent'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  trace?: AgentChatResp['traceSummary']
  intent?: string
}

function greetingKey(hour: number) {
  const part = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return `greeting_${part}_anon`
}

function todayZh() {
  const d = new Date()
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${'日一二三四五六'[d.getDay()]}`
}

export function AssistantScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { me } = useAppData()
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [traceOpen, setTraceOpen] = useState('')
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

  // 会话列表加载
  const loadConversations = useCallback(async () => {
    try {
      const list = await listConversations()
      setConversations(list)
    } catch {
      setConversations([])
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // 切换会话：加载历史消息
  const switchConversation = async (conv: ConversationItem) => {
    setShowHistory(false)
    setConversationId(conv.id)
    setChatError(null)
    try {
      const items = await getConversationMessages(conv.id)
      setMessages(
        items
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m: HistoryMessage) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content ?? '',
            timestamp: new Date(m.createdAt),
          })),
      )
    } catch {
      setMessages([])
    }
  }

  const newChat = () => {
    setShowHistory(false)
    setConversationId(undefined)
    setMessages([])
    setChatError(null)
  }

  const sendMessage = async () => {
    if (!ready || isTyping) return
    const text = value.trim()
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setValue('')
    setIsTyping(true)
    setShowAttach(false)
    setChatError(null)

    try {
      const resp = await agentChat(text, conversationId)
      setConversationId(resp.conversationId)
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: resp.reply,
        timestamp: new Date(),
        trace: resp.traceSummary,
        intent: resp.intent,
      }
      setMessages((prev) => [...prev, aiMsg])
      loadConversations()
    } catch (e) {
      setChatError(e instanceof Error ? e.message : '对话失败，请稍后重试')
    } finally {
      setIsTyping(false)
    }
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
                    <div className="chat-msg-name">
                      {msg.role === 'user' ? me?.name ?? '我' : 'Greenroom AI'}
                      {msg.role === 'assistant' && (
                        <span className="chat-trace-toggle" onClick={() => msg.trace && setTraceOpen(msg.trace.runId === traceOpen ? '' : msg.trace!.runId)}>
                          <span className="chat-trace-dot" /> Agent 轨迹
                        </span>
                      )}
                    </div>
                    <div className="chat-msg-content">{msg.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}</div>
                    {msg.role === 'assistant' && msg.trace && traceOpen === msg.trace.runId && (
                      <div className="chat-trace">
                        <div className="chat-trace-row">
                          <span className="chat-trace-label">意图</span>
                          <span className="chat-trace-val">{msg.intent ?? 'qa'}</span>
                        </div>
                        <div className="chat-trace-row">
                          <span className="chat-trace-label">步骤</span>
                          <span className="chat-trace-val">{msg.trace.steps.join(' → ')}</span>
                        </div>
                        <div className="chat-trace-row">
                          <span className="chat-trace-label">耗时</span>
                          <span className="chat-trace-val">{msg.trace.durationMs} ms</span>
                        </div>
                      </div>
                    )}
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
              {showHistory && (
                <div className="chat-history">
                  <div className="chat-history-head">
                    <span>历史会话</span>
                    <button type="button" onClick={newChat} className="chat-history-new">+ 新对话</button>
                  </div>
                  {conversations.length === 0 && <div className="chat-history-empty">暂无历史会话</div>}
                  {conversations.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className={`chat-history-item ${conversationId === c.id ? 'is-active' : ''}`}
                      onClick={() => switchConversation(c)}
                    >
                      <span className="chat-history-title truncate">{c.title || '未命名会话'}</span>
                      <span className="chat-history-time">
                        {new Date(c.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {chatError && <div className="chat-error">{chatError}</div>}
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
                    aria-label="历史会话"
                    title="历史会话"
                    onClick={() => setShowHistory((v) => !v)}
                  >
                    <History size={18} />
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
