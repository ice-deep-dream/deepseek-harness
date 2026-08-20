import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Button, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { DesignCenterController } from './data/controller.ts'
import type { NS as DesignCenterNS } from './locales.ts'
import type { DesignDiagram, DesignPlanModule } from '../contract.ts'
import styles from './DesignCenterView.module.css'

type DesignCenterInjected = { readonly controller: DesignCenterController }
type SubTab = 'architecture' | 'modules' | 'flows' | 'plan'

export type DesignCenterViewProps =
  & ConvViewProps
  & InjectFace<DesignCenterInjected>
  & PropsLocale<typeof DesignCenterNS>

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function pad2(n: number): string { return n < 10 ? '0' + n : String(n) }

function formatDateTime(value: string | undefined | null): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d{4}[-/.]\d{2}[-/.]\d{2}[ T]\d{1,2}:\d{2}/.test(trimmed)) {
    const m = trimmed.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})[ T](\d{1,2}):(\d{2})/)
    if (m) return `${m[1]}-${m[2]}-${m[3]} ${pad2(Number(m[4]))}:${m[5]}`
  }
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())} ${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`
  }
  return trimmed
}

function diagramType(d: DesignDiagram): string {
  return d.meta?.type ?? 'unknown'
}

function findByType(diagrams: readonly DesignDiagram[], type: 'architecture' | 'modules'): DesignDiagram | undefined {
  return diagrams.find(d => diagramType(d) === type)
}

function findFlows(diagrams: readonly DesignDiagram[]): DesignDiagram[] {
  return diagrams.filter(d => diagramType(d) === 'flow')
}

const STATUS_LABEL: Record<string, string> = {
  planned: '待开发',
  in_progress: '进行中',
  done: '已完成',
}
const STATUS_CLASS: Record<string, string> = {
  planned: 'stPlanned',
  in_progress: 'stProgress',
  done: 'stDone',
}

function statusLabel(s: string | undefined): string {
  if (!s) return ''
  return STATUS_LABEL[s] ?? s
}
function statusClass(s: string | undefined): string {
  if (!s) return styles.stPlanned ?? ''
  const key = STATUS_CLASS[s]
  if (key === 'stPlanned') return styles.stPlanned ?? ''
  if (key === 'stProgress') return styles.stProgress ?? ''
  if (key === 'stDone') return styles.stDone ?? ''
  return styles.stPlanned ?? ''
}

function DiagramVersionFooter(props: { diagram: DesignDiagram }): React.ReactElement {
  const { diagram } = props
  const m = diagram.meta
  return (
    <div className={styles.versionFooter}>
      <div className={styles.versionLines}>
        <span className={styles.ver}>v{m?.version ?? '1.0.0'}</span>
        {m?.updatedAt ? <span className={styles.verDate}>更新于 {formatDateTime(m.updatedAt)}</span> : null}
        {m?.status && m.status !== 'stable' ? (
          <span className={`${styles.verStatus} ${statusClass(m.status)}`}>{m.status}</span>
        ) : null}
      </div>
      {m?.changes ? <p className={styles.changes}>{m.changes}</p> : null}
    </div>
  )
}

function DiagramCard(props: {
  diagram: DesignDiagram
  draft: string | undefined
  onEdit: (text: string) => void
}): React.ReactElement {
  const { diagram, draft, onEdit } = props
  const title = diagram.title || diagram.id
  const editing = draft !== undefined
  const svgMissing = diagram.svg === null

  return (
    <div className={styles.diagramCard}>
      {editing ? (
        <textarea
          className={styles.editor}
          value={draft}
          onChange={e => onEdit(e.target.value)}
          spellCheck={false}
        />
      ) : diagram.svg ? (
        <div className={styles.svgWrap}>
          <img className={styles.svgImg} src={svgDataUrl(diagram.svg)} alt={title} />
        </div>
      ) : (
        <pre className={styles.renderLog}>{diagram.specText || '(empty spec)'}</pre>
      )}
      {svgMissing && !editing ? (
        <div className={styles.svgMissingHint}>未找到渲染后的 SVG（点击重新渲染）</div>
      ) : null}
      {!editing ? <DiagramVersionFooter diagram={diagram} /> : null}
    </div>
  )
}

function FlowList(props: {
  flows: readonly DesignDiagram[]
  selectedId: string
  onSelect: (id: string) => void
}): React.ReactElement {
  const { flows, selectedId, onSelect } = props
  return (
    <aside className={styles.flowSide}>
      <div className={styles.flowSideHead}>业务流程（{flows.length}）</div>
      <div className={styles.flowSideList}>
        {flows.map((f) => {
          const active = f.id === selectedId
          return (
            <button
              key={f.id}
              type="button"
              className={`${styles.flowItem} ${active ? styles.flowItemActive : ''}`}
              onClick={() => onSelect(f.id)}
            >
              <span className={styles.flowItemTitle}>{f.title || f.id}</span>
              <span className={styles.flowItemMeta}>
                <span>v{f.meta?.version ?? '1.0.0'}</span>
                {f.meta?.updatedAt ? <span>{formatDateTime(f.meta.updatedAt)}</span> : null}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function moduleProgress(m: DesignPlanModule): number {
  if (typeof m.progress === 'number' && Number.isFinite(m.progress)) {
    return Math.max(0, Math.min(100, Math.round(m.progress)))
  }
  const tasks = m.tasks
  if (tasks && tasks.length > 0) {
    const done = tasks.filter(t => t.done).length
    return Math.round((done * 100) / tasks.length)
  }
  return 0
}

function PlanSideItem(props: {
  m: DesignPlanModule
  active: boolean
  isLatest: boolean
  onClick: () => void
}): React.ReactElement {
  const { m, active, isLatest, onClick } = props
  const pct = moduleProgress(m)
  const prio = (m.priority ?? '').toUpperCase()
  return (
    <button
      type="button"
      className={`${styles.planItem} ${active ? styles.planItemActive : ''}`}
      onClick={onClick}
    >
      <span className={styles.planItemTitle}>{m.name ?? m.id ?? '(未命名)'}</span>
      <span className={styles.planItemMeta}>
        <span className={`${styles.planDot} ${statusClass(m.status)}`} />
        <span>{statusLabel(m.status) || '—'}</span>
        {prio ? <span className={`${styles.prioPill} ${styles['prio' + prio]}`}>{prio}</span> : null}
        {isLatest ? <span className={styles.latestBadge}>最新</span> : null}
      </span>
      <span className={styles.planItemProgress}>
        <span className={styles.miniBar}><span className={styles.miniFill} style={{ width: pct + '%' }} /></span>
        <span className={styles.miniPct}>{pct}%</span>
      </span>
    </button>
  )
}

function PlanDetail(props: {
  m: DesignPlanModule
  isLatest: boolean
  diagramById: (id: string) => DesignDiagram | undefined
  onJumpDiagram: (id: string) => void
}): React.ReactElement {
  const { m, isLatest, diagramById, onJumpDiagram } = props
  const pct = moduleProgress(m)
  const tasks = m.tasks ?? []
  const doneTasks = tasks.filter(t => t.done).length

  const refs: React.ReactElement[] = []
  const arch = m.archRef ? diagramById(m.archRef) : undefined
  if (arch) {
    refs.push(
      <button key="arch" type="button" className={`${styles.refChip} ${styles.refChipArch}`} onClick={() => onJumpDiagram(arch.id)}>
        架构图{arch.meta?.version ? ` · v${arch.meta.version}` : ''}
      </button>,
    )
  }
  const mods = m.modulesRef ? diagramById(m.modulesRef) : undefined
  if (mods) {
    refs.push(
      <button key="mods" type="button" className={`${styles.refChip} ${styles.refChipMod}`} onClick={() => onJumpDiagram(mods.id)}>
        模块图{mods.meta?.version ? ` · v${mods.meta.version}` : ''}
      </button>,
    )
  }
  for (const fid of m.flows ?? []) {
    const fl = diagramById(fid)
    refs.push(
      <button
        key={'f:' + fid}
        type="button"
        className={`${styles.refChip} ${styles.refChipFlow}`}
        onClick={() => onJumpDiagram(fid)}
      >
        流程 · {fl ? fl.title || fl.id : fid}{fl?.meta?.version ? ` · v${fl.meta.version}` : ''}
      </button>,
    )
  }

  return (
    <div className={styles.planDetail}>
      <div className={styles.planDetailHead}>
        <h3>{m.name ?? m.id ?? '(未命名)'}</h3>
        <div className={styles.planBadges}>
          <span className={`${styles.badge} ${statusClass(m.status)}`}>{statusLabel(m.status) || '待开发'}</span>
          {isLatest ? <span className={styles.badgeLatest}>最新</span> : null}
        </div>
      </div>

      {m.summary ? <p className={styles.planSummary}>{m.summary}</p> : null}

      <div className={styles.planLines}>
        {m.priority ? <span className={styles.prioTag}>{m.priority}</span> : null}
        {m.updatedAt ? <span>更新于 {formatDateTime(m.updatedAt)}</span> : null}
        {m.owner ? <span>负责人：{m.owner}</span> : null}
        {m.planDoc ? <span className={styles.planDocHint} title={m.planDoc}>明细计划待补</span> : null}
      </div>

      <div className={styles.progressRow}>
        <div className={styles.progressBar}>
          <span className={`${styles.progressFill} ${statusClass(m.status)}`} style={{ width: pct + '%' }} />
        </div>
        <span className={styles.progressPct}>{pct}%</span>
      </div>

      <div className={styles.planBlock}>
        <h4>关联图（架构 / 模块 / 流程对齐）</h4>
        <div className={styles.refChips}>
          {refs.length > 0 ? refs : <span className={styles.muted}>无</span>}
        </div>
      </div>

      {tasks.length > 0 ? (
        <div className={styles.planBlock}>
          <h4>任务清单（{doneTasks}/{tasks.length}）</h4>
          <ul className={styles.tasks}>
            {tasks.map((t, i) => (
              <li key={i} className={t.done ? styles.taskDone : ''}>
                <span className={styles.tick}>{t.done ? '✓' : '○'}</span>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function DesignCenterView(props: DesignCenterViewProps): React.ReactElement {
  const { controller, sessionId, useSessions, t } = props
  const cwd = useSessions(list => list.byId[sessionId]?.cwd)
  const state = useSyncExternalStore(
    controller.store.subscribe,
    () => controller.store.getSnapshot(),
    () => controller.store.getSnapshot(),
  )

  const [subTab, setSubTab] = useState<SubTab>('architecture')
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null)
  const [selectedModule, setSelectedModule] = useState<number>(0)
  const [editingPlan, setEditingPlan] = useState(false)

  useEffect(() => {
    if (cwd) void controller.load(sessionId as SessionId)
  }, [controller, sessionId, cwd])

  const board = state.board
  const busy = state.status === 'loading' || state.status === 'rendering'

  const subTabs: ReadonlyArray<{ id: SubTab; label: string }> = useMemo(() => [
    { id: 'architecture', label: t('tab.architecture') },
    { id: 'modules', label: t('tab.modules') },
    { id: 'flows', label: t('tab.flows') },
    { id: 'plan', label: t('tab.plan') },
  ], [t])

  const flows = useMemo(() => board ? findFlows(board.diagrams) : [], [board])
  const architecture = useMemo(() => board ? findByType(board.diagrams, 'architecture') : undefined, [board])
  const modules = useMemo(() => board ? findByType(board.diagrams, 'modules') : undefined, [board])

  useEffect(() => {
    if (flows.length === 0) { setSelectedFlow(null); return }
    if (!selectedFlow || !flows.some(f => f.id === selectedFlow)) {
      const first = flows[0]; if (first) setSelectedFlow(first.id)
    }
  }, [flows, selectedFlow])

  const planModules = board?.plan?.modules ?? []
  useEffect(() => {
    if (selectedModule >= planModules.length) setSelectedModule(0)
  }, [planModules.length, selectedModule])

  const latestModuleDate = useMemo(() => {
    let max: string | null = null
    for (const m of planModules) {
      const d = m.updatedAt
      if (d && (!max || d > max)) max = d
    }
    return max
  }, [planModules])

  const diagramById = (id: string): DesignDiagram | undefined =>
    board?.diagrams.find(d => d.id === id)

  const jumpToDiagram = (id: string): void => {
    if (!board) return
    const d = board.diagrams.find(x => x.id === id)
    if (!d) return
    const ty = diagramType(d)
    if (ty === 'architecture') setSubTab('architecture')
    else if (ty === 'modules') setSubTab('modules')
    else if (ty === 'flow') {
      setSelectedFlow(d.id)
      setSubTab('flows')
    }
  }

  if (!cwd) {
    return (
      <div className={styles.designCenter}>
        <div className={[styles.statusBanner, styles.statusInfo].filter(Boolean).join(' ')}>{t('status.noCwd')}</div>
      </div>
    )
  }

  const renderButton = (
    <Button
      size="sm"
      variant="primary"
      disabled={busy || !board}
      onClick={() => void controller.render(sessionId as SessionId)}
    >
      {state.status === 'rendering' ? t('status.rendering') : t('toolbar.render')}
    </Button>
  )

  const activeFlow = selectedFlow ? flows.find(f => f.id === selectedFlow) : undefined

  const activeDiagram = subTab === 'architecture'
    ? architecture
    : subTab === 'modules'
      ? modules
      : subTab === 'flows'
        ? activeFlow
        : undefined
  const activeDraft = activeDiagram ? state.drafts[activeDiagram.id] : undefined
  const activeTitle = activeDiagram?.title || activeDiagram?.id || ''
  const saveDiagram = (d: DesignDiagram) => {
    void controller.saveSpec(sessionId as SessionId, d.id).then((ok) => {
      if (ok) return controller.load(sessionId as SessionId, true)
    })
  }
  const savePlan = () => {
    void controller.savePlan(sessionId as SessionId).then((ok) => {
      if (ok) {
        setEditingPlan(false)
        return controller.load(sessionId as SessionId, true)
      }
    })
  }

  return (
    <div className={styles.designCenter}>
      <div className={styles.header}>
        <div className={styles.tabBar}>
          {subTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={[styles.tabButton, tab.id === subTab && styles.tabButtonActive].filter(Boolean).join(' ')}
              onClick={() => setSubTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.headerTitle}>
          {activeDiagram ? (
            <>
              <span className={styles.diagramTitle}>{activeTitle}</span>
              {activeDraft === undefined ? (
                <Button size="sm" variant="ghost" onClick={() => controller.updateDraft(activeDiagram.id, activeDiagram.specText)}>
                  {t('toolbar.edit')}
                </Button>
              ) : (
                <div className={styles.editorActions}>
                  <Button size="sm" variant="primary" onClick={() => saveDiagram(activeDiagram)}>{t('toolbar.save')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => controller.clearDraft(activeDiagram.id)}>{t('toolbar.cancel')}</Button>
                </div>
              )}
            </>
          ) : subTab === 'plan' && board?.plan ? (
            <>
              <span className={styles.planHeadTitle}>
                开发计划 · v{board.plan.version ?? '1.0.0'}
                {board.plan.updatedAt ? ` · 更新于 ${formatDateTime(board.plan.updatedAt)}` : ''}
              </span>
              {!editingPlan ? (
                <Button size="sm" variant="ghost" onClick={() => { controller.updatePlanDraft(board.plan?.text ?? ''); setEditingPlan(true) }}>
                  {t('toolbar.edit')}
                </Button>
              ) : (
                <div className={styles.editorActions}>
                  <Button size="sm" variant="primary" onClick={savePlan}>{t('toolbar.save')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { controller.clearPlanDraft(); setEditingPlan(false) }}>{t('toolbar.cancel')}</Button>
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className={styles.headerActions}>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void controller.load(sessionId as SessionId, true)}>
            {t('toolbar.refresh')}
          </Button>
          {renderButton}
        </div>
      </div>

      <div className={styles.content}>
        {state.error ? (
          <div className={[styles.statusBanner, styles.statusError].filter(Boolean).join(' ')}>{state.error}</div>
        ) : null}

        {state.status === 'loading' ? (
          <div className={[styles.statusBanner, styles.statusInfo].filter(Boolean).join(' ')}>{t('status.loading')}</div>
        ) : null}

        {!board && state.status === 'ready' ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>{t('empty.title')}</div>
            <div className={styles.emptyBody}>{t('empty.body')}</div>
          </div>
        ) : null}

        {board && (subTab === 'architecture' || subTab === 'modules') ? (() => {
          const diagram = subTab === 'architecture' ? architecture : modules
          if (!diagram) {
            return <div className={styles.empty}><div className={styles.emptyTitle}>{t('empty.title')}</div></div>
          }
          const draft = state.drafts[diagram.id]
          return (
            <DiagramCard
              diagram={diagram}
              draft={draft}
              onEdit={text => controller.updateDraft(diagram.id, text)}
            />
          )
        })() : null}

        {board && subTab === 'flows' ? (
          flows.length > 0 && activeFlow ? (
            <div className={styles.flowLayout}>
              <FlowList flows={flows} selectedId={activeFlow.id} onSelect={setSelectedFlow} />
              <div className={styles.flowMain}>
                <DiagramCard
                  key={activeFlow.id}
                  diagram={activeFlow}
                  draft={state.drafts[activeFlow.id]}
                  onEdit={text => controller.updateDraft(activeFlow.id, text)}
                />
              </div>
            </div>
          ) : (
            <div className={styles.empty}><div className={styles.emptyTitle}>暂无业务流程图</div></div>
          )
        ) : null}

        {board && subTab === 'plan' ? (() => {
          const plan = board.plan
          if (!plan) {
            return <div className={styles.empty}><div className={styles.emptyTitle}>plan.json not found</div></div>
          }
          return (
            <div className={styles.planCard}>
              {editingPlan ? (
                <textarea
                  className={styles.editor}
                  value={state.planDraft ?? plan.text}
                  onChange={e => controller.updatePlanDraft(e.target.value)}
                  spellCheck={false}
                />
              ) : planModules.length > 0 ? (
                <div className={styles.flowLayout}>
                  <aside className={styles.flowSide}>
                    <div className={styles.flowSideHead}>计划模块（{planModules.length}）</div>
                    <div className={styles.flowSideList}>
                      {planModules.map((m, i) => (
                        <PlanSideItem
                          key={m.id ?? String(i)}
                          m={m}
                          active={i === selectedModule}
                          isLatest={!!m.updatedAt && m.updatedAt === latestModuleDate}
                          onClick={() => setSelectedModule(i)}
                        />
                      ))}
                    </div>
                  </aside>
                  <div className={styles.flowMain}>
                    {(() => {
                      const sel = planModules[selectedModule]
                      if (!sel) return null
                      return (
                        <PlanDetail
                          m={sel}
                          isLatest={!!sel.updatedAt && sel.updatedAt === latestModuleDate}
                          diagramById={diagramById}
                          onJumpDiagram={jumpToDiagram}
                        />
                      )
                    })()}
                  </div>
                </div>
              ) : (
                <div className={styles.empty}><div className={styles.emptyTitle}>plan.json 中还没有模块</div></div>
              )}
            </div>
          )
        })() : null}

        {state.renderOutput ? (
          <div className={styles.diagramCard}>
            <div className={styles.diagramHeader}>
              <span className={styles.diagramTitle}>Render output</span>
              <Pill>exit {state.renderOutput.exitCode}</Pill>
            </div>
            {state.renderOutput.stdout ? <pre className={styles.renderLog}>{state.renderOutput.stdout}</pre> : null}
            {state.renderOutput.stderr ? <pre className={styles.renderLog}>{state.renderOutput.stderr}</pre> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
