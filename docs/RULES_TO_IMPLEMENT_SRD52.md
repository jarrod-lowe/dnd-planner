# SRD 5.2 Rules To Implement

This document lists rules from the [SRD 5.2](https://www.dndbeyond.com/srd) that are **not yet implemented** in the rules engine. Class features and spells are excluded — see the class and spell rule groups in `data/rule-groups/` for those.

For what _is_ implemented, see the rule groups in `data/rule-groups/dnd-5e-2024/`, `data/rule-groups/species-human/`, `data/rule-groups/class-paladin/`, and `data/rule-groups/spells/`.

---

## 1. Conditions

All 15 conditions from the SRD are defined but none have their mechanical effects enforced by the rules engine. Each condition modifies rolls, speed, abilities, or other game state, and these modifiers need to be applied automatically when a creature has the condition.

| Condition | Key Effects |
| --- | --- |
| **Blinded** | Auto-fail sight-based checks; attacks have disadvantage; attacks against you have advantage |
| **Charmed** | Can't attack the charmer; charmer has advantage on social checks against you |
| **Deafened** | Can't hear; auto-fail hearing-based checks |
| **Exhaustion** | Cumulative (1–6 levels). Each level: −2 per level on D20 Tests, −5 ft per level Speed. Level 6 = death. Long Rest removes 1 level |
| **Frightened** | Disadvantage on checks and attacks while source is in line of sight; can't willingly approach source |
| **Grappled** | Speed 0 (can't increase); disadvantage on attacks vs anyone but grappler; grappler can drag you |
| **Incapacitated** | Can't take actions, bonus actions, or reactions; can't speak; concentration broken; disadvantage on Initiative if Incapacitated when rolling |
| **Invisible** | Impossible to see without special sense; attacks against you have disadvantage; your attacks have advantage |
| **Paralysed** | Incapacitated + Speed 0; auto-fail STR/DEX saves; attacks against you have advantage; melee hits within 5 ft are critical hits |
| **Petrified** | Transformed to inanimate substance; Incapacitated + Speed 0; attacks against you have advantage; auto-fail STR/DEX saves; resistance to all damage |
| **Poisoned** | Disadvantage on attack rolls and ability checks |
| **Prone** | Disadvantage on attack rolls; advantage on attacks against you within 5 ft, disadvantage beyond; crawling costs 2x movement; standing costs half Speed |
| **Restrained** | Speed 0 (can't increase); attacks against you have advantage; your attacks have disadvantage; disadvantage on DEX saves |
| **Stunned** | Incapacitated + can't speak; auto-fail STR/DEX saves; attacks against you have advantage |
| **Unconscious** | Incapacitated + Prone; drop held items; Speed 0; attacks against you have advantage; melee hits within 5 ft are critical hits; unaware of surroundings |

## 2. Combat Rules

### Cover

Player toggles their own cover; app applies the modifier.

| Degree | AC/Dex Save Bonus |
| --- | --- |
| Half | +2 |
| Three-Quarters | +5 |

### Ready [Action]

Choose a trigger and an action to take when it occurs. Uses your Reaction when the trigger fires. Special rules for readied spells: must have casting time of 1 action, requires Concentration to hold (up to start of your next turn), spell dissipates if Concentration is broken.

### Hide [Action]

DC 15 Dexterity (Stealth) check. Must be Heavily Obscured or behind Three-Quarters/Total Cover, and out of enemies' line of sight. On success, gain the **Invisible** condition while hidden. Your check total becomes the DC for others to find you with Perception. Hidden ends if you: make a sound louder than a whisper, are found by an enemy, make an attack roll, or cast a spell with a Verbal component.

### Magic [Action]

Formal action for casting a spell with casting time of 1 action, or using a magic item/feature that requires the Magic action. Spells with casting time of 1+ minutes require taking the Magic action each turn and maintaining Concentration during casting.

### Death Saving Throws

When a player character starts their turn with 0 HP, they make a Death Saving Throw (no modifier — just a flat d20 roll):

- **Success (10+)**: Accumulate 3 successes → **Stable** (stop making saves, still Unconscious at 0 HP).
- **Failure (9 or less)**: Accumulate 3 failures → **Dead**.
- **Natural 1**: Count as 2 failures.
- **Natural 20**: Regain 1 HP (and consciousness).
- **Taking damage at 0 HP**: 1 failure. Critical hit = 2 failures. Damage ≥ HP max = instant death.

### Spending Hit Dice

During a Short Rest, you can spend one or more Hit Dice. For each die spent, roll it and add your Constitution modifier. You regain HP equal to the total (up to your max). The die is then expended until the next Long Rest. You choose how many to spend at a time.

### Temporary Hit Points

A buffer against damage. Lost before actual HP. Don't stack — if you receive new Temporary HP while having some, choose which to keep. Not actual HP; healing can't restore them. Last until depleted or a Long Rest is finished.

## 3. Damage Modifiers

### Resistance

If you have Resistance to a damage type, damage of that type is halved (round down). Resistance is applied only once per instance of damage, even if you have multiple sources. Applied in order: adjustments first → Resistance second → Vulnerability third.

### Vulnerability

If you have Vulnerability to a damage type, damage of that type is doubled. Vulnerability is applied only once per instance of damage.

### Immunity

If you have Immunity to a damage type, you take no damage of that type. You can also have Immunity to conditions — you can't gain that condition.

## 4. Movement & Exploration

### Jumping

- **High Jump**: 3 + STR modifier feet (minimum 0), with 10 ft running start. Standing high jump = half distance. Each foot costs 1 ft of movement. Can extend arms half your height above.
- **Long Jump**: STR score feet with 10 ft running start. Standing long jump = half distance. Each foot costs 1 ft of movement. Landing in Difficult Terrain requires DC 10 Dexterity (Acrobatics) or gain the **Prone** condition.

### Climbing

Costs 1 extra foot per foot moved (effectively 2× cost). A Climb Speed allows vertical movement without the extra cost. Slippery surfaces or few handholds may require DC 15 Strength (Athletics) check.

### Crawling

While Prone, you can crawl. Each foot of crawling costs 1 extra foot of movement (2× cost).

### Flying

If you have a Fly Speed and gain the Incapacitated or Prone condition, or your Fly Speed is reduced to 0, you fall. You can stay aloft if you can hover.

### Falling

1d6 Bludgeoning damage per 10 feet fallen, to a maximum of 20d6. Land with the **Prone** condition unless you avoid all damage. Falling into water: DC 15 Strength (Athletics) or Dexterity (Acrobatics) check using your Reaction to halve the damage.

### Special Speeds

- **Burrow Speed**: Move through sand, earth, mud, or ice. Can't burrow through solid rock unless feature says otherwise.
- **Climb Speed**: Traverse vertical surfaces without extra movement cost.
- **Fly Speed**: Travel through air; remain aloft until you land, fall, or die.
- **Swim Speed**: Swim without extra movement cost.

When switching between speeds during a move, subtract distance already travelled from the new speed. If an effect changes your Speed, special speeds change by the same amount.

### Carrying Capacity

A creature's carrying capacity is its Strength score multiplied by 15. This is the weight in pounds the creature can carry while still moving normally.

## 5. Species

The SRD defines 9 species. Only Human is implemented.

## 6. Backgrounds

The SRD defines 4 backgrounds. None are implemented.

## 7. Feats

Alert and Sentinel are implemented; Great Weapon Fighting is implemented as a fighting style. The rest are not.

### Origin Feats

- **Magic Initiate**: Choose Cleric, Druid, or Wizard. Learn 2 cantrips from that list. Choose 1 level 1 spell; always prepared; cast once per Long Rest without a spell slot; can also use spell slots. INT, WIS, or CHA is the spellcasting ability (choose when selected).
- **Savage Attacker**: Once per turn when you hit with a weapon, roll the weapon's damage dice twice and use either roll.
- **Skilled**: Gain 3 skill or tool proficiencies (mix and match). Repeatable.

### General Feats

- **Ability Score Improvement** (level 4+): Increase one ability score by 2, or two by 1 (max 20). Repeatable.
- **Grappler** (level 4+, STR or DEX 13+): +1 STR or DEX; Punch and Grab (Unarmed Strike can both Damage and Grapple in one hit, once per turn); Advantage on attacks vs Grappled creatures; no extra movement to move Grappled creature of your size or smaller.

### Fighting Style Feats

- **Archery**: +2 bonus to attack rolls with Ranged weapons.
- **Defence**: +1 AC while wearing Light, Medium, or Heavy armor.
- **Two-Weapon Fighting**: When making an extra attack from a weapon with the Light property, add your ability modifier to the damage.

### Epic Boon Feats

All require level 19+. Each grants +1 to one ability score (max 30) plus a special ability:

- **Boon of Combat Prowess**: Miss → hit instead (once per turn).
- **Boon of Dimensional Travel**: Teleport 30 ft after taking Attack or Magic action.
- **Boon of Fate**: After a creature within 60 ft succeeds or fails a D20 Test, roll 2d4 as bonus/penalty (once per combat/rest).
- **Boon of Irresistible Offence**: When you deal damage, you can ignore Resistance to that damage type (once per turn).
- **Boon of Spell Recall** (requires Spellcasting): When you cast a spell using a spell slot, roll a d20; on 11+ the slot isn't expended.
- **Boon of the Night Spirit**: While in Dim Light or Darkness, you can give yourself cover as a Bonus Action (+2 AC, Dex saves, and Stealth checks). Also gain Necrotic and Radiant resistance.
- **Boon of Truesight**: Truesight 60 ft.

## 8. Equipment

### Weapons

4 of ~25 weapons are implemented (dagger, greataxe, javelin, scimitar). The full weapon table includes:

**Simple Melee**: Club, Dagger ✅, Greatclub, Handaxe, Javelin ✅, Light Hammer, Mace, Quarterstaff, Sickle, Spear

**Simple Ranged**: Dart, Light Crossbow, Shortbow, Sling

**Martial Melee**: Battleaxe, Flail, Glaive, Greataxe ✅, Greatsword, Halberd, Lance, Longsword, Maul, Morningstar, Pike, Rapier, Scimitar ✅, Shortsword, Trident, Warhammer, War Pick, Whip

**Martial Ranged**: Blowgun, Hand Crossbow, Heavy Crossbow, Longbow, Musket, Pistol

### Weapon Properties

Finesse and Light are partially implemented. The following properties are not:

| Property | Effect |
| --- | --- |
| **Ammunition** | Each attack consumes one piece of ammunition. Can recover half after battle. |
| **Heavy** | Small creatures have disadvantage on attack rolls. |
| **Light** | When you take the Attack action with a Light weapon, you can make one extra attack as a Bonus Action with a different Light weapon. Don't add ability modifier to the extra attack's damage unless negative. |
| **Loading** | Can fire only once per action/bonus action/reaction, regardless of extra attacks. |
| **Range** | Two numbers: normal range and long range. Long range imposes disadvantage. |
| **Reach** | Adds 5 ft to reach for attacks and opportunity attacks. |
| **Thrown** | Can throw to make a ranged attack; draw as part of the attack. Melee weapons use same ability modifier. |
| **Two-Handed** | Requires two hands to attack. |
| **Versatile** | Can use with one or two hands; parenthesized damage when two-handed. |

### Mastery Properties

Nick (dagger, scimitar), Cleave (greataxe), and Slow (javelin) have i18n strings but are not implemented as rules engine effects. The following mastery properties are not implemented at all:

| Property | Effect |
| --- | --- |
| **Graze** | If miss but roll 10+, deal damage equal to the ability modifier used for the attack. |
| **Push** | If hit, push target 10 ft straight away (Large or smaller). |
| **Sap** | If hit, target has disadvantage on its next attack roll before your next turn. |
| **Topple** | If hit, target must succeed on a CON save or have the Prone condition (DC 8 + ability modifier + Proficiency). |
| **Vex** | If hit, gain advantage on your next attack roll against the target before your next turn. |

### Armor

2 of 10 armors are implemented (leather armor, splint armor) plus shield. The full armor table:

| Armor | AC | STR Req | Stealth | Weight | Cost |
| --- | --- | --- | --- | --- | --- |
| Padded | 11 + DEX | — | Disadvantage | 8 lb | 5 GP |
| Leather ✅ | 11 + DEX | — | — | 10 lb | 10 GP |
| Studded Leather | 12 + DEX | — | — | 13 lb | 45 GP |
| Hide | 12 + DEX (max 2) | — | — | 12 lb | 10 GP |
| Chain Shirt | 13 + DEX (max 2) | — | — | 20 lb | 50 GP |
| Scale Mail | 14 + DEX (max 2) | — | Disadvantage | 30 lb | 50 GP |
| Breastplate | 14 + DEX (max 2) | — | — | 20 lb | 400 GP |
| Half Plate | 15 + DEX (max 2) | — | Disadvantage | 40 lb | 750 GP |
| Chain Mail | 16 | STR 13 | Disadvantage | 55 lb | 75 GP |
| Splint ✅ | 17 | STR 15 | Disadvantage | 60 lb | 200 GP |
| Plate | 18 | STR 15 | Disadvantage | 65 lb | 1,500 GP |

### Armor Training

If you wear armor and lack training with it: disadvantage on any D20 Test involving STR or DEX, and you can't cast spells. If you use a Shield without training, you don't gain its AC bonus.

### Don/Doff Times

- Light armor: 1 minute to don or doff.
- Medium armor: 5 minutes to don, 1 minute to doff.
- Heavy armor: 10 minutes to don, 5 minutes to doff.
- Shield: 1 action to don or doff.

### Tools

13+ tool types, each with an associated ability check, Utilize action options, and crafting capabilities:

**Artisan's Tools** (12 types): Alchemist's Supplies, Brewer's Supplies, Calligrapher's Supplies, Carpenter's Tools, Cobbler's Tools, Cook's Utensils, Glassblower's Tools, jeweller's Tools, Leatherworker's Tools, Mason's Tools, Painter's Supplies, Potter's Tools, Smith's Tools, Tinker's Tools, Weaver's Tools, Woodcarver's Tools.

**Other Tools**: Disguise Kit, Forgery Kit, Gaming Set, Herbalism Kit, Musical Instrument, Navigator's Tools, Poisoner's Kit, Thieves' Tools, Vehicle.

### Adventuring Gear

50+ items (Acid, Alchemist's Fire, Backpack, Ball Bearings, Caltrops, Candle, Chain, Climber's Kit, Crowbar, Healer's Kit, Holy Water, Ladder, Lamp/Lantern, Lock, Manacles, Mirror, Oil, Poison, Potion of Healing, Rope, etc.).

### Coins

| Coin | Value in GP |
| --- | --- |
| Copper Piece (CP) | 1/100 |
| Silver Piece (SP) | 1/10 |
| Electrum Piece (EP) | 1/2 |
| Gold Piece (GP) | 1 |
| Platinum Piece (PP) | 10 |

A coin weighs about 1/3 oz; 50 coins = 1 lb. Equipment sells for half its cost. Trade goods retain full value.

### Crafting

- **Non-magical Items**: Use appropriate artisan's tools over days; total cost divided by 5 GP per day of crafting.
- **Brewing Potions of Healing**: Requires Herbalism Kit; 1 day per 25 GP of base cost.
- **Scribing Spell Scrolls**: Requires spell knowledge + appropriate tool; 1 day per 25 GP of base cost.

## 9. Character Advancement

### Experience Points and Levelling

| Level | XP Required | Proficiency Bonus |
| --- | --- | --- |
| 1 | 0 | +2 |
| 2 | 300 | +2 |
| 3 | 900 | +2 |
| 4 | 2,700 | +2 |
| 5 | 6,500 | +3 |
| 6 | 14,000 | +3 |
| 7 | 23,000 | +3 |
| 8 | 34,000 | +3 |
| 9 | 48,000 | +4 |
| 10 | 64,000 | +4 |
| 11 | 85,000 | +4 |
| 12 | 100,000 | +4 |
| 13 | 120,000 | +5 |
| 14 | 140,000 | +5 |
| 15 | 165,000 | +5 |
| 16 | 195,000 | +5 |
| 17 | 225,000 | +6 |
| 18 | 265,000 | +6 |
| 19 | 305,000 | +6 |
| 20 | 355,000 | +6 |

When XP equals or exceeds a threshold, the character reaches that level. Each level may grant: hit points, class features, ability score improvements, spell slot increases, etc.

### Multi-classing

- XP is based on total character level, not individual class levels.
- Hit Dice from all classes are pooled (track separately if different die types).
- Proficiency Bonus is based on total character level.
- Spell slots use the Multi-class Spellcaster table (combining caster levels).
- Pact Magic (Warlock) slots can be used for Spellcasting spells and vice versa.

### Alignment

A shorthand for a character's moral compass: Lawful Good, Neutral Good, Chaotic Good, Lawful Neutral, Neutral, Chaotic Neutral, Lawful Evil, Neutral Evil, Chaotic Evil.
