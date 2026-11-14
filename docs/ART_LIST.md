# Mend art list

For Erin (or whoever makes the art). Written 2026-11-14. This is the artwork the new look needs, in the order it is needed. Nothing here is built into the app yet.

## The look we agreed on
A **blend**: clean flat rounded tiles on a warm cream base, with **pixel-art touches** for the characters, objects and village. Screens first: Today, then Progress, then Village. Pixel-style font for big headlines only; everything people read stays in the normal readable font.

The reference screenshots you shared are other companies' apps. **Do not copy their art, characters, names or wording.** Take the feeling (cozy, chunky, warm, a friendly companion), not the pictures.

## Rules for every piece
1. **Original.** Made by you, or by an artist with a written agreement that allows commercial use in a public app and lets us edit and recolor it. If you use an AI image tool, check that tool's terms for commercial use and **keep a record** (see "Keep a record" below). Nothing traced from another app, and nothing from Minecraft or any other game.
2. **Pixel art at native size.** Draw each piece at exactly the size in the list, with **no smoothing, no blur and no scaling**. Save as **PNG with a transparent background**. I will enlarge them in whole-number steps in my own tools, so please do not scale them yourself.
3. **No words or numbers inside the pictures.** Text in a picture cannot be read by VoiceOver and does not grow with large text. I will add the words in the app.
4. **No flashing, no sad or scary faces, no "failure" poses.** Mend never shames. Characters are warm and calm, and look like a respectful adult app, not a children's game.
5. **No people for now.** Rook and objects only, so no real person is pictured. (Decide later if people should appear.)
6. **Use the shared palette** in `docs/art/mend-palette.hex` (a `.hex` file that many pixel tools can import; a swatch picture is in `docs/art/mend-palette.png`). Add at most 6 extra colors for things like wood, brick or feathers, and tell me which. Outlines use `ink`.
7. **Dark outline, light inside.** Each piece gets a 1-pixel `ink` outline. I will place the pieces on a light panel so they read in dark mode too.
8. **Stills first.** One frame each. Small animations (a blink, a settle) can come later, and they always switch off with Reduce Motion.

## What to make, in batches
Names matter: the app finds each picture by its file name. Use exactly these names, lower case, `.png`.

### Batch 1: the three room scenes (3 pieces) and Rook (done). Start with the room scenes.
**Rook is done (2026-11-14).** Rook is the character in the app icon, and Erin supplied five poses (idle, wave, cheer, proud, thinking), now in `assets/images/rook/`. They are smooth cartoon art, not pixel art, so **Rook stays a smooth cartoon** and the rest of the world is flat tiles with simple drawings. That settles the style question: pixel-style art is now only a headline font plus any small touches Erin chooses to draw. Optional extra poses: `rook-sleepy` (quiet or empty screens) and `rook-idle-blink`.

| File | Native size | What it shows |
|---|---|---|
| `room-bathroom.png` | 96 x 64 | A small bathroom scene (tub, sink, mirror, toilet). |
| `room-kitchen.png` | 96 x 64 | A small kitchen scene (stove, sink, fridge, counter). |
| `room-laundry.png` | 96 x 64 | A small laundry scene (washer, dryer, basket, shelf). |

The room scenes sit on a flat colored tile (teal, orange or plum), so draw on a transparent background using mostly `paper`, `cream` and `ink`, with small touches of color.

*Optional extras for Batch 1:* `rook-sleepy.png` (for quiet or empty screens), `rook-idle-blink.png` (the idle pose with eyes closed), and rooms for chores added later: `room-bedroom.png`, `room-living.png`, `room-outside.png`, `room-general.png` (all 96 x 64).

### Batch 2: mission objects and the three reward icons (21 pieces)
These replace the simple drawings I made as placeholders. Each is 32 x 32, named `object-` plus the icon key the app already uses.

`object-basket.png` (laundry basket), `object-bath.png` (bathtub), `object-bottle.png` (cleaning bottle), `object-cabinet.png`, `object-clothes.png` (folded stack), `object-dishes.png` (stack of plates), `object-door.png`, `object-fridge.png`, `object-heat.png` (stovetop), `object-mirror.png`, `object-paper.png` (toilet paper roll), `object-shirt.png`, `object-sink.png`, `object-soap.png`, `object-sponge.png`, `object-toilet.png`, `object-trash.png` (trash can), `object-wash.png` (washing machine).

