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
/** Run a contribution callback and normalize whatever it returned into one disposer. */
function settleContribution(effect) {
    if (typeof effect === 'function')
        return effect;
    const disposers = [...effect].reverse();
    return () => {
        for (const dispose of disposers)
            dispose();
    };
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
export function armSlotContribution(slots, key, contribute) {
    const inject = slots.inject;
    if (typeof inject === 'function') {
        let dispose;
        const owner = inject.call(slots, key, () => {
            const settled = settleContribution(contribute());
            dispose = settled;
            return settled;
        });
        return {
            mode: 'deferred',
            dispose: () => {
                // `inject` returns the injection's own disposer; the contribution's
                // disposer is the fallback for a shell that returns nothing usable.
                if (typeof owner === 'function')
                    owner();
                else
                    dispose?.();
            },
        };
    }
    return { mode: 'eager', dispose: settleContribution(contribute()) };
}
/** Read the provider off whichever selection member the shell populated. */
function providerOf(view) {
    if (view === undefined || view === null)
        return undefined;
    const selection = view.next ?? view.pending ?? view.lastUsed;
    const provider = selection?.provider;
    return typeof provider === 'string' && provider.length > 0 ? provider : undefined;
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
export function readModelProvider(sessions, sessionId) {
    if (sessions === undefined || sessionId === undefined || sessionId.length === 0)
        return undefined;
    try {
        const binding = sessions.binding?.(sessionId);
        const face = binding?.session?.projections?.faceOf?.('modelSelection');
        // A shell may hand back the snapshot itself instead of the observable face
        // that carries it; both read the same way through `getSnapshot`, and a
        // plain object simply has no such method.
        const snapshot = face?.getSnapshot?.() ?? face;
        return providerOf(snapshot);
    }
    catch {
        // A shell that refuses the read must not break the dock entry's render.
        return undefined;
    }
}
