/**
 * Browser entry: registers the "设计中心 / Design Center" conversation-view tab
 * at order 20 (after chat=0 and trajectory=10) and wires the data controller.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ClientConnectionRpc, ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { DesignCenterController } from './data/controller.ts'
import { DesignCenterView } from './DesignCenterView.tsx'
import { NS, en, zh } from './locales.ts'

/** Dependency injection slots consumed on the browser side. */
export const inject = ['slots', 'sessions', 'locale', 'connection'] as const

interface DesignCenterViewInjected {
  readonly controller: DesignCenterController
}

/**
 * Register the locale dictionaries, instantiate one controller per context,
 * and inject the design-center tab into the conversation.view list slot.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-design-center: dictionaries')
  const t = ctx.locale.bind(NS)

  const connection = ctx.get('connection') as unknown as ConnectionHandle
  const controller = new DesignCenterController(connection.rpc as ClientConnectionRpc)

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'design-center',
    order: 20,
    locale: NS,
    label: () => t('view.designCenter'),
    inject: (_sessionId: SessionId): DesignCenterViewInjected => ({ controller }),
  }, DesignCenterView))
}

export default { name: 'ui-design-center', apply, inject }
