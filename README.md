# SOLMARA HEAT — Open-World Crime Game

![make.fun](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/renprayoga/solmara-heat/rank.svg)
![reward](https://make.fun/badge/gta6-01/renprayoga/solmara-heat/reward.svg)

**Solmara Heat** is an original open-world crime game built from scratch for
the make.fun bounty **gta6-01**. No names, characters, vehicles, songs or
assets from any commercial game — the city of **Solmara**, its people,
cars and story are all invented here.

## The story
You are **Dario Voss**, a street courier fresh out of prison. Fixer **Rico Marlowe**
waits for you at the pier with four jobs — and harbour boss **Mara Kade** has her
own plans for you. Deliver the package, outrun the police, steal Mara's dream car,
and end it all on the rooftop of Solmara Tower at sunset.

## The city
A sun-soaked modern coastal city, procedurally built: a 5×5 road grid of
building blocks with lit windows, sidewalks, street lamps and palm trees, a
sandy beach, the sea, a pier and a harbour — all under a sunset sky with the
Solmara Tower beacon blinking over downtown.

## What you can do
- **Explore on foot** — third-person WASD + mouse camera, run (Shift), jump (Space).
- **Steal and drive cars** — press E near any parked car. Six original models
  (Solmara Sedan, Vortex GT, Taxi Kuning, Cargo Van, City Cruiser, Sunset Coupe)
  with arcade handling, chase camera, skid marks and engine sound.
- **Traffic & pedestrians** — AI cars cruise the road grid and yield to you;
  pedestrians stroll the sidewalks and flee from speeding cars.
- **Wanted level 1–5** — stealing, hitting people and shooting raise your stars.
  Police interceptors chase and ram you; foot cops chase you down and bust you
  if you are slow. Hide until the heat cools off.
- **4 chained story missions** with dialogue, objective beacons, a minimap
  marker and cash rewards: deliver a package, escape the police, steal a sports
  car for Mara, and the final rooftop showdown.
- **Combat** — fists (F / 1) and pistol (2 + click) against thugs with HP bars.
- **HUD + minimap** — wanted stars, cash, health, speedometer, mission tracker,
  objective compass arrow and a live minimap (player, cars, police, objective, north).
- **Start screen, pause, save/load** — progress saves to localStorage.
- **Polish** — particles, muzzle-flash tracers, skid marks, synthesised WebAudio
  SFX (engine, gunshots, sirens) and a sunset bass-line music loop. No audio or
  image files, no network requests — everything is generated locally.

## Controls
| Key | Action |
| --- | --- |
| WASD | Walk / drive |
| Mouse (drag / pointer lock) | Camera |
| Shift | Run |
| Space | Jump |
| E | Enter / steal car, interact, advance dialogue |
| Click | Shoot (pistol) / punch |
| F | Punch |
| 1 / 2 | Fists / pistol |
| P / Esc | Pause |
| M | Mute |

## Play it
```sh
node serve.ts        # then open http://localhost:8080
```
Screenshots are deterministic: `?shot=cover|street|drive|mission` stages each scene.

## Tech
three.js (vendored minified build under `game/vendor/`), plain ES modules, no
build step, no network requests. Source is split by job:
`city`, `player`, `vehicles`, `traffic`, `police`, `missions`, `combat`,
`hud`, `audio`, `shots`, `util`, `main`.
