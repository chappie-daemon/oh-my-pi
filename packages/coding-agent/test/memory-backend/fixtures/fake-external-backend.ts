import type { MemoryBackend } from "@oh-my-pi/pi-coding-agent/memory-backend/types";

/**
 * The external backend `test/memory-backend/external-backend.test.ts` loads
 * through `OMP_MEMORY_BACKEND_MODULE`. It is never imported directly, so the
 * loader's own path is what that test exercises. Being typed as a
 * `MemoryBackend` also fails the type check if the contract drifts, and its id
 * only compiles while `MemoryBackendId` accepts a name the harness does not
 * know.
 */
export const fakeExternalBackend: MemoryBackend = {
	id: "fake-external",
	start() {},
	async buildDeveloperInstructions() {
		return undefined;
	},
	async clear() {},
	async enqueue() {},
	async beforeAgentStartPrompt() {
		return undefined;
	},
};

export default fakeExternalBackend;
