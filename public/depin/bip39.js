/**
 * BIP-39 Standard Cryptographic Mnemonic & Key Derivation Library
 * Compatible with MetaMask, Ledger, Trust Wallet (BIP-44: m/44'/60'/0'/0/0)
 */
(function(window) {
  'use strict';

  const WORDLIST = ["abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent", "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert", "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter", "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique", "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april", "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor", "army", "around", "arrange", "arrest", "arrive", "arrow", "art", "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset", "assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction", "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado", "avoid", "awake", "aware", "away", "awesome", "awful", "awkward", "axis", "baby", "bachelor", "bacon", "badge", "bag", "balance", "balcony", "ball", "bamboo", "banana", "banner", "bar", "barely", "bargain", "barrel", "base", "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become", "beef", "before", "begin", "behave", "behind", "believe", "below", "belt", "bench", "benefit", "best", "betray", "better", "between", "beyond", "bicycle", "bid", "bike", "bind", "biology", "bird", "birth", "bitter", "black", "blade", "blame", "blanket", "blast", "bleak", "bless", "blind", "blood", "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body", "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring", "borrow", "boss", "bottom", "bounce", "box", "boy", "bracket", "brain", "brand", "brass", "brave", "bread", "breeze", "brick", "bridge", "brief", "bright", "bring", "brisk", "broccoli", "broken", "bronze", "broom", "brother", "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb", "bulk", "bullet", "bundle", "bunker", "burden", "burger", "burst", "bus", "business", "busy", "butter", "buyer", "buzz", "cabbage", "cabin", "cable", "cactus", "cage", "cake", "call", "calm", "camera", "camp", "can", "canal", "cancel", "candy", "cannon", "canoe", "canvas", "canyon", "capable", "capital", "captain", "car", "carbon", "card", "cargo", "carpet", "carry", "cart", "case", "cash", "casino", "castle", "casual", "cat", "catalog", "catch", "category", "cattle", "caught", "cause", "caution", "cave", "ceiling", "celery", "cement", "census", "century", "cereal", "certain", "chair", "chalk", "champion", "change", "chaos", "chapter", "charge", "chase", "chat", "cheap", "check", "cheese", "chef", "cherry", "chest", "chicken", "chief", "child", "chimney", "choice", "choose", "chronic", "chuckle", "chunk", "churn", "cigar", "cinnamon", "circle", "citizen", "city", "civil", "claim", "clap", "clarify", "claw", "clay", "clean", "clerk", "clever", "click", "client", "cliff", "climb", "clinic", "clip", "clock", "clog", "close", "cloth", "cloud", "clown", "club", "clump", "cluster", "clutch", "coach", "coast", "coconut", "code", "coffee", "coil", "coin", "collect", "color", "column", "combine", "come", "comfort", "comic", "common", "company", "concert", "conduct", "confirm", "congress", "connect", "consider", "control", "convince", "cook", "cool", "copper", "copy", "coral", "core", "corn", "correct", "cost", "cotton", "couch", "country", "couple", "course", "cousin", "cover", "coyote", "crack", "cradle", "craft", "cram", "crane", "crash", "crater", "crawl", "crazy", "cream", "credit", "creek", "crew", "cricket", "crime", "crisp", "critic", "crop", "cross", "crouch", "crowd", "crucial", "cruel", "cruise", "crumble", "crunch", "crush", "cry", "crystal", "cube", "culture", "cup", "cupboard", "curious", "current", "curtain", "curve", "cushion", "custom", "cute", "cycle", "dad", "damage", "damp", "dance", "danger", "daring", "dash", "daughter", "dawn", "day", "deal", "debate", "debris", "decade", "december", "decide", "decline", "decorate", "decrease", "deer", "defense", "define", "defy", "degree", "delay", "deliver", "demand", "demise", "denial", "dentist", "deny", "depart", "depend", "deposit", "depth", "deputy", "derive", "describe", "desert", "design", "desk", "despair", "destroy", "detail", "detect", "develop", "device", "devote", "diagram", "dial", "diamond", "diary", "dice", "diesel", "diet", "differ", "digital", "dignity", "dilemma", "dinner", "dinosaur", "direct", "dirt", "disagree", "discover", "disease", "dish", "dismiss", "disorder", "display", "distance", "divert", "divide", "divorce", "dizzy", "doctor", "document", "dog", "doll", "dolphin", "domain", "donate", "donkey", "donor", "door", "dose", "double", "dove", "draft", "dragon", "drama", "drastic", "draw", "dream", "dress", "drift", "drill", "drink", "drip", "drive", "drop", "drum", "dry", "duck", "dumb", "dune", "during", "dust", "dutch", "duty", "dwarf", "dynamic", "eager", "eagle", "early", "earn", "earth", "easily", "east", "easy", "echo", "ecology", "economy", "edge", "edit", "educate", "effort", "egg", "eight", "either", "elbow", "elder", "electric", "elegant", "element", "elephant", "elevator", "elite", "else", "embark", "embody", "embrace", "emerge", "emotion", "employ", "empower", "empty", "enable", "enact", "end", "endless", "endorse", "enemy", "energy", "enforce", "engage", "engine", "enhance", "enjoy", "enlist", "enough", "enrich", "enroll", "ensure", "enter", "entire", "entry", "envelope", "episode", "equal", "equip", "era", "erase", "erode", "erosion", "error", "erupt", "escape", "essay", "essence", "estate", "eternal", "ethics", "evidence", "evil", "evoke", "evolve", "exact", "example", "excess", "exchange", "excite", "exclude", "excuse", "execute", "exercise", "exhaust", "exhibit", "exile", "exist", "exit", "exotic", "expand", "expect", "expire", "explain", "expose", "express", "extend", "extra", "eye", "eyebrow", "fabric", "face", "faculty", "fade", "faint", "faith", "fall", "false", "fame", "family", "famous", "fan", "fancy", "fantasy", "farm", "fashion", "fat", "fatal", "father", "fatigue", "fault", "favorite", "feature", "february", "federal", "fee", "feed", "feel", "female", "fence", "festival", "fetch", "fever", "few", "fiber", "fiction", "field", "figure", "file", "film", "filter", "final", "find", "fine", "finger", "finish", "fire", "firm", "first", "fiscal", "fish", "fit", "fitness", "fix", "flag", "flame", "flash", "flat", "flavor", "flee", "flight", "flip", "float", "flock", "floor", "flower", "fluid", "flush", "fly", "foam", "focus", "fog", "foil", "fold", "follow", "food", "foot", "force", "forest", "forget", "fork", "fortune", "forum", "forward", "fossil", "foster", "found", "fox", "fragile", "frame", "frequent", "fresh", "friend", "fringe", "frog", "front", "frost", "frown", "frozen", "fruit", "fuel", "fun", "funny", "furnace", "fury", "future", "gadget", "gain", "galaxy", "gallery", "game", "gap", "garage", "garbage", "garden", "garlic", "garment", "gas", "gasp", "gate", "gather", "gauge", "gaze", "general", "genius", "genre", "gentle", "genuine", "gesture", "ghost", "giant", "gift", "giggle", "ginger", "giraffe", "girl", "give", "glad", "glance", "glare", "glass", "glide", "glimpse", "globe", "gloom", "glory", "glove", "glow", "glue", "goat", "goddess", "gold", "good", "goose", "gorilla", "gospel", "gossip", "govern", "gown", "grab", "grace", "grain", "grant", "grape", "grass", "gravity", "great", "green", "grid", "grief", "grit", "grocery", "group", "grow", "grunt", "guard", "guess", "guide", "guilt", "guitar", "gun", "gym", "habit", "hair", "half", "hammer", "hamster", "hand", "happy", "harbor", "hard", "harsh", "harvest", "hat", "have", "hawk", "hazard", "head", "health", "heart", "heavy", "hedgehog", "height", "hello", "helmet", "help", "hen", "hero", "hidden", "high", "hill", "hint", "hip", "hire", "history", "hobby", "hockey", "hold", "hole", "holiday", "hollow", "home", "honey", "hood", "hope", "horn", "horror", "horse", "hospital", "host", "hotel", "hour", "hover", "hub", "huge", "human", "humble", "humor", "hundred", "hungry", "hunt", "hurdle", "hurry", "hurt", "husband", "hybrid", "ice", "icon", "idea", "identify", "idle", "ignore", "ill", "illegal", "illness", "image", "imitate", "immense", "immune", "impact", "impose", "improve", "impulse", "inch", "include", "income", "increase", "index", "indicate", "indoor", "industry", "infant", "inflict", "inform", "inhale", "inherit", "initial", "inject", "injury", "inmate", "inner", "innocent", "input", "inquiry", "insane", "insect", "inside", "inspire", "install", "intact", "interest", "into", "invest", "invite", "involve", "iron", "island", "isolate", "issue", "item", "ivory", "jacket", "jaguar", "jar", "jazz", "jealous", "jeans", "jelly", "jewel", "job", "join", "joke", "journey", "joy", "judge", "juice", "jump", "jungle", "junior", "junk", "just", "kangaroo", "keen", "keep", "ketchup", "key", "kick", "kid", "kidney", "kind", "kingdom", "kiss", "kit", "kitchen", "kite", "kitten", "kiwi", "knee", "knife", "knock", "know", "lab", "label", "labor", "ladder", "lady", "lake", "lamp", "language", "laptop", "large", "later", "latin", "laugh", "laundry", "lava", "law", "lawn", "lawsuit", "layer", "lazy", "leader", "leaf", "learn", "leave", "lecture", "left", "leg", "legal", "legend", "leisure", "lemon", "lend", "length", "lens", "leopard", "lesson", "letter", "level", "liar", "liberty", "library", "license", "life", "lift", "light", "like", "limb", "limit", "link", "lion", "liquid", "list", "little", "live", "lizard", "load", "loan", "lobster", "local", "lock", "logic", "lonely", "long", "loop", "lottery", "loud", "lounge", "love", "loyal", "lucky", "luggage", "lumber", "lunar", "lunch", "luxury", "lyrics", "machine", "mad", "magic", "magnet", "maid", "mail", "main", "major", "make", "mammal", "man", "manage", "mandate", "mango", "mansion", "manual", "maple", "marble", "march", "margin", "marine", "market", "marriage", "mask", "mass", "master", "match", "material", "math", "matrix", "matter", "maximum", "maze", "meadow", "mean", "measure", "meat", "mechanic", "medal", "media", "melody", "melt", "member", "memory", "mention", "menu", "mercy", "merge", "merit", "merry", "mesh", "message", "metal", "method", "middle", "midnight", "milk", "million", "mimic", "mind", "minimum", "minor", "minute", "miracle", "mirror", "misery", "miss", "mistake", "mix", "mixed", "mixture", "mobile", "model", "modify", "mom", "moment", "monitor", "monkey", "monster", "month", "moon", "moral", "more", "morning", "mosquito", "mother", "motion", "motor", "mountain", "mouse", "move", "movie", "much", "muffin", "mule", "multiply", "muscle", "museum", "mushroom", "music", "must", "mutual", "myself", "mystery", "myth", "naive", "name", "napkin", "narrow", "nasty", "nation", "nature", "near", "neck", "need", "negative", "neglect", "neither", "nephew", "nerve", "nest", "net", "network", "neutral", "never", "news", "next", "nice", "night", "noble", "noise", "nominee", "noodle", "normal", "north", "nose", "notable", "note", "nothing", "notice", "novel", "now", "nuclear", "number", "nurse", "nut", "oak", "obey", "object", "oblige", "obscure", "observe", "obtain", "obvious", "occur", "ocean", "october", "odor", "off", "offer", "office", "often", "oil", "okay", "old", "olive", "olympic", "omit", "once", "one", "onion", "online", "only", "open", "opera", "opinion", "oppose", "option", "orange", "orbit", "orchard", "order", "ordinary", "organ", "orient", "original", "orphan", "ostrich", "other", "outdoor", "outer", "output", "outside", "oval", "oven", "over", "own", "owner", "oxygen", "oyster", "ozone", "pact", "paddle", "page", "pair", "palace", "palm", "panda", "panel", "panic", "panther", "paper", "parade", "parent", "park", "parrot", "party", "pass", "patch", "path", "patient", "patrol", "pattern", "pause", "pave", "payment", "peace", "peanut", "pear", "peasant", "pelican", "pen", "penalty", "pencil", "people", "pepper", "perfect", "permit", "person", "pet", "phone", "photo", "phrase", "physical", "piano", "picnic", "picture", "piece", "pig", "pigeon", "pill", "pilot", "pink", "pioneer", "pipe", "pistol", "pitch", "pizza", "place", "planet", "plastic", "plate", "play", "please", "pledge", "pluck", "plug", "plunge", "poem", "poet", "point", "polar", "pole", "police", "pond", "pony", "pool", "popular", "portion", "position", "possible", "post", "potato", "pottery", "poverty", "powder", "power", "practice", "praise", "predict", "prefer", "prepare", "present", "pretty", "prevent", "price", "pride", "primary", "print", "priority", "prison", "private", "prize", "problem", "process", "produce", "profit", "program", "project", "promote", "proof", "property", "prosper", "protect", "proud", "provide", "public", "pudding", "pull", "pulp", "pulse", "pumpkin", "punch", "pupil", "puppy", "purchase", "purity", "purpose", "purse", "push", "put", "puzzle", "pyramid", "quality", "quantum", "quarter", "question", "quick", "quit", "quiz", "quote", "rabbit", "raccoon", "race", "rack", "radar", "radio", "rail", "rain", "raise", "rally", "ramp", "ranch", "random", "range", "rapid", "rare", "rate", "rather", "raven", "raw", "razor", "ready", "real", "reason", "rebel", "rebuild", "recall", "receive", "recipe", "record", "recycle", "reduce", "reflect", "reform", "refuse", "region", "regret", "regular", "reject", "relax", "release", "relief", "rely", "remain", "remember", "remind", "remove", "render", "renew", "rent", "reopen", "repair", "repeat", "replace", "report", "require", "rescue", "resemble", "resist", "resource", "response", "result", "retire", "retreat", "return", "reunion", "reveal", "review", "reward", "rhythm", "rib", "ribbon", "rice", "rich", "ride", "ridge", "rifle", "right", "rigid", "ring", "riot", "ripple", "risk", "ritual", "rival", "river", "road", "roast", "robot", "robust", "rocket", "romance", "roof", "rookie", "room", "rose", "rotate", "rough", "round", "route", "royal", "rubber", "rude", "rug", "rule", "run", "runway", "rural", "sad", "saddle", "sadness", "safe", "sail", "salad", "salmon", "salon", "salt", "salute", "same", "sample", "sand", "satisfy", "satoshi", "sauce", "sausage", "save", "say", "scale", "scan", "scare", "scatter", "scene", "scheme", "school", "science", "scissors", "scorpion", "scout", "scrap", "screen", "script", "scrub", "sea", "search", "season", "seat", "second", "secret", "section", "security", "seed", "seek", "segment", "select", "sell", "seminar", "senior", "sense", "sentence", "series", "service", "session", "settle", "setup", "seven", "shadow", "shaft", "shallow", "share", "shed", "shell", "sheriff", "shield", "shift", "shine", "ship", "shiver", "shock", "shoe", "shoot", "shop", "short", "shoulder", "shove", "shrimp", "shrug", "shuffle", "shy", "sibling", "sick", "side", "siege", "sight", "sign", "silent", "silk", "silly", "silver", "similar", "simple", "since", "sing", "siren", "sister", "situate", "six", "size", "skate", "sketch", "ski", "skill", "skin", "skirt", "skull", "slab", "slam", "sleep", "slender", "slice", "slide", "slight", "slim", "slogan", "slot", "slow", "slush", "small", "smart", "smile", "smoke", "smooth", "snack", "snake", "snap", "sniff", "snow", "soap", "soccer", "social", "sock", "soda", "soft", "solar", "soldier", "solid", "solution", "solve", "someone", "song", "soon", "sorry", "sort", "soul", "sound", "soup", "source", "south", "space", "spare", "spatial", "spawn", "speak", "special", "speed", "spell", "spend", "sphere", "spice", "spider", "spike", "spin", "spirit", "split", "spoil", "sponsor", "spoon", "sport", "spot", "spray", "spread", "spring", "spy", "square", "squeeze", "squirrel", "stable", "stadium", "staff", "stage", "stairs", "stamp", "stand", "start", "state", "stay", "steak", "steel", "stem", "step", "stereo", "stick", "still", "sting", "stock", "stomach", "stone", "stool", "story", "stove", "strategy", "street", "strike", "strong", "struggle", "student", "stuff", "stumble", "style", "subject", "submit", "subway", "success", "such", "sudden", "suffer", "sugar", "suggest", "suit", "summer", "sun", "sunny", "sunset", "super", "supply", "supreme", "sure", "surface", "surge", "surprise", "surround", "survey", "suspect", "sustain", "swallow", "swamp", "swap", "swarm", "swear", "sweet", "swift", "swim", "swing", "switch", "sword", "symbol", "symptom", "syrup", "system", "table", "tackle", "tag", "tail", "talent", "talk", "tank", "tape", "target", "task", "taste", "tattoo", "taxi", "teach", "team", "tell", "ten", "tenant", "tennis", "tent", "term", "test", "text", "thank", "that", "theme", "then", "theory", "there", "they", "thing", "this", "thought", "three", "thrive", "throw", "thumb", "thunder", "ticket", "tide", "tiger", "tilt", "timber", "time", "tiny", "tip", "tired", "tissue", "title", "toast", "tobacco", "today", "toddler", "toe", "together", "toilet", "token", "tomato", "tomorrow", "tone", "tongue", "tonight", "tool", "tooth", "top", "topic", "topple", "torch", "tornado", "tortoise", "toss", "total", "tourist", "toward", "tower", "town", "toy", "track", "trade", "traffic", "tragic", "train", "transfer", "trap", "trash", "travel", "tray", "treat", "tree", "trend", "trial", "tribe", "trick", "trigger", "trim", "trip", "trophy", "trouble", "truck", "true", "truly", "trumpet", "trust", "truth", "try", "tube", "tuition", "tumble", "tuna", "tunnel", "turkey", "turn", "turtle", "twelve", "twenty", "twice", "twin", "twist", "two", "type", "typical", "ugly", "umbrella", "unable", "unaware", "uncle", "uncover", "under", "undo", "unfair", "unfold", "unhappy", "uniform", "unique", "unit", "universe", "unknown", "unlock", "until", "unusual", "unveil", "update", "upgrade", "uphold", "upon", "upper", "upset", "urban", "urge", "usage", "use", "used", "useful", "useless", "usual", "utility", "vacant", "vacuum", "vague", "valid", "valley", "valve", "van", "vanish", "vapor", "various", "vast", "vault", "vehicle", "velvet", "vendor", "venture", "venue", "verb", "verify", "version", "very", "vessel", "veteran", "viable", "vibrant", "vicious", "victory", "video", "view", "village", "vintage", "violin", "virtual", "virus", "visa", "visit", "visual", "vital", "vivid", "vocal", "voice", "void", "volcano", "volume", "vote", "voyage", "wage", "wagon", "wait", "walk", "wall", "walnut", "want", "warfare", "warm", "warrior", "wash", "wasp", "waste", "water", "wave", "way", "wealth", "weapon", "wear", "weasel", "weather", "web", "wedding", "weekend", "weird", "welcome", "west", "wet", "whale", "what", "wheat", "wheel", "when", "where", "whip", "whisper", "wide", "width", "wife", "wild", "will", "win", "window", "wine", "wing", "wink", "winner", "winter", "wire", "wisdom", "wise", "wish", "witness", "wolf", "woman", "wonder", "wood", "wool", "word", "work", "world", "worry", "worth", "wrap", "wreck", "wrestle", "wrist", "write", "wrong", "yard", "year", "yellow", "you", "young", "youth", "zebra", "zero", "zone", "zoo"];
  const WORD_MAP = new Map();
  for (let i = 0; i < WORDLIST.length; i++) {
    WORD_MAP.set(WORDLIST[i], i);
  }

  // Helper: SHA-256 via Web Crypto
  async function sha256(buffer) {
    return await crypto.subtle.digest('SHA-256', buffer);
  }

  // Helper: HMAC-SHA512 via Web Crypto
  async function hmacSha512(keyBuf, dataBuf) {
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuf,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    return await crypto.subtle.sign('HMAC', key, dataBuf);
  }

  // Helper: PBKDF2 with HMAC-SHA512 via Web Crypto
  async function pbkdf2HmacSha512(password, salt, iterations, keyLenBytes) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: iterations,
        hash: 'SHA-512'
      },
      baseKey,
      keyLenBytes * 8
    );
    return new Uint8Array(derivedBits);
  }

  // Keccak-256 Implementation in pure JS for accurate EIP-55 EVM address derivation
  function keccak256(bytes) {
    const RC = [
      0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
      0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
      0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
      0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
      0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
      0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
    ];
    const RHO = [
      0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14
    ];
    const PI = [
      0, 10, 20, 5, 15, 16, 26, 6, 11, 21, 7, 17, 27, 12, 22, 23, 8, 18, 28, 13, 24, 9, 19, 4, 14
    ];

    const state = new BigUint64Array(25);
    const rate = 136; // 1088 bits for Keccak-256

    const len = bytes.length;
    const padLen = rate - (len % rate);
    const padded = new Uint8Array(len + padLen);
    padded.set(bytes);
    if (padLen === 1) {
      padded[len] = 0x81;
    } else {
      padded[len] = 0x01;
      padded[len + padLen - 1] = 0x80;
    }

    for (let i = 0; i < padded.length; i += rate) {
      for (let j = 0; j < rate; j += 8) {
        let val = 0n;
        for (let k = 0; k < 8; k++) {
          val |= BigInt(padded[i + j + k]) << BigInt(8 * k);
        }
        state[j / 8] ^= val;
      }
      for (let round = 0; round < 24; round++) {
        const C = new BigUint64Array(5);
        for (let x = 0; x < 5; x++) {
          C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
        }
        const D = new BigUint64Array(5);
        for (let x = 0; x < 5; x++) {
          const cNext = C[(x + 1) % 5];
          const cPrev = C[(x + 4) % 5];
          const rot = ((cNext << 1n) | (cNext >> 63n)) & 0xffffffffffffffffn;
          D[x] = cPrev ^ rot;
        }
        for (let idx = 0; idx < 25; idx++) {
          state[idx] ^= D[idx % 5];
        }

        const B = new BigUint64Array(25);
        for (let x = 0; x < 5; x++) {
          for (let y = 0; y < 5; y++) {
            const idx = x + 5 * y;
            const r = BigInt(RHO[idx]);
            const val = state[idx];
            B[y + 5 * ((2 * x + 3 * y) % 5)] = ((val << r) | (val >> (64n - r))) & 0xffffffffffffffffn;
          }
        }

        for (let x = 0; x < 5; x++) {
          for (let y = 0; y < 5; y++) {
            const idx = x + 5 * y;
            state[idx] = B[idx] ^ ((~B[((x + 1) % 5) + 5 * y]) & B[((x + 2) % 5) + 5 * y]);
          }
        }

        state[0] ^= RC[round];
      }
    }

    const out = new Uint8Array(32);
    for (let i = 0; i < 4; i++) {
      const val = state[i];
      for (let j = 0; j < 8; j++) {
        out[i * 8 + j] = Number((val >> BigInt(8 * j)) & 0xffn);
      }
    }
    return out;
  }

  // EIP-55 Checksum Address
  function toChecksumAddress(addressHex) {
    const clean = addressHex.toLowerCase().replace(/^0x/, '');
    const enc = new TextEncoder();
    const hash = keccak256(enc.encode(clean));
    let checksum = '0x';
    for (let i = 0; i < 40; i++) {
      const nibble = (hash[Math.floor(i / 2)] >> (i % 2 === 0 ? 4 : 0)) & 0x0f;
      if (nibble >= 8) {
        checksum += clean[i].toUpperCase();
      } else {
        checksum += clean[i];
      }
    }
    return checksum;
  }

  // Secp256k1 Curve Constants
  const P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
  const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
  const Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
  const Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;

  function mod(a, m) {
    const res = a % m;
    return res >= 0n ? res : res + m;
  }

  function modInverse(a, m) {
    let [m0, y, x] = [m, 0n, 1n];
    if (m === 1n) return 0n;
    while (a > 1n) {
      const q = a / m;
      [a, m] = [m, a % m];
      [x, y] = [y, x - q * y];
    }
    return x < 0n ? x + m0 : x;
  }

  function pointAdd(P1, P2) {
    if (!P1) return P2;
    if (!P2) return P1;
    let [x1, y1] = P1;
    let [x2, y2] = P2;
    if (x1 === x2 && y1 === y2) {
      const lam = mod(mod(3n * x1 * x1, P) * modInverse(2n * y1, P), P);
      const x3 = mod(lam * lam - 2n * x1, P);
      const y3 = mod(lam * (x1 - x3) - y1, P);
      return [x3, y3];
    }
    if (x1 === x2) return null;
    const lam = mod(mod(y2 - y1, P) * modInverse(x2 - x1, P), P);
    const x3 = mod(lam * lam - x1 - x2, P);
    const y3 = mod(lam * (x1 - x3) - y1, P);
    return [x3, y3];
  }

  function scalarMult(k, P1) {
    let R = null;
    let Q = P1;
    let d = k;
    while (d > 0n) {
      if (d & 1n) R = pointAdd(R, Q);
      Q = pointAdd(Q, Q);
      d >>= 1n;
    }
    return R;
  }

  function privateKeyToPublicKey(privKeyBytes) {
    let k = 0n;
    for (let i = 0; i < 32; i++) {
      k = (k << 8n) | BigInt(privKeyBytes[i]);
    }
    k = mod(k, N);
    if (k === 0n) throw new Error('Invalid private key (0)');
    const pub = scalarMult(k, [Gx, Gy]);
    const out = new Uint8Array(64);
    for (let i = 0; i < 32; i++) {
      out[31 - i] = Number((pub[0] >> BigInt(8 * i)) & 0xffn);
      out[63 - i] = Number((pub[1] >> BigInt(8 * i)) & 0xffn);
    }
    return out;
  }

  function publicKeyToEvmAddress(pubKey64) {
    const hash = keccak256(pubKey64);
    const addrBytes = hash.slice(12, 32);
    let hex = '';
    for (let i = 0; i < addrBytes.length; i++) {
      hex += addrBytes[i].toString(16).padStart(2, '0');
    }
    return toChecksumAddress(hex);
  }

  function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function hexToBytes(hex) {
    const clean = hex.replace(/^0x/, '');
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
    }
    return bytes;
  }

  function evmToMycAddress(evmAddr) {
    const clean = evmAddr.toLowerCase().replace(/^0x/, '');
    return 'myc1' + clean.slice(0, 32);
  }

  // ── BIP-39 Public API ──

  async function generateMnemonic() {
    const entropy = new Uint8Array(16);
    crypto.getRandomValues(entropy);

    const hashBuf = await sha256(entropy);
    const hashArr = new Uint8Array(hashBuf);
    const checksumByte = hashArr[0];

    const bits = [];
    for (let i = 0; i < 16; i++) {
      for (let j = 7; j >= 0; j--) {
        bits.push((entropy[i] >> j) & 1);
      }
    }
    for (let j = 7; j >= 4; j--) {
      bits.push((checksumByte >> j) & 1);
    }

    const words = [];
    for (let i = 0; i < 12; i++) {
      let idx = 0;
      for (let j = 0; j < 11; j++) {
        idx = (idx << 1) | bits[i * 11 + j];
      }
      words.push(WORDLIST[idx]);
    }
    return words.join(' ');
  }

  async function validateMnemonic(mnemonic) {
    if (!mnemonic || typeof mnemonic !== 'string') {
      return { valid: false, error: 'Tohum cümlesi boş olamaz.' };
    }
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      return {
        valid: false,
        error: 'Tohum cümlesi tam 12 veya 24 kelime olmalıdır (Girilen: ' + words.length + ' kelime).'
      };
    }

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (!WORD_MAP.has(w)) {
        return {
          valid: false,
          error: "Geçersiz kelime: '" + w + "' (#" + (i + 1) + ") resmi BIP-39 sözlüğünde bulunamadı!"
        };
      }
    }

    const totalBits = words.length * 11;
    const entropyBitsCount = words.length === 12 ? 128 : 256;
    const checksumBitsCount = words.length === 12 ? 4 : 8;

    const bits = [];
    for (let i = 0; i < words.length; i++) {
      const idx = WORD_MAP.get(words[i]);
      for (let j = 10; j >= 0; j--) {
        bits.push((idx >> j) & 1);
      }
    }

    const entropyBytes = new Uint8Array(entropyBitsCount / 8);
    for (let i = 0; i < entropyBytes.length; i++) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | bits[i * 8 + j];
      }
      entropyBytes[i] = byte;
    }

    const hashBuf = await sha256(entropyBytes);
    const hashArr = new Uint8Array(hashBuf);

    let extractedCs = 0;
    for (let i = 0; i < checksumBitsCount; i++) {
      extractedCs = (extractedCs << 1) | bits[entropyBitsCount + i];
    }

    const expectedCs = hashArr[0] >> (8 - checksumBitsCount);
    if (extractedCs !== expectedCs) {
      return {
        valid: false,
        error: 'Tohum cümlesi sağlama toplamı (checksum) geçersiz! Kelimelerin sırasını veya yazımını kontrol edin.'
      };
    }

    return { valid: true, words };
  }

  async function deriveWalletFromMnemonic(mnemonic, passphrase = '') {
    const val = await validateMnemonic(mnemonic);
    if (!val.valid) {
      throw new Error(val.error);
    }

    const seed = await pbkdf2HmacSha512(mnemonic.trim().toLowerCase(), 'mnemonic' + passphrase, 2048, 64);
    
    const enc = new TextEncoder();
    const masterBuf = await hmacSha512(enc.encode('Bitcoin seed'), seed);
    const masterArr = new Uint8Array(masterBuf);
    let key = masterArr.slice(0, 32);
    let chainCode = masterArr.slice(32, 64);

    // BIP-44 path: m / 44' / 60' / 0' / 0 / 0
    const pathIndices = [
      0x8000002C, // 44'
      0x8000003C, // 60' (ETH/EVM)
      0x80000000, // 0'
      0,          // 0 (external change)
      0           // 0 (address_index 0)
    ];

    for (let i = 0; i < pathIndices.length; i++) {
      const idx = pathIndices[i];
      const isHardened = idx >= 0x80000000;
      const data = new Uint8Array(37);
      if (isHardened) {
        data[0] = 0x00;
        data.set(key, 1);
      } else {
        const pubKey = privateKeyToPublicKey(key);
        const prefix = (pubKey[63] & 1) === 0 ? 0x02 : 0x03;
        data[0] = prefix;
        data.set(pubKey.slice(0, 32), 1);
      }
      data[33] = (idx >> 24) & 0xff;
      data[34] = (idx >> 16) & 0xff;
      data[35] = (idx >> 8) & 0xff;
      data[36] = idx & 0xff;

      const childBuf = await hmacSha512(chainCode, data);
      const childArr = new Uint8Array(childBuf);
      const IL = childArr.slice(0, 32);
      chainCode = childArr.slice(32, 64);

      let ilBig = 0n;
      let keyBig = 0n;
      for (let b = 0; b < 32; b++) {
        ilBig = (ilBig << 8n) | BigInt(IL[b]);
        keyBig = (keyBig << 8n) | BigInt(key[b]);
      }
      const childKeyBig = mod(ilBig + keyBig, N);
      if (childKeyBig === 0n) throw new Error('Unusable key derived in BIP-32');

      const nextKey = new Uint8Array(32);
      for (let b = 0; b < 32; b++) {
        nextKey[31 - b] = Number((childKeyBig >> BigInt(8 * b)) & 0xffn);
      }
      key = nextKey;
    }

    const privKeyHex = '0x' + bytesToHex(key);
    const pubKey64 = privateKeyToPublicKey(key);
    const evmAddress = publicKeyToEvmAddress(pubKey64);
    const mycAddress = evmToMycAddress(evmAddress);

    return {
      mnemonic: mnemonic.trim().toLowerCase(),
      derivationPath: "m/44'/60'/0'/0/0",
      privateKey: privKeyHex,
      evmAddress: evmAddress,
      mycAddress: mycAddress,
      verifiedBip39: true
    };
  }

  function deriveWalletFromPrivateKey(privKeyInput) {
    const clean = (privKeyInput || '').trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      return {
        valid: false,
        error: 'Geçersiz Özel Anahtar: Tam 64 karakterli onaltılık (hex) dize olmalıdır (0x... hariç).'
      };
    }
    const keyBytes = hexToBytes(clean);
    const pubKey64 = privateKeyToPublicKey(keyBytes);
    const evmAddress = publicKeyToEvmAddress(pubKey64);
    const mycAddress = evmToMycAddress(evmAddress);

    return {
      valid: true,
      privateKey: '0x' + clean.toLowerCase(),
      evmAddress: evmAddress,
      mycAddress: mycAddress
    };
  }

  // Export to window / global
  const exportObj = {
    WORDLIST,
    generateMnemonic,
    validateMnemonic,
    deriveWalletFromMnemonic,
    deriveWalletFromPrivateKey,
    toChecksumAddress,
    evmToMycAddress,
    keccak256
  };

  if (typeof window !== 'undefined') {
    window.MycWalletBip39 = exportObj;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.MycWalletBip39 = exportObj;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
