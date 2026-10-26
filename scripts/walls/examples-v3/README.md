# Pulse walls (illustrated set)

Made with Figma AI (`generate_image`, model `gemini-3.1-flash-image`, 1152x2048 requested → 768x1376) in
https://www.figma.com/design/9BKbOalGnXLJahZ9RMtqQX, then saved as JPEG (quality 82) to
`assets/images/walls/<file>.jpg` and listed in `src/lib/walls.ts` (`art`). Full-size PNGs stay local.

Style prefix for every prompt:
"Vertical phone wallpaper, detailed illustrated comic / painterly style with bold ink outlines, 1980s New York
street culture, dark night palette of deep purple with neon lime green, cyan blue and warm orange accents."
Suffix: "Rich texture and detail. No people, absolutely no readable words or letters anywhere, no logos.
Darker calm area in the middle."

| id | unlock | file | scene | status |
|---|---|---|---|---|
| alley | rank 1 | alley.jpg | back-alley boxing gym | done |
| handball | rank 2 | handball.jpg | graffiti handball wall | done |
| court | rank 3 | court.jpg | fenced street basketball court | done |
| bodega | rank 4 | bodega.jpg | corner bodega | done |
| hydrant | rank 5 | hydrant.jpg | brownstone block, open hydrant | done |
| rooftop | rank 6 | rooftop.jpg | rooftop gym, skyline sunset | done |
| platform | rank 7 | platform.jpg | subway platform, punching bag | done |
| nightTrain | rank 8 | night-train.jpg | graffiti subway car interior | done |
| yard | rank 9 | yard.jpg | train yard with graffiti trains, floodlights | done |
| bridge | rank 10 | bridge.jpg | boxing ring under a steel bridge, barrel fire | done |
| arcade | rank 11 | arcade.jpg | basement neon arcade | done |
| club | rank 12 | club.jpg | underground dance club, light-up floor, DJ booth | done |
| square | rank 13 | square.jpg | Times-Square-like billboard square in the rain | done |
| hall | rank 14 | hall.jpg | champions' boxing hall, trophies | done |
| tower | rank 15 | tower.jpg | penthouse gym at the top of a tower, gold and neon city below | done |
| underground | 7-day streak | underground.jpg | the user's own subway tunnel art | done |
| video | 14-day streak | video.jpg | 80s VHS rental store | done |
| boardwalk | 30-day streak | boardwalk.jpg | Coney-Island-like boardwalk at night, rides | done |
| diner | 60-day streak | diner.jpg | rainy neon diner, chrome counter | todo |
| rink | 100-day streak | rink.jpg | roller-skating rink, disco lights | todo |
| fireworks | 180-day streak | fireworks.jpg | pier under a big bridge, fireworks | todo |
| goldLine | 365-day streak | gold-line.jpg | golden graffiti subway train in a gleaming station | todo |
| records | 50 days logged | records.jpg | record shop with crates and listening booth | todo |
| radio | 125 days logged | radio.jpg | late-night radio station booth over the city | todo |
| highway | 250 days logged | highway.jpg | synthwave highway at midnight, retro sports car | todo |
| laser | gold chest | laser.jpg | laser tag arena | todo |
| pool | gold chest | pool.jpg | smoky pool hall | todo |
| skate | gold chest | skate.jpg | night skate bowl under streetlights | todo |
| carwash | gold chest | carwash.jpg | neon car wash at night | todo |
| helipad | gold chest | helipad.jpg | rooftop helipad over the city at night | todo |

## Coach portraits

Done 2026-10-25 (896x1200 → `assets/images/coaches/<id>.jpg`, 480 px wide), wired in `PORTRAITS` in
`src/lib/personas.ts`.

## App icons

Done 2026-10-25: the bold P and heartbeat over a crop of an illustrated wall, drawn by
`scripts/app-icons/illustrated.html` and rendered with `OUT=assets/app-icons scripts/render-icons.sh`
(also writes the thumbs and `assets/images/icon.png` for Classic). Native change: prebuild before building.

## Avatars (planned, examples first)

The user wants avatars in the same illustrated quality: 80s items and characters. Plan: 24 avatars in
`src/lib/avatars.ts` (keep the existing 11 ids so saved picks still work; 'tag' stays the free initial).
Square 1024x1024, subject centered and filling the frame so it reads inside a small round frame, comic /
painterly ink style, the walls' purple, lime, cyan and orange palette, simple dark background, no text.

- Items: spray can, cassette, boombox, arcade token, high-top sneaker, microphone, subway train, gold
  crown (chest), skull (chest), Walkman, roller skate, VHS tape.
- Characters (diverse, respectful): b-boy breakdancer, graffiti writer in a respirator mask, roller-disco
  skater, punk with a mohawk, aerobics instructor, arcade kid with headphones, boxer, skateboarder, DJ,
  breakdancing robot (chest), synthwave cyborg (chest), neon ninja (chest).

First batch for approval (Oct 26): 3 items (boombox, cassette, high-top sneaker) and 3 characters (b-boy,
roller-disco skater, synthwave cyborg).
