/**
 * Shared types for dsh-ocgo-usage.
 *
 * The plugin reads the official OpenCode Go quota API —
 * `GET <baseUrl>/zen/go/v1/usage` — authenticated with the regular OpenCode Go
 * API key (`Authorization: Bearer <OPENCODE_GO_API_KEY>`). That endpoint needs
 * no workspace id and no web-session cookie, so the whole config surface is a
 * single secret and nothing here carries session identity.
 * @module dsh-ocgo-usage/types
 */
export {};
