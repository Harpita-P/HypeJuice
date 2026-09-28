// Stable reusable story patterns; finished wording lives on individual video jobs.
// Based on the founder's 80-format library. Examples are directions, not app facts.
const groups = [
  ["discovery", [
    ["Late discovery", "Wish I had found this earlier; don't invent years spent struggling."],
    ["Why nobody told me", "Surprise at a supported capability."],
    ["Wait, that exists?", "An app for my recognizable problem."],
    ["Where was this", "Wish this had been around for a familiar situation."],
    ["Accidental find", "Unexpected discovery while exploring a use case."],
    ["Buried treasure", "An overlooked use case; don't claim nobody uses the app."],
    ["The hard way", "My manual workaround versus a supported app action."],
    ["Unexpected feature", "Basic expectation then a real extra feature."],
    ["Hidden in plain sight", "Wish someone had shown me before a recurring situation."],
    ["Friend put me on", "Conversational recommendation framing; never invent a friend's endorsement."],
  ]],
  ["skepticism", [
    ["Downloaded for X, stayed for Y", "Contrast two supported features or benefits."],
    ["Unfortunately it worked", "Reluctant approval of an observable action, not invented results."],
    ["Thought it was silly", "Playful skepticism followed by an understandable use."],
    ["Okay, I get it", "Recognition of why the feature is useful."],
    ["Prove me wrong", "Doubt then a useful action on screen."],
    ["Not another app", "Reluctance about adding another category app."],
    ["The feature that got me", "One concrete feature wins attention."],
    ["Low expectations", "Modest expectations, small observable payoff."],
    ["Sounds fake", "An unusual supported premise followed by the demo."],
    ["Hate that I like it", "Self-aware affection for an unexpected feature."],
  ]],
  ["relatable-chaos", [
    ["Breaking point", "A recognizable annoying task; no made-up frequency."],
    ["Recurring cycle", "Familiar recurring problem and a small change."],
    ["Late-night brain", "Tired brain facing an ordinary task."],
    ["Too many tabs", "Overcomplicated workaround; avoid invented metrics."],
    ["Group chat problem", "Planning chaos only if relevant to the app."],
    ["Keep forgetting", "Remembering an everyday task too late."],
    ["Avoiding it", "Pretending a familiar problem doesn't exist."],
    ["Shouldn't take this long", "Frustration with friction, no invented time savings."],
    ["Tiny inconvenience", "Small annoyance becomes the final straw."],
    ["Called out", "App playfully addresses my recognizable habit."],
  ]],
  ["small-wins", [
    ["Tiny win, big feelings", "Pride in a visible small accomplishment."],
    ["Finally finished", "A task gets done; no invented timeline."],
    ["One less thing", "One less ordinary task to think about."],
    ["Easier than expected", "Visible simplicity; only use verified timing."],
    ["First time without friction", "Contrast ordinary friction with the shown action."],
    ["Look what I made", "React to an actual output the demo supports."],
    ["Oddly satisfying", "App interaction is satisfying to watch."],
    ["Quiet upgrade", "A routine becomes a little simpler, not life-changing."],
    ["Future me", "Doing a small useful thing for later."],
    ["Proof on screen", "Let a supported visible result explain the appeal."],
  ]],
  ["character-game", [
    ["Doing it for the character", "Only for apps with a documented character encouraging tasks."],
    ["Emotionally attached", "Affection for a real in-app virtual character."],
    ["Can't disappoint them", "Playful motivation from a documented character."],
    ["Side quest", "A task framed as an actual in-app quest mechanic."],
    ["Tiny reward", "Only use a documented app reward."],
    ["Character gets it", "Playful rapport with a documented character, no health claims."],
    ["Protect them", "Affection for a character that really exists in the app."],
    ["Game mechanic reveal", "Reveal a documented gamification feature."],
    ["Pet over productivity", "Only if app pet care and task completion are real features."],
    ["Unexpected motivation", "Tiny character motivation, not guaranteed behavior change."],
  ]],
  ["identity", [
    ["Specific person", "First-person recognizable habit, no stereotypes."],
    ["You know who you are", "We share an ordinary recognizable problem."],
    ["Found my people", "App fits a supported use case or behavior."],
    ["Specific POV", "First-person audience situation."],
    ["Two types of people", "Organized behavior versus my messy workaround."],
    ["Not just me", "Invite recognition of a familiar habit."],
    ["Sounds familiar", "My routine has a messy workaround."],
    ["The friend who", "Relatable friend-group role, not a fabricated testimonial or forced CTA."],
    ["I am the target audience", "Self-recognition in a use case."],
    ["Niche appreciation", "Specific feature appreciation without exclusion or stereotypes."],
  ]],
  ["self-aware", [
    ["Not me", "Playfully unexpected behavior around a supported feature."],
    ["I fear", "Lightly dramatic recognition, no unsupported outcome."],
    ["Be so serious", "Realizing my manual workaround is unnecessary."],
    ["The way", "A small supported feature helps an ordinary situation."],
    ["Respectfully", "Wish I knew about a supported feature sooner."],
    ["Need to discuss", "Can we talk about this concrete app action."],
    ["No because", "A feature matches my specific need."],
    ["Being influenced", "Reluctant curiosity about a real feature."],
    ["Mildly dramatic", "An afternoon inconvenience, not a life-changing claim."],
    ["Owe an apology", "Playful revision of my expectations; no invented endorsement."],
  ]],
  ["visual-reveal", [
    ["Show then explain", "Set up the forthcoming demo; preserve creator-first ordering."],
    ["Watch what happens", "Describe a supported action in the paired demo."],
    ["Before the reveal", "Real app input then a supported output."],
    ["Transformation", "Only if the paired demo shows the before and after."],
    ["Guess the tap", "Curiosity about a tap the paired demo actually supports."],
    ["Reaction reveal", "Match saved creator reaction to a supported app moment."],
    ["Old way, new way", "Textual comparison only; don't request split-screen editing."],
    ["Satisfying sequence", "A short task supported by the existing demo."],
    ["Look at the detail", "A visible documented detail; don't require a new zoom or shot."],
    ["Just show it", "First-person setup for the supported app feature."],
  ]],
] as const;

export const UGC_FORMATS = groups.flatMap(([category, patterns], group) => patterns.map(([name, guidance], index) => ({
  id: `ugc-${String(group * 10 + index + 1).padStart(2, "0")}`, category, name, guidance,
})));
export function formatCategory(id?: string) { return UGC_FORMATS.find((format) => format.id === id)?.category; }
// Least-used families first, then least-used patterns; writer still checks app/footage fit.
export function prioritizedFormats(previousIds: string[]) {
  const recent = previousIds.slice(-40);
  const count = (id: string) => recent.filter((old) => old === id).length;
  const categoryCount = (category: string) => recent.filter((id) => formatCategory(id) === category).length;
  return [...UGC_FORMATS].sort((a, b) => categoryCount(a.category) - categoryCount(b.category) || count(a.id) - count(b.id));
}
