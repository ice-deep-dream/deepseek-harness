/**
 * Design-center data controller: owns the snapshot store and mediates all
 * host RPC calls (load / writeSpec / writePlan / render). The view layer
 * subscribes via the store and triggers mutations through these methods.
 */
import type { ClientConnectionRpc, RpcResult } from '@deepseek-ai/dsh-client-connection/client'
import { createSnapshotStore, type SessionId, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  DesignBoard, DesignRenderOutcome, DesignResult,
} from '../../contract.ts'

const CHANNEL = '/design-center'

type Status = 'idle' | 'loading' | 'ready' | 'error' | 'rendering'

export interface DesignCenterState {
  status: Status
  board: DesignBoard | null
  error: string | null
  renderOutput: DesignRenderOutcome | null
  generation: number
  /** Dirty spec id -> edited text, for the inline editor. */
  drafts: Record<string, string>
  /** Dirty plan text, when the plan tab is in edit mode. */
  planDraft: string | null
}

function initialState(): DesignCenterState {
  return {
    status: 'idle',
    board: null,
    error: null,
    renderOutput: null,
    generation: 0,
    drafts: {},
    planDraft: null,
  }
}

function asDesignResult<T>(result: RpcResult<unknown>): DesignResult<T> {
  return result as DesignResult<T>
}

export class DesignCenterController {
  readonly store: SnapshotStore<DesignCenterState>
  private generation = 0

  constructor(private readonly rpc: ClientConnectionRpc) {
    this.store = createSnapshotStore<DesignCenterState>(initialState(), { flush: 'raf' })
  }

  private async call<T>(endpoint: string, args: Record<string, unknown>): Promise<DesignResult<T>> {
    const result = await this.rpc.call(CHANNEL, endpoint, { args })
    return asDesignResult<T>(result)
  }

  async load(sessionId: SessionId, force = false): Promise<void> {
    const generation = ++this.generation
    if (!force) {
      this.store.update((d) => { d.status = 'loading'; d.error = null })
    }
    try {
      const result = await this.call<DesignBoard>('load', { sessionId })
      if (generation !== this.generation) return
      if (!result.ok) {
        this.store.update((d) => { d.status = 'error'; d.error = result.error.message })
        return
      }
      this.store.update((d) => {
        d.status = 'ready'
        d.board = result.value
        d.error = null
        d.drafts = {}
        d.planDraft = null
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((d) => { d.status = 'error'; d.error = error instanceof Error ? error.message : String(error) })
    }
  }

  updateDraft(id: string, text: string): void {
    this.store.update((d) => { d.drafts = { ...d.drafts, [id]: text } })
  }

  clearDraft(id: string): void {
    this.store.update((d) => {
      const { [id]: _removed, ...rest } = d.drafts
      d.drafts = rest
    })
  }

  async saveSpec(sessionId: SessionId, id: string): Promise<boolean> {
    const text = this.store.getSnapshot().drafts[id]
    if (text === undefined) return false
    try {
      const result = await this.call<{ written: true }>('writeSpec', { sessionId, id, text })
      if (!result.ok) {
        this.store.update((d) => { d.error = result.error.message })
        return false
      }
      this.clearDraft(id)
      return true
    } catch (error) {
      this.store.update((d) => { d.error = error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  updatePlanDraft(text: string): void {
    this.store.update((d) => { d.planDraft = text })
  }

  clearPlanDraft(): void {
    this.store.update((d) => { d.planDraft = null })
  }

  async savePlan(sessionId: SessionId): Promise<boolean> {
    const text = this.store.getSnapshot().planDraft
    if (text === null) return false
    try {
      const result = await this.call<{ written: true }>('writePlan', { sessionId, text })
      if (!result.ok) {
        this.store.update((d) => { d.error = result.error.message })
        return false
      }
      this.clearPlanDraft()
      return true
    } catch (error) {
      this.store.update((d) => { d.error = error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  async render(sessionId: SessionId, targets?: readonly string[]): Promise<DesignResult<DesignRenderOutcome>> {
    const generation = ++this.generation
    this.store.update((d) => { d.status = 'rendering'; d.error = null; d.renderOutput = null })
    let result: DesignResult<DesignRenderOutcome>
    try {
      result = await this.call<DesignRenderOutcome>('render', { sessionId, targets })
    } catch (error) {
      if (generation !== this.generation) return { ok: false, error: { code: 'internal', message: String(error), details: {} } }
      const message = error instanceof Error ? error.message : String(error)
      this.store.update((d) => { d.status = 'ready'; d.error = message })
      return { ok: false, error: { code: 'internal', message, details: {} } }
    }
    if (generation !== this.generation) return result
    this.store.update((d) => {
      d.status = 'ready'
      d.renderOutput = result.ok ? result.value : null
      if (!result.ok) d.error = result.error.message
      else if (result.value.exitCode !== 0) d.error = result.value.stderr || 'render command exited non-zero'
    })
    await this.load(sessionId, true)
    return result
  }
}
