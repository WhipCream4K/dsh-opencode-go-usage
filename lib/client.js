window.__ModuleLoader__.load({
	id: "dsh-ocgo-usage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/harness-compat.ts
		/** Run a contribution callback and normalize whatever it returned into one disposer. */
		function settleContribution(effect) {
			if (typeof effect === "function") return effect;
			const disposers = [...effect].reverse();
			return () => {
				for (const dispose of disposers) dispose();
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
		function armSlotContribution(slots, key, contribute) {
			const inject = slots.inject;
			if (typeof inject === "function") {
				let dispose;
				const owner = inject.call(slots, key, () => {
					const settled = settleContribution(contribute());
					dispose = settled;
					return settled;
				});
				return {
					mode: "deferred",
					dispose: () => {
						if (typeof owner === "function") owner();
						else dispose?.();
					}
				};
			}
			return {
				mode: "eager",
				dispose: settleContribution(contribute())
			};
		}
		/** Read the provider off whichever selection member the shell populated. */
		function providerOf(view) {
			if (view === void 0 || view === null) return void 0;
			const provider = (view.next ?? view.pending ?? view.lastUsed)?.provider;
			return typeof provider === "string" && provider.length > 0 ? provider : void 0;
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
		function readModelProvider(sessions, sessionId) {
			if (sessions === void 0 || sessionId === void 0 || sessionId.length === 0) return void 0;
			try {
				const face = (sessions.binding?.(sessionId))?.session?.projections?.faceOf?.("modelSelection");
				return providerOf(face?.getSnapshot?.() ?? face);
			} catch {
				return;
			}
		}
		//#endregion
		//#region src/provider.ts
		/**
		* Provider matching for dsh-ocgo-usage: decide when the chip should show.
		* Pure and shared so the client logic is unit-testable without a browser.
		* @module dsh-ocgo-usage/provider
		*/
		/** The provider whose model selection shows the chip. */
		const OCGO_PROVIDER = "opencode-go";
		/** True when a provider/model means "show OpenCode Go usage". */
		function isOpenCodeGo(provider) {
			return provider === "opencode-go" || provider?.startsWith(`opencode-go/`) === true;
		}
		//#endregion
		//#region \0dsh-css:C:\Work\deepseek-harness-workspace\dsh-opencode-go-usage\src\client\ocgo.module.css.mjs
		const css = ".w-4KnG_wrap{display:inline-flex;position:relative}.w-4KnG_chip{height:24px;color:var(--dsw-alias-label-primary,#0f1115);cursor:pointer;white-space:nowrap;user-select:none;background:0 0;border:0;border-radius:999px;align-items:center;gap:6px;padding:0 6px 0 8px;font-size:12px;line-height:1;transition:background-color .12s;display:inline-flex}.w-4KnG_chip:hover,.w-4KnG_chipOpen{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}.w-4KnG_seg{align-items:baseline;gap:3px;display:inline-flex}.w-4KnG_segSep{opacity:.45}.w-4KnG_logo{flex:none;display:inline-flex}.w-4KnG_chevron{color:var(--dsw-alias-label-caption,#81858c);flex:none;transition:transform .12s;display:inline-flex}.w-4KnG_chevronOpen{transform:rotate(180deg)}.w-4KnG_segWarn50{color:var(--dsw-static-amber-400,#f7ad31)}.w-4KnG_segWarn60{color:var(--dsw-static-amber-500,#f59e0b)}.w-4KnG_segWarn70{color:var(--dsw-static-amber-600,#dd8629)}.w-4KnG_segErr80{color:var(--dsw-alias-state-error-primary,#dc2626)}.w-4KnG_segCrit90{color:var(--dsw-alias-state-error-primary,#dc2626);font-weight:600}.w-4KnG_details{z-index:40;border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-specific-menu,#fff);min-width:220px;color:var(--dsw-alias-label-primary,#0f1115);box-shadow:var(--dsw-shadow-lv3,0 4px 12px #00000014);border-radius:8px;flex-direction:column;gap:6px;padding:8px 10px;font-size:12px;display:flex;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translate(-50%)}.w-4KnG_window{justify-content:space-between;align-items:center;gap:12px;display:flex}.w-4KnG_windowLabel{color:var(--dsw-alias-label-secondary,#61666b);opacity:.9;align-items:center;gap:6px;display:inline-flex}.w-4KnG_windowValue{font-variant-numeric:tabular-nums;align-items:baseline;gap:6px;display:inline-flex}.w-4KnG_windowReset{opacity:.65;font-variant-numeric:tabular-nums;font-size:11px}.w-4KnG_foot{border-top:1px solid var(--dsw-alias-border-l1,#0000000a);justify-content:space-between;align-items:center;gap:8px;padding-top:6px;font-size:11px;display:flex}.w-4KnG_footRight{align-items:center;gap:8px;margin-left:auto;display:inline-flex}.w-4KnG_setBtn{color:var(--dsw-alias-state-business-primary,#3964fe);cursor:pointer;background:0 0;border:0;padding:0;font-size:11px}.w-4KnG_setBtn:hover{text-decoration:underline}.w-4KnG_fetchedAt{opacity:.6}.w-4KnG_refreshBtn{color:var(--dsw-alias-state-business-primary,#3964fe);cursor:pointer;background:0 0;border:0;padding:0;font-size:11px}.w-4KnG_refreshBtn:hover{text-decoration:underline}.w-4KnG_setPanel{flex-direction:column;gap:8px;min-width:260px;display:flex}.w-4KnG_field{flex-direction:column;gap:3px;display:flex}.w-4KnG_fieldLabel{color:var(--dsw-alias-label-secondary,#61666b);opacity:.75;font-variant-numeric:tabular-nums;font-size:11px}.w-4KnG_fieldInput{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-layer-1,#fff);width:100%;color:var(--dsw-alias-label-primary,#0f1115);font-variant-numeric:tabular-nums;border-radius:6px;outline:none;height:26px;padding:0 8px;font-size:12px}.w-4KnG_fieldInput:focus{border-color:var(--dsw-alias-state-business-primary,#3964fe)}.w-4KnG_setHint{opacity:.55;font-size:11px}.w-4KnG_errorText{color:var(--dsw-alias-state-error-primary,#dc2626);white-space:normal;max-width:240px;font-size:11px}";
		const tagId = "dsh-ocgo-usage/ocgo.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-ocgo-usage";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ocgo_module_css_default = {
			"chevron": "w-4KnG_chevron",
			"chevronOpen": "w-4KnG_chevronOpen",
			"chip": "w-4KnG_chip",
			"chipOpen": "w-4KnG_chipOpen",
			"details": "w-4KnG_details",
			"errorText": "w-4KnG_errorText",
			"fetchedAt": "w-4KnG_fetchedAt",
			"field": "w-4KnG_field",
			"fieldInput": "w-4KnG_fieldInput",
			"fieldLabel": "w-4KnG_fieldLabel",
			"foot": "w-4KnG_foot",
			"footRight": "w-4KnG_footRight",
			"logo": "w-4KnG_logo",
			"refreshBtn": "w-4KnG_refreshBtn",
			"seg": "w-4KnG_seg",
			"segCrit90": "w-4KnG_segCrit90",
			"segErr80": "w-4KnG_segErr80",
			"segSep": "w-4KnG_segSep",
			"segWarn50": "w-4KnG_segWarn50",
			"segWarn60": "w-4KnG_segWarn60",
			"segWarn70": "w-4KnG_segWarn70",
			"setBtn": "w-4KnG_setBtn",
			"setHint": "w-4KnG_setHint",
			"setPanel": "w-4KnG_setPanel",
			"window": "w-4KnG_window",
			"windowLabel": "w-4KnG_windowLabel",
			"windowReset": "w-4KnG_windowReset",
			"windowValue": "w-4KnG_windowValue",
			"wrap": "w-4KnG_wrap"
		};
		//#endregion
		//#region src/client/OcgoDockEntry.tsx
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
		/** Poll interval for the host snapshot and the live model provider. */
		const POLL_MS = 1e4;
		/** The masked-prefix shown before the last-4 tail of a secret. */
		const MASK = "••••";
		/** Same-origin JSON fetch helper. */
		async function ocgoFetch(path, init) {
			const response = await fetch(path, init);
			if (!response.ok) {
				let detail = "";
				try {
					const body = await response.json();
					detail = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "";
				} catch {}
				throw new Error(detail.length > 0 ? detail : `ocgo-usage ${path} failed: ${response.status}`);
			}
			return await response.json();
		}
		/** The host usage API as the browser sees it (same-origin JSON endpoints). */
		const ocgoApi = {
			view: () => ocgoFetch("/api/ocgo-usage"),
			refresh: () => ocgoFetch("/api/ocgo-usage/refresh"),
			config: () => ocgoFetch("/api/ocgo-usage/config"),
			writeConfig: (partial) => ocgoFetch("/api/ocgo-usage/config", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(partial)
			})
		};
		/** Short window label: 5h / wk / mo. */
		const WINDOW_LABELS = {
			rolling: "5h",
			weekly: "wk",
			monthly: "mo"
		};
		/** Full window label key for the detail panel. */
		const WINDOW_TITLE_KEYS = {
			rolling: "ocgo.rolling",
			weekly: "ocgo.weekly",
			monthly: "ocgo.monthly"
		};
		/**
		* Format a duration (seconds) compactly: 45s / 23m / 5h 23m / 4d 6h.
		*/
		function formatDuration(totalSec) {
			if (totalSec < 60) return `${Math.max(0, Math.floor(totalSec))}s`;
			if (totalSec < 3600) return `${Math.floor(totalSec / 60)}m`;
			if (totalSec < 86400) {
				const h = Math.floor(totalSec / 3600);
				const m = Math.floor(totalSec % 3600 / 60);
				return m > 0 ? `${h}h ${m}m` : `${h}h`;
			}
			const d = Math.floor(totalSec / 86400);
			const h = Math.floor(totalSec % 86400 / 3600);
			return h > 0 ? `${d}d ${h}h` : `${d}d`;
		}
		/** Format an epoch-ms time as HH:MM. */
		function formatClock(epochMs) {
			const d = new Date(epochMs);
			return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
		}
		/** The severity class of one window (muted → escalating warn → err). */
		function severityClass(window) {
			if (window.status === "rate-limited" || window.percent >= 90) return ocgo_module_css_default.segCrit90;
			if (window.percent >= 80) return ocgo_module_css_default.segErr80;
			if (window.percent >= 70) return ocgo_module_css_default.segWarn70;
			if (window.percent >= 60) return ocgo_module_css_default.segWarn60;
			if (window.percent >= 50) return ocgo_module_css_default.segWarn50;
		}
		/** Detect dark mode via DSH body attribute. */
		function useDarkMode() {
			const [dark, setDark] = (0, react.useState)(() => {
				if (typeof document === "undefined") return false;
				return document.body.hasAttribute("data-ds-dark-theme");
			});
			(0, react.useEffect)(() => {
				const el = document.body;
				if (!el) return;
				const observer = new MutationObserver(() => {
					setDark(el.hasAttribute("data-ds-dark-theme"));
				});
				observer.observe(el, {
					attributes: true,
					attributeFilter: ["data-ds-dark-theme"]
				});
				return () => observer.disconnect();
			}, []);
			return dark;
		}
		/** The official OpenCode Go logo mark, inlined to avoid extra asset requests. */
		function OcgoLogo() {
			if (useDarkMode()) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: ocgo_module_css_default.logo,
				width: "22",
				height: "12",
				viewBox: "0 0 54 30",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						width: "100%",
						height: "100%",
						fill: "#2c2c2e"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M24 30H0V0H24V6H6V24H18V18H12V12H24V30Z",
						fill: "#e6edf3"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M12 18H18V24H6V12H12V18Z",
						fill: "#646464"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M48 12V24H36V12H48Z",
						fill: "#646464"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M54 30H30V0H54V30ZM36 24H48V6H36V24Z",
						fill: "#e6edf3"
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: ocgo_module_css_default.logo,
				width: "22",
				height: "12",
				viewBox: "0 0 54 30",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M24 30H0V0H24V6H6V24H18V18H12V12H24V30Z",
						fill: "#211E1E"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M12 18H18V24H6V12H12V18Z",
						fill: "#CFCECD"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M48 12V24H36V12H48Z",
						fill: "#CFCECD"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M54 30H30V0H54V30ZM36 24H48V6H36V24Z",
						fill: "#211E1E"
					})
				]
			});
		}
		/** Render one window segment: compact `· 5h 23%`, full `· 5h 23% (3h 25m)`. */
		function WindowSegment(props) {
			const { window, sep, compact = false } = props;
			const cls = severityClass(window);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: ocgo_module_css_default.seg,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ocgo_module_css_default.segSep,
					children: sep
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: cls ?? void 0,
					children: [
						WINDOW_LABELS[window.kind],
						" ",
						window.percent,
						"%",
						!compact ? ` (${formatDuration(window.resetInSec)})` : ""
					]
				})]
			});
		}
		/** The masked display text for one secret field: `••••abcd`. */
		function maskedText(secret) {
			if (secret === void 0 || !secret.set || secret.tail.length === 0) return "";
			return `${MASK}${secret.tail}`;
		}
		/**
		* The OpenCode Go usage chip: polls the host snapshot, renders the three
		* windows inline, and expands into a detail panel on click.
		* @param props - the composed dock entry props.
		*/
		function OcgoDockEntry(props) {
			const [view, setView] = (0, react.useState)(null);
			const [open, setOpen] = (0, react.useState)(false);
			const [visible, setVisible] = (0, react.useState)(true);
			const [mode, setMode] = (0, react.useState)("view");
			const [config, setConfig] = (0, react.useState)(null);
			const [keyDraft, setKeyDraft] = (0, react.useState)("");
			const [writeError, setWriteError] = (0, react.useState)(null);
			const wrapRef = (0, react.useRef)(null);
			const modeRef = (0, react.useRef)("view");
			modeRef.current = mode;
			const keyDraftRef = (0, react.useRef)("");
			keyDraftRef.current = keyDraft;
			const configRef = (0, react.useRef)(null);
			configRef.current = config;
			const pollNow = (0, react.useCallback)(() => {
				let live = true;
				Promise.resolve().then(() => props.provider()).then((p) => p ?? void 0, () => void 0).then((p) => {
					if (!live) return;
					const shown = isOpenCodeGo(p);
					setVisible(shown);
					if (!shown) setOpen(false);
					if (shown) ocgoApi.view().then((snapshot) => {
						if (live) setView(snapshot);
					}, () => {
						if (live) setView(null);
					});
				}, () => {
					if (live) setVisible(false);
				});
				return () => {
					live = false;
				};
			}, [props.provider]);
			(0, react.useEffect)(() => {
				const cleanup = pollNow();
				const timer = window.setInterval(pollNow, POLL_MS);
				const onVisibility = () => {
					if (document.visibilityState === "visible") pollNow();
				};
				document.addEventListener("visibilitychange", onVisibility);
				return () => {
					cleanup();
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", onVisibility);
				};
			}, [pollNow]);
			/** Load the masked config into the editor draft. */
			const loadConfig = (0, react.useCallback)(() => {
				setWriteError(null);
				ocgoApi.config().then((snapshot) => {
					setConfig(snapshot);
					setKeyDraft(maskedText(snapshot.apiKey));
				}, () => {
					setConfig(null);
					setKeyDraft("");
				});
			}, []);
			/** Submit any edited key; returns the write promise (fire-and-forget on blur). */
			const saveConfig = (0, react.useCallback)(() => {
				const current = configRef.current;
				const typed = keyDraftRef.current.trim();
				const baseline = current === null ? "" : maskedText(current.apiKey);
				if (typed.length === 0 || typed === baseline) return;
				ocgoApi.writeConfig({ apiKey: typed }).then((snapshot) => {
					setConfig(snapshot);
					setKeyDraft(maskedText(snapshot.apiKey));
					setWriteError(null);
					pollNow();
				}, (error) => {
					setWriteError(error instanceof Error ? error.message : String(error));
				});
			}, [pollNow]);
			/** Close the panel; in set mode a blur/close acts as confirm (save). */
			const closePanel = (0, react.useCallback)(() => {
				if (modeRef.current === "set") saveConfig();
				setOpen(false);
				setMode("view");
			}, [saveConfig]);
			/** Open the editor (used by the Set button and the error chip). */
			const openSet = (0, react.useCallback)(() => {
				setMode("set");
				setOpen(true);
				loadConfig();
			}, [loadConfig]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target !== null && wrapRef.current !== null && !wrapRef.current.contains(target)) closePanel();
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") closePanel();
				};
				document.addEventListener("pointerdown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open, closePanel]);
			const refresh = () => {
				ocgoApi.refresh().then((snapshot) => {
					setView(snapshot);
				}, () => {});
			};
			const t = props.t;
			const sep = ` ${t("ocgo.sep")} `;
			if (!visible) return null;
			const error = view === null ? {
				code: "fetch",
				message: t("ocgo.error", { code: "fetch" })
			} : view.error !== void 0 ? {
				code: view.error,
				message: view.message ?? t("ocgo.error", { code: view.error })
			} : null;
			if (error !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: ocgo_module_css_default.wrap,
				ref: wrapRef,
				"data-testid": "ocgo-chip-error",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: open ? `${ocgo_module_css_default.chip} ${ocgo_module_css_default.chipOpen}` : ocgo_module_css_default.chip,
					onClick: () => {
						if (open) closePanel();
						else openSet();
					},
					title: `${error.message}\n${t("ocgo.set")}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OcgoLogo, {}),
						" <err:",
						error.code,
						">"
					]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ocgo_module_css_default.details,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ocgo_module_css_default.setPanel,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: ocgo_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.fieldLabel,
								children: t("ocgo.apiKeyLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: ocgo_module_css_default.fieldInput,
								value: keyDraft,
								placeholder: config?.apiKey.set === true ? t("ocgo.configured") : "sk-…",
								spellCheck: false,
								autoComplete: "off",
								onChange: (e) => {
									setKeyDraft(e.target.value);
								},
								onFocus: (e) => {
									if (e.target.value === maskedText(config?.apiKey)) e.target.select();
								}
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ocgo_module_css_default.foot,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.setHint,
								children: writeError ?? t("ocgo.setHint")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ocgo_module_css_default.refreshBtn,
								onClick: closePanel,
								children: t("ocgo.save")
							})]
						})]
					})
				})]
			});
			const snapshot = view;
			const windows = [
				snapshot.rolling,
				snapshot.weekly,
				snapshot.monthly
			].filter((w) => w !== void 0);
			if (windows.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: ocgo_module_css_default.chip,
				onClick: refresh,
				title: t("ocgo.refresh"),
				"data-testid": "ocgo-chip-empty",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OcgoLogo, {}),
					" ",
					t("ocgo.unavailable")
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: ocgo_module_css_default.wrap,
				ref: wrapRef,
				"data-testid": "ocgo-chip",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: open ? `${ocgo_module_css_default.chip} ${ocgo_module_css_default.chipOpen}` : ocgo_module_css_default.chip,
					onClick: () => {
						if (open) closePanel();
						else setOpen(true);
					},
					title: open ? t("ocgo.collapse") : t("ocgo.expand"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OcgoLogo, {}),
						windows.map((w) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WindowSegment, {
							window: w,
							sep,
							compact: true
						}, w.kind)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: open ? `${ocgo_module_css_default.chevron} ${ocgo_module_css_default.chevronOpen}` : ocgo_module_css_default.chevron,
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
								width: "12",
								height: "12",
								viewBox: "0 0 12 12",
								fill: "none",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
									d: "M3 4.5L6 7.5L9 4.5",
									stroke: "currentColor",
									strokeWidth: "1.5",
									strokeLinecap: "round",
									strokeLinejoin: "round"
								})
							})
						})
					]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ocgo_module_css_default.details,
					children: mode === "set" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ocgo_module_css_default.setPanel,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: ocgo_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.fieldLabel,
								children: t("ocgo.apiKeyLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: ocgo_module_css_default.fieldInput,
								value: keyDraft,
								placeholder: config?.apiKey.set === true ? t("ocgo.configured") : "sk-…",
								spellCheck: false,
								autoComplete: "off",
								onChange: (e) => {
									setKeyDraft(e.target.value);
								},
								onFocus: (e) => {
									if (e.target.value === maskedText(config?.apiKey)) e.target.select();
								}
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ocgo_module_css_default.foot,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.setHint,
								children: writeError ?? t("ocgo.setHint")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ocgo_module_css_default.refreshBtn,
								onClick: closePanel,
								children: t("ocgo.save")
							})]
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [windows.map((w) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ocgo_module_css_default.window,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ocgo_module_css_default.windowLabel,
							children: w.status === "rate-limited" ? t("ocgo.rateLimited") : t(WINDOW_TITLE_KEYS[w.kind])
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ocgo_module_css_default.windowValue,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: severityClass(w) ?? void 0,
								children: [w.percent, "%"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.windowReset,
								children: t("ocgo.resetsIn", { duration: formatDuration(w.resetInSec) })
							})]
						})]
					}, w.kind)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ocgo_module_css_default.foot,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ocgo_module_css_default.setBtn,
							onClick: openSet,
							children: t("ocgo.set")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ocgo_module_css_default.footRight,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ocgo_module_css_default.refreshBtn,
								onClick: refresh,
								children: t("ocgo.refresh")
							}), snapshot.updatedAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.fetchedAt,
								children: t("ocgo.fetchedAt", { time: formatClock(snapshot.updatedAt) })
							})]
						})]
					})] })
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Chinese copy. */
		const zh = {
			"ocgo.unavailable": "用量不可用",
			"ocgo.error": "查询失败：{code}",
			"ocgo.noconfig": "未配置：请设置 OPENCODE_GO_API_KEY（环境变量、$DSH_HOME/.credentials.yaml 或 $DSH_HOME/ocgo-usage.json）",
			"ocgo.apikey": "API Key 无效或已过期",
			"ocgo.empty": "返回中没有可用用量数据",
			"ocgo.refresh": "刷新",
			"ocgo.fetchedAt": "upd {time}",
			"ocgo.rolling": "5h 滚动",
			"ocgo.weekly": "每周",
			"ocgo.monthly": "每月",
			"ocgo.rateLimited": "已限流",
			"ocgo.resetsIn": "剩余 {duration}",
			"ocgo.expand": "展开用量详情",
			"ocgo.collapse": "收起",
			"ocgo.sep": "·",
			"ocgo.set": "设置",
			"ocgo.save": "保存",
			"ocgo.apiKeyLabel": "OpenCode Go API Key",
			"ocgo.configured": "已配置 — 输入新 Key 可替换",
			"ocgo.setHint": "点击外部或按 Esc 保存"
		};
		/** English copy. */
		const en = {
			"ocgo.unavailable": "usage unavailable",
			"ocgo.error": "Query failed: {code}",
			"ocgo.noconfig": "Not configured: set OPENCODE_GO_API_KEY (env, $DSH_HOME/.credentials.yaml, or $DSH_HOME/ocgo-usage.json)",
			"ocgo.apikey": "API key invalid or expired",
			"ocgo.empty": "Response carried no usable usage data",
			"ocgo.refresh": "Refresh",
			"ocgo.fetchedAt": "upd {time}",
			"ocgo.rolling": "5h Rolling",
			"ocgo.weekly": "Weekly",
			"ocgo.monthly": "Monthly",
			"ocgo.rateLimited": "rate-limited",
			"ocgo.resetsIn": "resets in {duration}",
			"ocgo.expand": "Show usage details",
			"ocgo.collapse": "Collapse",
			"ocgo.sep": "·",
			"ocgo.set": "Set",
			"ocgo.save": "Save",
			"ocgo.apiKeyLabel": "OpenCode Go API Key",
			"ocgo.configured": "configured — type a new key to replace",
			"ocgo.setHint": "click outside or press Esc to save"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "ocgo";
		/** The composer tool row this entry occupies. */
		const SLOT = "conversation.input.right";
		/** Stable list-slot cell id (the entry's identity inside the row). */
		const ENTRY_ID = "ocgo-usage";
		/** Sort order inside the row. */
		const ENTRY_ORDER = 110;
		/**
		* Required services. `slots` and `locale` are read directly; `conversation` is
		* declared so the eager fallback inside {@link armSlotContribution} — used by
		* shells predating `slots.inject` — runs after the package that declares the
		* composer row. On rc.2 and later the deferred path makes that order
		* irrelevant.
		*/
		const inject = [
			"slots",
			"locale",
			"conversation"
		];
		/**
		* Register the usage chip into the composer tool row next to the model selector.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-ocgo-usage: dictionaries");
			ctx.inject([
				"slots",
				"conversation",
				"sessions"
			], (scope) => {
				const sessions = scope.sessions;
				const armed = armSlotContribution(scope.slots, SLOT, () => scope.slots.register({
					name: SLOT,
					id: ENTRY_ID,
					order: ENTRY_ORDER,
					locale: NS,
					inject: (sessionId) => ({
						dockSessionId: sessionId,
						provider: async () => readModelProvider(sessions, sessionId)
					})
				}, OcgoDockEntry));
				scope.effect(() => armed.dispose, `dsh-ocgo-usage: chip registration (${armed.mode})`);
			});
		}
		//#endregion
		exports.OCGO_PROVIDER = OCGO_PROVIDER;
		exports.OcgoDockEntry = OcgoDockEntry;
		exports.apply = apply;
		exports.armSlotContribution = armSlotContribution;
		exports.formatDuration = formatDuration;
		exports.inject = inject;
		exports.readModelProvider = readModelProvider;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map