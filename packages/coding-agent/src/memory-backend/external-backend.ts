import { logger } from "@oh-my-pi/pi-utils";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { MemoryBackend } from "./types";

/**
 * Load the external memory backend named by `OMP_MEMORY_BACKEND_MODULE`.
 *
 * The built-in backends are compiled in, so a host that wants a backend living
 * outside this repository — developed and versioned on its own — has no way to
 * select one. The environment variable is that way: an absolute path to an ESM
 * module whose default export (or `memoryBackend` named export) implements this
 * package's `MemoryBackend` contract.
 *
 * A misconfigured memory backend MUST NOT break the agent loop, so every
 * failure — an unreadable file, a throwing import, an invalid export — is
 * logged and answered as "no external backend"; selection then falls through to
 * the settings chain unchanged. One attempt per resolved path is memoized, so a
 * loaded module stays a singleton (like the built-in backends) and a broken
 * path warns once rather than on every turn.
 */
const attempts = new Map<string, Promise<MemoryBackend | undefined>>();

/** Whether a module export satisfies the contract a memory backend must meet. */
function isMemoryBackend(candidate: unknown): candidate is MemoryBackend {
	if (typeof candidate !== "object" || candidate === null) return false;
	if (!("id" in candidate) || typeof candidate.id !== "string") return false;
	if (!("start" in candidate) || typeof candidate.start !== "function") return false;
	if (!("buildDeveloperInstructions" in candidate) || typeof candidate.buildDeveloperInstructions !== "function") {
		return false;
	}
	if (!("clear" in candidate) || typeof candidate.clear !== "function") return false;
	if (!("enqueue" in candidate) || typeof candidate.enqueue !== "function") return false;
	// The optional hook is validated too: a module that declares it but cannot be
	// called would fail on the session's first turn instead of at load time.
	return !("beforeAgentStartPrompt" in candidate) || typeof candidate.beforeAgentStartPrompt === "function";
}

/** The backend a loaded module exports, or undefined when it exports none. */
function backendFromModule(loaded: unknown): MemoryBackend | undefined {
	if (typeof loaded !== "object" || loaded === null) return undefined;
	const exported: unknown[] = [];
	if ("default" in loaded) exported.push(loaded.default);
	if ("memoryBackend" in loaded) exported.push(loaded.memoryBackend);
	for (const candidate of exported) {
		if (isMemoryBackend(candidate)) return candidate;
	}
	return undefined;
}

async function loadExternalMemoryBackend(resolvedPath: string): Promise<MemoryBackend | undefined> {
	try {
		// Dynamic import is required: the module path is runtime-supplied
		// (`OMP_MEMORY_BACKEND_MODULE`), so it cannot be resolved at build time.
		const loaded: unknown = await import(pathToFileURL(resolvedPath).href);
		const backend = backendFromModule(loaded);
		if (!backend) {
			logger.warn("External memory backend module does not implement the contract; ignoring it", {
				path: resolvedPath,
			});
			return undefined;
		}
		return backend;
	} catch (error) {
		logger.warn("Failed to load the external memory backend module; falling through to settings", {
			path: resolvedPath,
			error: String(error),
		});
		return undefined;
	}
}

/** The backend selected by the environment, or undefined when the feature is off or the module fails. */
export function resolveExternalMemoryBackend(): Promise<MemoryBackend | undefined> {
	const configured = process.env.OMP_MEMORY_BACKEND_MODULE?.trim();
	if (!configured) return Promise.resolve(undefined);
	const resolvedPath = path.resolve(configured);
	const pending = attempts.get(resolvedPath);
	if (pending) return pending;
	const attempt = loadExternalMemoryBackend(resolvedPath);
	attempts.set(resolvedPath, attempt);
	return attempt;
}
