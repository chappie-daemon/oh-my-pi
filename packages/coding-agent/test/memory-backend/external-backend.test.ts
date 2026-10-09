import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetSettingsForTest, Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { resolveMemoryBackend } from "@oh-my-pi/pi-coding-agent/memory-backend";

// The backend module is loaded through the environment variable, exactly as a
// real external backend is: nothing here imports the fixture.
const FIXTURE = join(import.meta.dir, "fixtures", "fake-external-backend.ts");
const MISSING = join(import.meta.dir, "fixtures", "no-such-external-backend.ts");

describe("external memory backend module", () => {
	beforeEach(() => {
		resetSettingsForTest();
		delete process.env.OMP_MEMORY_BACKEND_MODULE;
	});

	afterEach(() => {
		resetSettingsForTest();
		delete process.env.OMP_MEMORY_BACKEND_MODULE;
	});

	it("selects the module while memory.backend is off", async () => {
		process.env.OMP_MEMORY_BACKEND_MODULE = FIXTURE;

		const backend = await resolveMemoryBackend(Settings.isolated({ "memory.backend": "off" }));

		expect(backend.id).toBe("fake-external");
		expect(typeof backend.beforeAgentStartPrompt).toBe("function");
	});

	it("returns the same module instance for every call", async () => {
		process.env.OMP_MEMORY_BACKEND_MODULE = FIXTURE;
		const settings = Settings.isolated({ "memory.backend": "off" });

		expect(await resolveMemoryBackend(settings)).toBe(await resolveMemoryBackend(settings));
	});

	it("leaves the settings chain in charge when the variable is unset", async () => {
		const backend = await resolveMemoryBackend(Settings.isolated({ "memory.backend": "local" }));

		expect(backend.id).toBe("local");
	});

	it("falls through to the settings chain when the module does not load", async () => {
		process.env.OMP_MEMORY_BACKEND_MODULE = MISSING;

		const backend = await resolveMemoryBackend(Settings.isolated({ "memory.backend": "local" }));

		expect(backend.id).toBe("local");
	});

	it("falls through when the module's export does not implement the contract", async () => {
		const dir = await mkdtemp(join(tmpdir(), "omp-external-memory-backend-"));
		const invalid = join(dir, "invalid-external-backend.ts");
		await Bun.write(invalid, 'export default { id: "incomplete" };\n');
		process.env.OMP_MEMORY_BACKEND_MODULE = invalid;

		try {
			const backend = await resolveMemoryBackend(Settings.isolated({ "memory.backend": "local" }));

			expect(backend.id).toBe("local");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
