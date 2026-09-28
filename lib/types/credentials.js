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
 * Brand a raw environment-variable name as a {@link CredentialRef}.
 * @param name - a POSIX shell identifier such as `OPENCODE_GO_API_KEY`.
 * @returns the same string, typed as a reference.
 */
export function credentialRef(name) {
    return name;
}
/**
 * Read one reference from an optional credential provider.
 * @param provider - the `ctx.credentials` service, when the profile has one.
 * @param name - the environment-variable name to resolve.
 * @returns the trimmed value, or `undefined` when unset or unresolvable.
 */
export async function resolveCredential(provider, name) {
    if (provider === undefined || typeof provider.resolve !== 'function')
        return undefined;
    try {
        const resolved = await provider.resolve(credentialRef(name));
        const value = resolved?.value?.trim();
        return value !== undefined && value.length > 0 ? value : undefined;
    }
    catch {
        // A seam failure must not break the fallback chain (env / config file).
        return undefined;
    }
}
/**
 * Describe one reference through the seam without exposing its value. Used to
 * tell whether a write would land or be shadowed by a read-only source.
 * @param provider - the `ctx.credentials` service, when the profile has one.
 * @param ref - the reference to describe.
 * @returns the seam's presence/writability facts, or `undefined` when the
 * provider cannot answer (older seam, or a failing one).
 */
export async function describeCredential(provider, ref) {
    if (provider?.describe === undefined)
        return undefined;
    try {
        return await provider.describe(ref);
    }
    catch {
        return undefined;
    }
}
