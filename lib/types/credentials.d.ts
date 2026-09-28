/**
 * Structural face of the DSH credential-reference seam (`ctx.credentials`).
 *
 * The plugin resolves `OPENCODE_GO_API_KEY` per refresh through the seam, so a
 * key stored in `~/.dsh/.credentials.yaml` — which is where the DSH model
 * providers keep it, and where it therefore already lives for anyone using the
 * `opencode-go` provider — reaches the next refresh without a restart, and no
 * secret ever appears in this package's own configuration.
 *
 * Only the single `resolve` hop is used, so the face stays a local structural
 * type instead of adding `@deepseek-ai/dsh-credentials` as a dependency: the
 * service is looked up optionally with `ctx.get('credentials')`, and a profile
 * without it still works from the environment or the config file.
 * @module dsh-ocgo-usage/credentials
 */
/**
 * Nominal reference to one credential: a POSIX-style environment-variable
 * name. Structurally a plain string, so callers never need a cast.
 */
export type CredentialRef = string & {
    readonly __credentialRefBrand?: never;
};
/** One resolved credential value and the source layer that supplied it. */
export interface ResolvedCredential {
    /** The non-empty secret value. */
    readonly value: string;
    /** Provider-defined source layer id (`env`, `file`, `project-env`, `user-env`). */
    readonly source: string;
}
/** Presence and writability facts for one reference — never the value. */
export interface CredentialInfo {
    /** Whether resolving the reference would currently return a value. */
    readonly configured: boolean;
    /** Source layer currently supplying the value; absent while unconfigured. */
    readonly source?: string;
    /** Whether the active provider can write this reference. */
    readonly writable: boolean;
}
/** The slice of `ctx.credentials` this plugin uses. */
export interface CredentialProviderFace {
    /**
     * Resolve one reference to its current value.
     * @param ref - the reference to resolve.
     * @returns the value and its source, or `undefined` while unconfigured.
     */
    resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined>;
    /**
     * Describe one reference for the config editor without exposing the value.
     * Optional: a provider that predates the seam's `describe` half still works.
     * @param ref - the reference to describe.
     */
    describe?(ref: CredentialRef): Promise<CredentialInfo>;
    /**
     * Durably store one value in the provider-managed writable source. Optional,
     * and it rejects while a read-only source shadows the reference.
     * @param ref - the reference to store.
     * @param value - the non-empty secret value.
     */
    set?(ref: CredentialRef, value: string): Promise<void>;
    /**
     * Remove one reference from the provider-managed writable source.
     * @param ref - the reference to remove.
     */
    unset?(ref: CredentialRef): Promise<void>;
}
/**
 * Brand a raw environment-variable name as a {@link CredentialRef}.
 * @param name - a POSIX shell identifier such as `OPENCODE_GO_API_KEY`.
 * @returns the same string, typed as a reference.
 */
export declare function credentialRef(name: string): CredentialRef;
/**
 * Read one reference from an optional credential provider.
 * @param provider - the `ctx.credentials` service, when the profile has one.
 * @param name - the environment-variable name to resolve.
 * @returns the trimmed value, or `undefined` when unset or unresolvable.
 */
export declare function resolveCredential(provider: CredentialProviderFace | undefined, name: string): Promise<string | undefined>;
/**
 * Describe one reference through the seam without exposing its value. Used to
 * tell whether a write would land or be shadowed by a read-only source.
 * @param provider - the `ctx.credentials` service, when the profile has one.
 * @param ref - the reference to describe.
 * @returns the seam's presence/writability facts, or `undefined` when the
 * provider cannot answer (older seam, or a failing one).
 */
export declare function describeCredential(provider: CredentialProviderFace | undefined, ref: CredentialRef): Promise<CredentialInfo | undefined>;
//# sourceMappingURL=credentials.d.ts.map