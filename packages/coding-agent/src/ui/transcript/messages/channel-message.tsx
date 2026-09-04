/** @jsxImportSource @oh-my-pi/pi-tui */
/**
 * Incoming channel messages: what a bridge plugin (NATS, Telegram, an
 * IRC-style bridge) injects as a `channel:incoming` custom message. A
 * bordered card heads with the channel source, the sender and the absolute
 * receive time; the body is the message's plain text, folded to three rows
 * while collapsed. Expanded, the body shows in full and every other
 * `details` entry joins it under an `attributes` section.
 *
 * The card draws `details.text` (or the content when that is a string), never
 * the model-visible wire form in `content`.
 *
 * Terminal look: the generic `card` painter; role `omp.channel.incoming`.
 */
import type { JSXNode, Reactive } from "@oh-my-pi/pi-tui";
import { replaceTabs } from "@oh-my-pi/pi-tui/text/width";
import { currentTheme } from "@oh-my-pi/pi-tui/theme/runtime";
import type { TspSpan } from "@oh-my-pi/pi-wire";
import type { ChannelIncomingDetails } from "../../../session/transcript/messages";
import { cleanText } from "../../tools/agent-common";
import { cardExpansion } from "../expansion";
import type { FramedMessage } from "./frame";

/** Body rows a collapsed card shows before its `… N more lines` row. */
const COLLAPSED_CHANNEL_BODY_LINES = 3;

/** An absolute receive time as `dd/mm hh:mm:ss`; empty without one. */
function channelTimestamp(at: number | undefined): string {
	if (!at) return "";
	const date = new Date(at);
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** A `channel:incoming` message. */
export interface ChannelIncomingProps {
	readonly message: FramedMessage & {
		readonly details?: unknown;
		readonly timestamp?: number;
	};
	/** The transcript-wide expansion. */
	readonly expanded: Reactive<boolean>;
	readonly onToggle?: (expanded: boolean) => void;
}

/** `details` entries other than the body, as `key`/`value` pairs. */
function channelAttributes(details: ChannelIncomingDetails | undefined): Array<[string, string]> {
	if (!details) return [];
	return Object.entries(details)
		.filter(([key, value]) => key !== "text" && value !== undefined && value !== "")
		.map(([key, value]) => [key, cleanText(String(value))]);
}

/** An incoming channel message as a card; `expanded` is the transcript's expand state. */
export function ChannelIncoming(props: ChannelIncomingProps): JSXNode {
	const details = props.message.details as ChannelIncomingDetails | undefined;
	const source = cleanText(details?.source?.trim() || "channel");
	const sender = cleanText(details?.fromName?.trim() || details?.from?.trim() || "?");
	const stamp = channelTimestamp(props.message.timestamp);
	const body = replaceTabs(details?.text ?? (typeof props.message.content === "string" ? props.message.content : ""));
	const attributes = channelAttributes(details);
	const { expanded, toggle } = cardExpansion(props.expanded, props.onToggle);
	const head = (): TspSpan[] => {
		const theme = currentTheme();
		const spans: TspSpan[] = [
			{ t: `${theme.symbols.icon("icon.package")} `, s: "dim" },
			{ t: source, s: "customMessageLabel strong" },
			{ t: ` ${theme.symbols.symbol("nav.selected")} `, s: "dim" },
			{ t: sender, s: "strong" },
		];
		if (stamp) spans.push({ t: `  ${stamp}`, s: "muted" });
		return spans;
	};
	const collapsible = body.trim().length > 0 || attributes.length > 0;
	return (
		<card
			role="omp.channel.incoming"
			tone="info"
			head={head}
			collapsible={collapsible}
			collapsed={() => !expanded()}
			preview={collapsible ? { lines: COLLAPSED_CHANNEL_BODY_LINES } : undefined}
			term={() => ({ source, sender, stamp, details, expanded: expanded() })}
			onToggle={toggle}
		>
			{body.trim() ? <text spans={[{ t: body }]} wrap="word" /> : undefined}
			{() =>
				expanded() && attributes.length > 0 ? (
					<section key="attributes" head={[{ t: "attributes", s: "muted" }]} role="omp.channel.attributes">
						{attributes.map(([key, value], index) => (
							<text
								key={`${index}:${key}`}
								role="omp.channel.attribute"
								spans={[
									{ t: `${key}:`, s: "dim" },
									{ t: ` ${value}`, s: "muted" },
								]}
								wrap="word"
							/>
						))}
					</section>
				) : undefined
			}
		</card>
	);
}