| File | Native size | What it shows |
|---|---|---|
| `icon-xp.png` | 24 x 24 | The experience points symbol (a star or spark). |
| `icon-emerald.png` | 24 x 24 | The reward gem. **Make your own gem shape**, not the Minecraft emerald. |
| `icon-block.png` | 24 x 24 | A building block (a small cube) for the village. |

*Optional extras:* more everyday objects for chores added later, each 32 x 32: `object-broom.png`, `object-mop.png`, `object-vacuum.png`, `object-towel.png`, `object-hamper.png`, `object-plant.png`, `object-watering-can.png`, `object-bed.png`, `object-window.png`, `object-spray.png`, `object-bucket.png`, `object-gloves.png`.

### Batch 3: the village and the badges (27 pieces)
Each structure grows through 6 stages, from a bare plot (stage 0) to finished (stage 5). **Every stage of one structure uses the same 64 x 64 canvas, with the base sitting on the same ground line near the bottom (around y = 58)**, so the stages line up and the building seems to grow in place. Draw them on transparent backgrounds.

| Structure | Files | Stage notes (from the app's story lines) |
|---|---|---|
| Fountain | `village-fountain-0.png` … `village-fountain-5.png` | 0 dry stone basin waits; 1 basin cleaned and set level; 2 a pipe laid beneath; 3 clear water begins to trickle; 4 a stone rim built around the pool; 5 the fountain runs bright and steady. |
| Bakehouse | `village-bakehouse-0.png` … `-5.png` | 0 a bare corner waits; 1 a brick oven base; 2 the oven walls built; 3 a chimney rises above the roof; 4 the first loaf set to rise; 5 warm bread smell fills the square. |
| Windmill | `village-windmill-0.png` … `-5.png` | 0 a windy rise marked out; 1 a round stone base; 2 the tower walls go up; 3 the cap lifted into place; 4 the sails raised; 5 the windmill turns in the breeze. |

| File | Native size | What it shows |
|---|---|---|
| `village-ground.png` | 16 x 16 | A grass tile that repeats without a visible seam. |
| `village-path.png` | 16 x 16 | A path tile that repeats without a visible seam. |
| `badge-first-mission.png` | 32 x 32 | A flag. |
| `badge-first-quest.png` | 32 x 32 | A seal or ribbon. |
| `badge-first-block.png` | 32 x 32 | A block. |
| `badge-three-days.png` | 32 x 32 | A calendar. |
| `badge-level-2.png` | 32 x 32 | A level marker. |
| `badge-emeralds-25.png` | 32 x 32 | The gem. |
| `badge-locked.png` | 32 x 32 | A plain outline shape for a badge not earned yet. (The app also says "not earned yet" in words.) |

*Optional extras:* small village decorations, each 16 to 32 px, same ground line: `village-tree.png`, `village-bush.png`, `village-flowers.png`, `village-bench.png`, `village-lamp.png`.

### Later (not needed yet)
- **Weekly jar** (the Weekly Chest idea): `jar-0.png` to `jar-4.png`, 48 x 48: empty, a quarter, half, three quarters, full.
- **Reward shop:** `reward-treat.png`, `reward-movie.png`, `reward-tv.png`, `reward-outside.png`, `reward-game-night.png` (32 x 32 each), and a shelf background (96 x 120).
- **A cutaway house or a larger village scene** as the Village home screen. This is the biggest piece of art, so we decide after the first batches show how it looks.

## Suggested order
Batch 1 first (the room scenes). It lets me rebuild Today with real art for the tiles. Then Batch 2, which improves the mission screen. Then Batch 3 for Progress and Village. You don't need to finish a batch before starting the next, but please settle Rook's design before drawing the other poses.

## How to deliver
Put the files in one new folder (for example `~/Desktop/mend-art`) and tell me the path. I read them as data only, check the names and sizes against this list, enlarge them in whole-number steps, and add them to the app. Please do not put anything else in that folder.

## Keep a record
For each piece, note **who made it, when, with what tool, and under what permission**. If an AI tool was used, write down which tool, its terms for commercial use at the time, and the prompt or source. I will keep this as `docs/ART_CREDITS.md`. It is important because the repo and the app will be public.

## What I'm handling
- The pixel-style **font** for headlines (a font with an open license such as the SIL Open Font License; I will check and record its license before bundling it).
- All the **screens, tiles, borders and shadows** (these are drawn in code, not art).
- **Descriptions** for each picture, so VoiceOver can read what it shows.
- Scaling the pixel art cleanly and testing that files have the right names and sizes.
