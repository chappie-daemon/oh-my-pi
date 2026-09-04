/** @jsxImportSource @oh-my-pi/pi-tui */
/**
 * `channel:incoming` messages (a bridge plugin's inbound traffic): a
 * dedicated card headed by the channel source, the sender and the absolute
 * receive time; the body folds to three rows while collapsed and shows every
 * remaining `details` entry under `attributes` once expanded.
 */
import { describe, expect, test } from "bun:test";
import { createRoot, isUiNode, type Reactive, signal } from "@oh-my-pi/pi-tui";
import { paintNode, staticEnvironment } from "@oh-my-pi/pi-tui/term/paint";
import { stripEscapes } from "@oh-my-pi/pi-tui/text/ansi";
import { loadThemeSync } from "@oh-my-pi/pi-tui/theme/loader";
import type { ChannelIncomingDetails } from "../../../../src/session/transcript/messages";
import { type ChannelIncomingProps, ChannelIncoming } from "../../../../src/ui/transcript/messages/channel-message";

const env = staticEnvironment(loadThemeSync("dark"));
/** 9 April 2026, 14:05:07 local time. */
const AT = new Date(2026, 3, 9, 14, 5, 7).getTime();

const details: ChannelIncomingDetails = {
	source: "nats",
	from: "claude-c860e6d3",
	fromName: "tauceti",
	text: "line one\nline two\nline three\nline four\nline five",
	custom_flag: "on",
};

const message: ChannelIncomingProps["message"] = {
	customType: "channel:incoming",
	content: '<channel source="nats">hello from tauceti</channel>',
	details,
	timestamp: AT,
};

/** The card's plain rows, joined. */
function rows(card: ChannelIncomingProps["message"], expanded: Reactive<boolean>, width: number): string {
	return createRoot(dispose => {
		try {
			const node = <ChannelIncoming message={card} expanded={expanded} />;
			if (!isUiNode(node)) throw new Error("expected one card node");
			return paintNode(env, node, width)
				.rows.map(row => stripEscapes(row).trimEnd())
				.join("\n");
		} finally {
			dispose();
		}
	});
}

describe("channel incoming card", () => {
	test("names the channel source and sender in the header", () => {
		const painted = rows(message, signal(false), 100);
		expect(painted).toContain("nats");
		expect(painted).toContain("tauceti");
	});

	test("stamps the header with an absolute day/month hh:mm:ss receive time", () => {
		const painted = rows(message, signal(false), 100);
		expect(painted).toContain("09/04 14:05:07");
		expect(painted).not.toContain("ago");
	});

	test("shows a short body in full while collapsed", () => {
		const short = { ...message, details: { ...details, text: "just a ping" } };
		const painted = rows(short, signal(false), 100);
		expect(painted).toContain("just a ping");
		expect(painted).not.toContain("more lines");
	});

	test("falls back to a generic source and sender when details are absent", () => {
		const painted = rows({ ...message, details: undefined }, signal(false), 100);
		expect(painted).toContain("channel");
		expect(painted).toContain("?");
		expect(painted).toContain("hello from tauceti");
	});

	test("collapses a long body to a bounded preview and hides the attributes", () => {
		const painted = rows(message, signal(false), 100);
		expect(painted).toContain("line one");
		expect(painted).not.toContain("line five");
		expect(painted).toContain("… 2 more lines");
		expect(painted).not.toContain("custom_flag:");
	});

	test("shows the full body and every details attribute when expanded", () => {
		const painted = rows(message, signal(true), 200);
		expect(painted).toContain("line five");
		expect(painted).toContain("from: claude-c860e6d3");
		expect(painted).toContain("fromName: tauceti");
		expect(painted).toContain("custom_flag: on");
	});
});
