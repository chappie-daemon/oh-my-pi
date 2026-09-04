import { beforeAll, describe, expect, it } from "bun:test";
import { getThemeByName, setThemeInstance } from "../src/theme";
import type { AssistantMessage, Usage } from "@oh-my-pi/pi-ai";
import { assistantUsageIsBilled, buildChannelMessageCard } from "@oh-my-pi/pi-tui/chat/transcript-render-helpers";

function usage(overrides: Partial<Usage> = {}): Usage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		...overrides,
	};
}

describe("assistantUsageIsBilled", () => {
	it("suppresses the token badge only for turns that consumed nothing", () => {
		expect(assistantUsageIsBilled(usage())).toBe(false);
	});

	it("preserves cost transparency for empty replies whose prompt still cost input tokens", () => {
		expect(assistantUsageIsBilled(usage({ input: 321 }))).toBe(true);
		expect(assistantUsageIsBilled(usage({ output: 0, cacheRead: 512 }))).toBe(true);
		expect(assistantUsageIsBilled(usage({ cacheWrite: 128 }))).toBe(true);
		expect(assistantUsageIsBilled(usage({ premiumRequests: 1 }))).toBe(true);
	});

	// Documents the live/resume parity contract for #4532: both paths ask
	// `assistantUsageIsBilled` about `message.usage`, so an empty automated
	// reply that still cost input tokens renders identically on both surfaces.
	it("matches whether the assistant carrier renders visible content", () => {
		const emptyBilledMessage: Pick<AssistantMessage, "usage"> = { usage: usage({ input: 321 }) };
		const emptyFreeMessage: Pick<AssistantMessage, "usage"> = { usage: usage() };
		expect(assistantUsageIsBilled(emptyBilledMessage.usage)).toBe(true);
		expect(assistantUsageIsBilled(emptyFreeMessage.usage)).toBe(false);
	});
});

describe("buildChannelMessageCard", () => {
	let darkTheme: Awaited<ReturnType<typeof getThemeByName>>;

	beforeAll(async () => {
		darkTheme = await getThemeByName("dark");
		if (!darkTheme) throw new Error("Failed to load dark theme");
		setThemeInstance(darkTheme);
	});

	const stripAnsi = (lines: readonly string[]): string =>
		lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, "")).join("\n");

	const ts = Date.now() - 65_000;
	const message = {
		role: "custom" as const,
		customType: "channel:incoming",
		content: '<channel source="nats">hello from tauceti</channel>',
		display: true,
		details: {
			source: "nats",
			from: "claude-c860e6d3",
			fromName: "tauceti",
			text: "line one\nline two\nline three\nline four\nline five",
			custom_flag: "on",
		},
		timestamp: ts,
	};

	it("names the channel source and sender in the header", () => {
		const joined = stripAnsi(buildChannelMessageCard(message, () => false).render(120));
		expect(joined).toContain("nats");
		expect(joined).toContain("tauceti");
	});

	it("stamps the header with an absolute day/month hh:mm:ss receive time", () => {
		const joined = stripAnsi(buildChannelMessageCard(message, () => false).render(120));
		expect(joined).toMatch(/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
		expect(joined).not.toContain("ago");
	});

	it("shows the full body when collapsed for short messages", () => {
		const short = {
			...message,
			details: { ...message.details, text: "just a ping" },
		};
		const joined = stripAnsi(buildChannelMessageCard(short, () => false).render(120));
		expect(joined).toContain("just a ping");
		expect(joined).not.toContain("more lines");
	});

	it("falls back to generic source and ? sender when details are absent", () => {
		const bare = { ...message, details: undefined };
		const joined = stripAnsi(buildChannelMessageCard(bare, () => false).render(120));
		expect(joined).toContain("channel");
		expect(joined).toContain("?");
	});

	it("collapses the body to a bounded preview and hides attributes", () => {
		const joined = stripAnsi(buildChannelMessageCard(message, () => false).render(120));
		expect(joined).toContain("line one");
		expect(joined).not.toContain("line five");
		expect(joined).not.toContain("custom_flag:");
	});

	it("shows the full body and every details attribute when expanded", () => {
		const joined = stripAnsi(buildChannelMessageCard(message, () => true).render(200));
		expect(joined).toContain("line five");
		expect(joined).toContain("from: claude-c860e6d3");
		expect(joined).toContain("fromName: tauceti");
		expect(joined).toContain("custom_flag: on");
	});
});
