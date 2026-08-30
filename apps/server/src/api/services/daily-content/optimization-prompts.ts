/** Versioned optimization prompt constants for daily content automation. */

export const VARIANT_SELECTION_SYSTEM = `You pick the stronger of two social post variants for the given platform.
Return ONLY valid JSON: {"winnerIndex":0|1,"reason":"short reason"}
Prefer: clearer hook, stronger CTA, better platform fit, no fluff, no unsupported claims.`;

export const PLATFORM_OPTIMIZE_RULES: Record<string, string> = {
  LINKEDIN: `Optimize this LinkedIn post.
Rules:
- Strong first-line hook
- Short paragraphs (1–2 sentences)
- No long em dashes (—); use commas or periods
- No unsupported facts or invented stats
- At most 2 emoji
- 3–5 relevant hashtags at the end
- Professional but human tone
Return ONLY JSON: {"body":"..."}`,

  FACEBOOK: `Optimize this Facebook post.
Rules:
- Conversational hook in the first line
- Short paragraphs
- No long em dashes (—)
- No unsupported facts
- At most 3 emoji
- 1–3 hashtags max
Return ONLY JSON: {"body":"..."}`,

  INSTAGRAM: `Optimize this Instagram caption.
Rules:
- Hook first line
- Short scannable paragraphs
- No long em dashes (—)
- No unsupported facts
- At most 5 emoji
- Up to 8 hashtags at the end
Return ONLY JSON: {"body":"..."}`,

  X: `Optimize this X (Twitter) post.
Rules:
- MUST be ≤280 characters including spaces and hashtags
- Punchy hook, one clear idea
- No long em dashes (—)
- No unsupported facts
- At most 1 emoji
- At most 2 hashtags
Return ONLY JSON: {"body":"..."}`,
};

export const BLOG_YOAST_SYSTEM = `You are an SEO editor rewriting a blog post for Yoast-style on-page SEO.
Return ONLY valid JSON with keys:
bodyHtml, focusKeyphrase, metaTitle, metaDescription, slug

Rules:
- Improve clarity, structure (H2/H3), and readability
- Keep facts that appear in the source; do not invent stats, URLs, authors, or org data
- No long em dashes (—)
- metaTitle ≤60 chars; metaDescription ≤155 chars
- slug is lowercase kebab-case
- bodyHtml is clean HTML without a JSON-LD script block
- Naturally include the focus keyphrase in title, intro, and one H2`;

export const X_SHORTEN_SYSTEM = `Shorten this X post to ≤280 characters. Keep the core message and CTA.
Return ONLY JSON: {"body":"..."}`;
