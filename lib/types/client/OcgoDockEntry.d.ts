/**
 * The composer tool-row entry: the OpenCode Go usage readout, mounted in the
 * composer tool row (`conversation.input.right`) next to the model selector.
 * The chip polls the host `/api/ocgo-usage` endpoint for the three usage
 * windows (rolling 5h / weekly / monthly);
 * clicking reveals per-window reset countdowns, a Set editor (masked API key)
 * and a manual refresh. In the error state, clicking the
 * chip opens the Set editor directly so a stale key can be replaced in
 * place.
 * @module dsh-ocgo-usage/client/OcgoDockEntry
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/**
 * The injected business face the registration supplies: the tool row's owning
 * session plus a live read of that session's current model provider.
 */
export interface OcgoInjected {
    /** The session this dock entry renders for (slot inject factory arg). */
    dockSessionId: string | undefined;
    /**
     * Resolve the CURRENT model provider of the dock's session from the live
     * in-memory `modelSelection` projection (no network). Undefined when the
     * session has no selection yet or the shell moved the hops.
     */
    provider(): Promise<string | undefined>;
}
/** Composed props of the dock entry (runtime + locale + the injected face). */
export type OcgoDockEntryProps = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS> & OcgoInjected;
/**
 * Format a duration (seconds) compactly: 45s / 23m / 5h 23m / 4d 6h.
 */
export declare function formatDuration(totalSec: number): string;
/**
 * The OpenCode Go usage chip: polls the host snapshot, renders the three
 * windows inline, and expands into a detail panel on click.
 * @param props - the composed dock entry props.
 */
export declare function OcgoDockEntry(props: OcgoDockEntryProps): React.ReactElement | null;
//# sourceMappingURL=OcgoDockEntry.d.ts.map