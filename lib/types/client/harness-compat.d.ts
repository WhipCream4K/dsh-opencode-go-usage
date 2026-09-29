/**
 * Harness-version compatibility for the browser half.
 *
 * The browser half is loaded by whatever DSH shell serves the page, which can
 * be a different release than the one this package was built against. Every
 * place where DSH has changed the shape of a seam the chip depends on is
 * funnelled through this module, so the rest of the client code is written
 * against one contract and a shell change costs one adapter here rather than a
 * rewrite of the registration site.
 *
 * The three seams, each with the evidence for its variants:
 *
 * - **Slot arming.** DSH 0.2.0-rc.2 added `ctx.slots.inject()`, which installs
 *   a contribution when — and for as long as — the owning package declares the
 *   slot, and collapses it when that declaration goes away
 *   (`packages/client/ui-renderer/src/client/registry.ts`). Shells before it
 *   only expose the eager `register()`, which throws while the slot is
 *   undeclared. {@link armSlotContribution} prefers the deferred form and
 *   falls back to the eager one.
 * - **Session-bound provider reads.** `ctx.sessions.binding(id)` hands back a
 *   `SessionBinding` whose `session.projections.faceOf(key)` is an
 *   `ObservableSnapshot` (`packages/api/session-controller/src/client/`).
 *   {@link readModelProvider} walks that path defensively: every hop is
 *   optional, so a shell that renames or drops one hides the chip instead of
 *   breaking the composer around it.
 * - **Projection payload.** The wire view of `modelSelection` carries
 *   `{ lastUsed, next }` while the durable state carries
 *   `{ lastUsed, pending }` (`packages/api/session-controller/src/model-selection-projection.ts`).
 *   {@link readModelProvider} reads whichever is present, so the chip follows
 *   the live selection under either representation.
 *
 * Nothing here imports a DSH runtime value: the module is pure data handling so
 * it is unit-testable in Node and cannot itself become a version dependency.
 * @module dsh-ocgo-usage/client/harness-compat
 */
/**
 * What a deferred slot contribution may return: a synchronous disposer, or an
 * iterable of disposers installed transactionally (the rc.2
 * `SlotRegistry.inject` callback contract).
 */
export type SlotInjectionEffect = (() => void) | Iterable<() => void>;
/** The slice of the client `slots` service that decides how a contribution is armed. */
export interface SlotArmingFace {
    /**
     * Deferred arming, present from DSH 0.2.0-rc.2. Runs the callback when the
     * slot's declaration is live and disposes the returned effect when it
     * collapses.
     */
    inject?(key: string, contribute: () => SlotInjectionEffect): unknown;
}
/** How a contribution was armed, for diagnostics and tests. */
export type SlotArmingMode = 'deferred' | 'eager';
/** The armed contribution: its disposer, and the path the shell allowed. */
export interface ArmedSlotContribution {
    /** Removes the contribution (a no-op once the owning declaration collapsed). */
    readonly dispose: () => void;
    /** `deferred` when `slots.inject` armed it, `eager` when it was registered directly. */
    readonly mode: SlotArmingMode;
}
/**
 * Arm one contribution into a slot declared by another package.
 *
 * Prefers `slots.inject`, because on rc.2 a bare `register()` into a slot whose
 * declarer has not applied yet throws — and apply order is explicitly
 * unconstrained across packages. A shell without `inject` gets the eager path,
 * which is what those releases supported.
 *
 * @param slots - the client `slots` service (or any face exposing `inject`).
 * @param key - the target slot key, e.g. `conversation.input.right`.
 * @param contribute - registers the contribution and returns its disposer.
 * @returns the disposer plus the path taken.
 */
export declare function armSlotContribution(slots: SlotArmingFace, key: string, contribute: () => SlotInjectionEffect): ArmedSlotContribution;
/**
 * The `modelSelection` payload as the client can observe it.
 *
 * `next` is the effective selection on the wire view; `pending`/`lastUsed` are
 * the durable state's members. All three are read so the chip works whether the
 * shell hands over the wire projection or the raw state.
 */
export interface ModelSelectionView {
    /** Effective selection as the wire view names it. */
    next?: {
        provider?: string;
    } | null;
    /** Committed choice awaiting its first use (durable state). */
    pending?: {
        provider?: string;
    } | null;
    /** Last selection the session actually used. */
    lastUsed?: {
        provider?: string;
    } | null;
}
/** An observable snapshot: the only member this plugin reads. */
export interface ObservableSnapshotFace {
    getSnapshot?(): unknown;
}
/** The `session.projections` face of a bound client session. */
export interface ProjectionsFace {
    faceOf?(key: string): unknown;
}
/** The `binding.session` face of a bound client session. */
export interface BoundSessionFace {
    projections?: ProjectionsFace;
}
/** One binding as `sessions.binding(id)` returns it. */
export interface SessionBindingFace {
    session?: BoundSessionFace;
}
/**
 * The client `sessions` service as this plugin needs it: resolve a session id
 * to its binding. Deliberately a local structural type rather than an import
 * from `@deepseek-ai/dsh-api-session-controller`, so the chip does not pin a
 * package that has moved between DSH releases.
 */
export interface SessionsFace {
    /** Resolve the live binding of a session, if it is open. */
    binding?(id: string): SessionBindingFace | undefined;
}
/**
 * Resolve the current model provider of one session from the live in-memory
 * `modelSelection` projection (no network).
 *
 * Every hop is optional and every failure resolves to `undefined`: the chip
 * hides itself when the provider is unknown, which is strictly better than
 * taking the composer down with a shell that moved a hop.
 *
 * @param sessions - the client `sessions` service, when the shell has one.
 * @param sessionId - the session the dock entry renders for.
 * @returns the provider id, or `undefined` when it cannot be determined.
 */
export declare function readModelProvider(sessions: SessionsFace | undefined, sessionId: string | undefined): string | undefined;
//# sourceMappingURL=harness-compat.d.ts.map