/** `designCenter` namespace dictionaries (view tab label + toolbar/empty strings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'designCenter'

/** The design-center dictionary key set (the source of truth for both locales). */
export type DesignCenterKey =
  | 'view.designCenter'
  | 'toolbar.refresh'
  | 'toolbar.render'
  | 'toolbar.edit'
  | 'toolbar.save'
  | 'toolbar.cancel'
  | 'tab.architecture'
  | 'tab.modules'
  | 'tab.flows'
  | 'tab.plan'
  | 'empty.title'
  | 'empty.body'
  | 'status.loading'
  | 'status.error'
  | 'status.rendering'
  | 'status.saved'
  | 'status.noCwd'
  | 'diagram.unnamed'
  | 'plan.modules'
  | 'plan.status'
  | 'plan.priority'
  | 'plan.progress'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The design-center view tab label and toolbar strings. */
    'designCenter': DesignCenterKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<DesignCenterKey, string> = {
  'view.designCenter': '设计中心',
  'toolbar.refresh': '刷新',
  'toolbar.render': '重新渲染',
  'toolbar.edit': '编辑',
  'toolbar.save': '保存',
  'toolbar.cancel': '取消',
  'tab.architecture': '架构',
  'tab.modules': '模块',
  'tab.flows': '流程',
  'tab.plan': '计划',
  'empty.title': '暂无设计看板',
  'empty.body': '在工作区的 docs/design/diagrams 目录下生成架构图后，这里会显示看板内容。',
  'status.loading': '加载中…',
  'status.error': '加载失败',
  'status.rendering': '渲染中…',
  'status.saved': '已保存',
  'status.noCwd': '当前会话没有关联工作目录',
  'diagram.unnamed': '未命名图表',
  'plan.modules': '模块',
  'plan.status': '状态',
  'plan.priority': '优先级',
  'plan.progress': '进度',
}

/** English dictionary. */
export const en: Record<DesignCenterKey, string> = {
  'view.designCenter': 'Design Center',
  'toolbar.refresh': 'Refresh',
  'toolbar.render': 'Re-render',
  'toolbar.edit': 'Edit',
  'toolbar.save': 'Save',
  'toolbar.cancel': 'Cancel',
  'tab.architecture': 'Architecture',
  'tab.modules': 'Modules',
  'tab.flows': 'Flows',
  'tab.plan': 'Plan',
  'empty.title': 'No design board yet',
  'empty.body': 'Once architecture diagrams are generated under docs/design/diagrams, the board appears here.',
  'status.loading': 'Loading…',
  'status.error': 'Load failed',
  'status.rendering': 'Rendering…',
  'status.saved': 'Saved',
  'status.noCwd': 'This session has no working directory',
  'diagram.unnamed': 'Untitled diagram',
  'plan.modules': 'Modules',
  'plan.status': 'Status',
  'plan.priority': 'Priority',
  'plan.progress': 'Progress',
}
