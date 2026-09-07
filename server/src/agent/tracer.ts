// A9 可观测：LangGraph run 采集器（每节点/LLM 调用 → agent_traces）
// 通过 config.callbacks 注入图执行；runId 贯穿全链路
import { BaseTracer, type Run } from '@langchain/core/tracers/base'

export interface TraceLlmUsage {
  provider?: string
  model?: string
  promptTokens?: number
  completionTokens?: number
}

export interface TraceNodeRecord {
  runId: string
  name: string
  runType: 'chain' | 'llm' | 'tool' | 'retriever' | string
  inputs?: unknown
  outputs?: unknown
  durationMs?: number
  error?: string
  usage?: TraceLlmUsage
}

/** 挂到 graph.invoke 的 callbacks：收集 chain（节点）与 llm 调用轨迹 */
export class GreenhouseTracer extends BaseTracer {
  records: TraceNodeRecord[] = []

  get name(): string {
    return 'greenhouse-tracer'
  }

  /** BaseTracer 抽象实现：本地收集，无需持久化 */
  async persistRun(): Promise<void> {
    /* no-op */
  }

  onRunCreate(run: Run) {
    if (run.run_type === 'chain' || run.run_type === 'llm' || run.run_type === 'tool') {
      this.records.push({
        runId: run.id,
        name: run.name,
        runType: run.run_type,
        inputs: this.trim(run.inputs),
      })
    }
  }

  onRunUpdate(run: Run) {
    const rec = this.records.find((r) => r.runId === run.id)
    if (!rec) return
    rec.outputs = this.trim(run.outputs)
    if (run.end_time && run.start_time) {
      rec.durationMs = Math.max(0, Math.round(run.end_time - run.start_time))
    }
    if (run.error) rec.error = String(run.error).slice(0, 300)
    // LLM token 用量（OpenAI 兼容格式）
    if (run.run_type === 'llm') {
      const llmOutput = run.outputs?.llmOutput as
        | { tokenUsage?: { promptTokens?: number; completionTokens?: number }; model?: string }
        | undefined
      rec.usage = {
        provider: typeof run.name === 'string' ? undefined : undefined,
        model: llmOutput?.model,
        promptTokens: llmOutput?.tokenUsage?.promptTokens,
        completionTokens: llmOutput?.tokenUsage?.completionTokens,
      }
    }
  }

  private trim(v: unknown): unknown {
    const s = JSON.stringify(v)
    if (!s) return v
    return s.length > 3000 ? s.slice(0, 3000) + '…' : v
  }
}
