import type { HostAgent, HostContextShape, HostPromptAssembly } from './dsh.ts'
import type { ResolvedConfig } from './config.ts'
import type { ComposableMemoryView } from '../core/contracts/index.ts'
import type { MnemonAgentRuntimeSource } from './runtime.ts'

export const GUIDANCE_SECTION_NAME = 'mnemon:routing'
export const RUNTIME_MEMORY_CONTEXT_NAME = 'mnemon:runtime-memory'
export const STRATEGY_SECTION_NAME = 'mnemon:strategy'
const ROUTING_SECTION_ORDER = 150
export const SNAPSHOT_GUIDANCE = 'Mnemon memory snapshots are complete projections in chronological order. The latest snapshot supersedes earlier snapshots as the current projected state; do not treat older versions as additional current facts or authority. Absence may reflect filtering or projection budgets and does not imply deletion from storage.'
export const ROUTING_GUIDANCE = 'Use memory only when needed. Follow the current Mnemon View: use mnemon_view_route or mnemon_view_action only for offered ids. Installed tools do not imply an available Source. Never infer missing historical facts. An action offer is not authorization; a write exists only after its receipt.'

/** A View is an own-plugin message, never part of the shared context snapshot. */
export function withoutMemoryViewContext<T extends { contexts: Array<{ name: string; text: string }> }>(assembly: T): T {
  return { ...assembly, contexts: assembly.contexts.filter(context => context.name !== RUNTIME_MEMORY_CONTEXT_NAME) }
}

/** Inject trusted Strategy instructions after interpolation; Source text stays quoted in the Wake. */
export function applyMemoryViewGuidance<T extends HostPromptAssembly>(assembly: T, view: ComposableMemoryView | undefined, routingEnabled = true): T {
  if (view === undefined) return withoutMemoryViewContext({ ...assembly, sections: assembly.sections.filter(section => section.name !== 'mnemon:snapshot-history') })
  const sections = assembly.sections.filter(section => ![GUIDANCE_SECTION_NAME, STRATEGY_SECTION_NAME, 'mnemon:runtime-memory-protocol', 'mnemon:snapshot-history'].includes(section.name))
  sections.push({ name: 'mnemon:snapshot-history', order: ROUTING_SECTION_ORDER - 2, text: SNAPSHOT_GUIDANCE })
  if (view.guidance?.system) sections.push({ name: STRATEGY_SECTION_NAME, order: ROUTING_SECTION_ORDER - 1, text: view.guidance.system })
  if (routingEnabled) sections.push({ name: GUIDANCE_SECTION_NAME, order: ROUTING_SECTION_ORDER, text: view.guidance?.routing ?? ROUTING_GUIDANCE })
  return withoutMemoryViewContext({ ...assembly, sections })
}

/** Register once the prompt service is active; Cordis re-runs this if the service is replaced. */
export function registerGuidance(ctx: HostContextShape, config?: Pick<ResolvedConfig, 'routingGuidance'>, runtime?: Pick<MnemonAgentRuntimeSource, 'memoryParticipation'>): void {
  ctx.inject(['systemPrompt'], prompted => {
    const prompt = prompted.get('systemPrompt') as { section(value: { name: string; order: number; text: (context?: { agent?: HostAgent }) => string }): unknown }
    prompt.section({
      name: GUIDANCE_SECTION_NAME,
      order: ROUTING_SECTION_ORDER,
      text: context => config?.routingGuidance === false || context?.agent !== undefined && runtime?.memoryParticipation?.(context.agent).excluded ? '' : ROUTING_GUIDANCE,
    })
  })
}
