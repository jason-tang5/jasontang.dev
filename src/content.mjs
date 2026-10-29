// all the text about me that shows up on the desktop.
// career stuff was checked against my resume on 2026-10-09.
export const profile = {
  name: 'Jason Tang',
  subtitle: 'Computer Engineering @ UofT',
  // typed out one at a time under my name on the about page
  roles: ['Software Engineer', 'Autodidact', 'Problem Solver', 'Tinkerer', 'Get-It-Done Guy', 'Builder', 'Student Athlete', 'Gym Rat?'],
  intro: 'Hi, I’m Jason, a third-year Computer Engineering student at UofT. I like building useful tools, learning new technologies, and digging into complex problems.',
  links: {
    linkedin: 'https://www.linkedin.com/in/jason-tang-uoft/',
    github: 'https://github.com/jason-tang5',
  },
  bio: 'When I’m not building, I’m usually playing some sport, at the gym, or learning some random skill.',
  // the quick facts under the divider on the about page (AboutFacts.vue): work first, then
  // for fun. the text takes *italic* and **bold** like the blog. awards each get a ribbon
  // medal on their own line, and books sets the links in the pixel font with a little book
  facts: [
    { label: 'Awards', awards: ['Edward S Rogers Sr. Scholarship', 'FASE Scholarship'] },
    { label: 'Previously', text: '16-month SWE intern @ AMD' },
    { label: 'Sports', text: 'volleyball (captain), ultimate, badminton' },
    // best lifts in lb, each weight in the pixel font after the lift's name
    { label: 'Lifts (lb)', lifts: [['clean', '265'], ['squat', '405'], ['bench', '265'], ['pull-up', '+100']] },
    { label: 'Peak league rank', text: '**grandmaster** 528 LP (tft **master**)' },
    // opens the cd player on JANE DOE, from the chainsaw man movie
    { label: 'Favorite manga', text: '[Chainsaw Man](/#app=music&track=jane-doe)', books: true },
  ],
  // from haikyuu, over the liftlens figure at the bottom of the about page. one line
  // when it fits, otherwise it breaks between the two halves
  quote: ['talent is something you make bloom,', 'instinct is something you polish'],
  education: 'BASc, Computer Engineering · September 2023 – May 2028',
  skills: ['Python', 'TypeScript', 'JavaScript', 'Rust', 'C++', 'Ruby', 'SQL', 'Vue.js', 'Node.js', 'PostgreSQL', 'CUDA', 'Verilog'],
};

// the breakout game in the contact window spells this out
export const contact = { email: 'jasontcanada@gmail.com' };

// **text** in a bullet is bold, the same spots the resume pdf bolds
export const roles = [
  {
    company: 'AMD',
    role: 'Software Engineer Intern',
    location: 'Toronto, ON',
    dates: 'May 2025 – August 2026',
    bullets: [
      'Developed and scaled an internal regression-management platform serving **1,000+ engineers** and processing **3.1M tests** monthly, building full-stack features across Vue, TypeScript, Node.js/Express, Ruby, and PostgreSQL.',
      'Reduced failure triage from **15–30 minutes to 30 seconds** by building an **AI debugging agent** that correlated logs, scheduler events, and regression metadata to automatically identify likely root causes.',
      'Improved reliability for **239K jobs per month** by building job lifecycle services that reconcile job state after failures.',
      'Enabled **10K+ monthly AI operations** with an authenticated **TypeScript MCP** integration used by **100+ engineers**.',
      'Automated deployment workflows with Python, Ruby, and Jenkins, saving **20+ engineering hours per week** and shortening release cycles by **30%**.',
      'Secured traceability for **1.4M+ regression runs** with validation workflows for a **113-repository** Perforce-to-Git migration.',
    ],
  },
  {
    company: 'U+ Education',
    role: 'Web Developer',
    location: 'Ottawa, ON',
    dates: 'June – September 2023',
    bullets: [
      'Designed and launched two responsive WordPress websites serving **100+ customers**, with reusable page layouts.',
      'Improved page-load speed by **30%** through image optimization, caching, and lazy loading; grew organic traffic by **50%+** through technical SEO and analytics-driven content updates across both websites.',
      'Spearheaded the company’s **expansion into Ottawa**, launching its local web presence and student outreach.',
    ],
  },
  {
    company: 'Digitera Interactive',
    role: 'Full-stack Developer Intern',
    location: 'Ottawa, ON',
    dates: 'June – September 2020',
    bullets: [
      'Built an event-planning app with scheduling, registration, and accounts using **HTML, CSS, JavaScript, and MySQL**.',
      'Designed the **MySQL** database structure and implemented form validation, filtering, and error handling for reliable CRUD operations.',
      'Implemented authentication and **role-based permissions** to secure event management and registration features.',
    ],
  },
];

export const projects = [
  {
    id: 'liftlens',
    name: 'LiftLens',
    kind: 'Computer vision',
    date: 'Fall 2026',
    icon: 'barbell',
    tech: ['Python', 'OpenCV', 'PyTorch', 'ONNX Runtime', 'TypeScript', 'Next.js', 'FastAPI', 'Redis', 'Docker'],
    // interactive figures, see LiftLensFigures.vue. contribution and implementation place them
    figures: { lead: 'angles' },
    summary: 'A computer vision app that measures joint angles and bar path in Olympic lifts.',
    // 5-10 words for its card in the projects folder
    tagline: 'Computer vision that coaches your Olympic lifts.',
    why: [
      'Olympic lifts are one of the best things you can do as an athlete, and the gold standard is a power clean at 1.5× bodyweight. My replays showed something was off but not what, so I built something to measure it.',
    ],
    contribution: [
      'Film a snatch or a clean from the side, or just use your webcam. A pose model finds your joints, LiftLens finds the bar, and you get joint angles, bar path and bar speed for every rep.',
      { figure: 'angles' },
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'Finding the bar' },
      'Training a barbell detector needs thousands of labelled videos, which I don’t have. So LiftLens looks for the plates instead: from the side, a plate is just a circle by your ankles, and a classic Hough transform finds it.',
      { figure: 'plate' },
      { subheading: 'Reading the speed' },
      'Tracking jitters, and jitter turns into huge spikes in speed. Averaging smears out the peak you actually care about, so LiftLens fits a small curve around each frame instead. Every plate is 450 mm across, so the speed comes out in real metres per second with no setup.',
      { figure: 'smooth' },
      { subheading: 'Comparing reps' },
      'Every rep gets stretched to the same 101 steps, so a slow rep and a fast one line up moment by moment on the same chart.',
      { figure: 'reps' },
      // the numbers here come from the clean in Fig. 1 (liftlens-clip.mjs and its export)
      { heading: 'What it showed me' },
      'My hips were shooting up before the bar passed my knees. My knee angle opened 43° while my hip opened only 21°, so my legs straightened twice as fast as my back came up.',
      { figure: 'hips' },
      'I film every heavy session now. Still chasing that 1.5× bodyweight clean.',
    ],
    funFact: 'Competition bumper plates all measure 450 mm across, from 10 kg to 25 kg. The plate works as a ruler whatever is loaded on the bar.',
  },
  {
    id: 'msn-messenger',
    name: 'Fishbowl',
    kind: 'Interactive web',
    date: 'Fall 2026',
    icon: 'koi',
    app: 'chat',
    tech: ['JavaScript', 'Vue', 'Canvas 2D', 'Cloudflare Workers', 'Durable Objects', 'WebSockets', 'SQLite', 'Workers AI', 'Turnstile', 'Playwright'],
    figures: { lead: 'fishbowl' },
    summary: 'A shared chat room with ASCII koi swimming behind the conversation.',
    tagline: 'Say hi, feed fish.',
    why: [
      'A desktop feels more alive with someone else in it. Fishbowl gives visitors a place to say hi, with the familiar blues of MSN Messenger and a pond that keeps moving while the room is quiet.',
    ],
    contribution: [
      ['Open ', { open: 'chat', text: 'Fishbowl' }, ', pick a nickname, and join everyone else on the site. See who’s online, send a message, or start one with @Clippy to ask the site’s AI assistant a question. Click an empty patch of water to feed the koi.'],
      'The pond’s visual inspiration comes from [Dao Ho’s pond](https://www.daoho.dev/). The fish here use the same custom canvas simulation as this site’s koi wallpaper, recoloured in pale MSN blues.',
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'Fish made of letters' },
      'Each koi follows a chain of points that bends into a spine. A moving wave gives its body, fins and forked tail their sway. Canvas draws the fish as a grid of shaded squares and characters, with generated markings that make each one different.',
      { subheading: 'A pond you can touch' },
      'Clicking the water scatters food pellets. Nearby koi turn toward them, speed up, and leave ripples as they eat. Moving the mouse leaves a brief trail. Fish fade beneath message text to keep it readable, and clicks on words or controls stay with the chat.',
      'The canvas resizes with its window and changes palette with the desktop theme. Reduced-motion mode holds the fish still while keeping the pond visible.',
      { subheading: 'One shared room' },
      'A single Cloudflare Durable Object owns the lobby. WebSockets push new messages and presence updates to connected browsers, while SQLite stores messages, sessions, moderation settings and send limits.',
      { figure: 'lobby' },
      { subheading: 'Sleeping between messages' },
      'The room uses hibernating WebSockets, so connections can stay open when the object leaves memory. Rate limits live in SQLite too: waking up does not give a visitor a fresh allowance.',
      { figure: 'sleep' },
      { subheading: 'Keeping it friendly' },
      'Joining requires a Turnstile check. The server checks every message for length, profanity and invalid control characters, then applies slow mode, a 20-per-minute limit and a check against the sender’s last three messages. Moderation controls let me remove messages, mute or ban sessions, and close the room.',
      { figure: 'checks' },
      { subheading: 'Safe to send again' },
      'A dropped connection can lose the acknowledgement after a message has already been saved. The browser retries with the same message ID, and the room returns the saved message instead of inserting another copy.',
      { figure: 'retry' },
      { heading: 'Clippy lives here too' },
      'Messages starting with @Clippy call Gemma 4 through Workers AI. His prompt includes a guide to the site, bounded recent conversation history and live site statistics. He can give directions and answer questions; he cannot operate the desktop.',
      'The room allows one AI request at a time, caps requests at 500 per UTC day, and asks for replies of at most 200 tokens with a 20-second timeout. Token usage is recorded for Analytics.',
      { heading: 'What I learned' },
      'The chat and the pond share a window, but need different kinds of state. The room keeps durable records so reconnects and hibernation are safe. The fish keep a local simulation that can be rebuilt whenever the canvas mounts. Making both work together also means deciding which clicks belong to the water and which belong to the conversation.',
    ],
  },
  {
    id: 'portfolio',
    name: 'Portfolio Website',
    kind: 'Web development',
    date: 'Fall 2026',
    icon: 'computer',
    tech: ['Vue', 'JavaScript', 'Cloudflare Workers', 'Durable Objects', 'Workers KV', 'Vite', 'Playwright'],
    // interactive figures, see PortfolioFigures.vue. lead sits under the what i built
    // heading before the text and plays on its card in the projects folder too. the
    // others are placed in contribution and implementation, see writeup() in AppContent.vue
    figures: { lead: 'desktop' },
    summary: 'This site!',
    tagline: 'This site!',
    contribution: [
      'Most portfolios are a scrolling page. I wanted mine to be something you’d want to poke around in, so I built a desktop, inspired by sharyap.com, expensive.toys and the react-video-ascii package.',
      'Then I filled it with things I’d want to find: Breakout guarding my email, a Snake leaderboard, Clippy trash-talking you over Reversi, and a lot more.',
      { figure: 'apps' },
    ],
    implementationTitle: 'Cool things hiding in here',
    implementation: [
      'There isn’t a single sound file. Every click and chime is generated live with Web Audio. Your iPhone buzzes too, thanks to a hidden toggle switch the site flips whenever it wants a haptic tick.',
      { subheading: 'Under the hood' },
      'One Cloudflare Worker serves everything. Vue runs the desktop, a SQLite Durable Object keeps the live stats, and Playwright clicks through every app at desktop and phone sizes before anything ships.',
      { figure: 'stack' },
      { subheading: 'Real visitors only' },
      'The analytics ignore bots and link previews, because nothing counts until you actually click or press a key. Every visit below is a real person.',
      { figure: 'live' },
      { heading: 'What I learned' },
      'Safari is its own boss fight, and tests are what let me keep adding things. With more than a dozen apps on one desktop, Playwright is the reason new stuff doesn’t break old stuff.',
    ],
  },
  {
    id: 'mini-ml',
    name: 'Mini ML Framework',
    kind: 'Machine learning',
    date: 'Summer 2026',
    icon: 'chip',
    tech: ['Rust', 'CUDA', 'TypeScript', 'PyTorch', 'TensorFlow'],
    // interactive figures, see MlFigures.vue. the implementation list places the rest
    figures: { lead: 'train' },
    summary: 'A small ML framework in Rust, from tensors to GPU training.',
    tagline: 'Machine learning from scratch in Rust.',
    why: [
      'PyTorch turns training a neural network into a few lines of code. I wanted to know what those lines actually do, so I built the whole thing myself, from the numbers up to the GPU.',
    ],
    contribution: [
      'A small deep learning library in Rust, with automatic gradients, hand-written CUDA kernels and TypeScript bindings. It reads handwritten digits with **97.8% accuracy**, and the GPU trains about **16× faster** than the CPU.',
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'Working out gradients' },
      'Every operation remembers how to undo its effect on the gradient. Calling backward walks that chain in reverse and adds up every contribution, so no gradient is ever worked out by hand.',
      { figure: 'graph' },
      { subheading: 'Running on the GPU' },
      'I wrote every CUDA kernel by hand. Matrix multiply copies 16 × 16 tiles into fast shared memory and reuses each one before fetching the next, because on a GPU speed is mostly about memory, not math.',
      { figure: 'tiles' },
      { subheading: 'Checking the math' },
      'A gradient bug doesn’t crash anything, the model just learns badly. So every operation is checked against both PyTorch and TensorFlow, which is how I found out Keras adds epsilon in a different place.',
      { figure: 'epsilon' },
    ],
    funFact: 'The whole framework is about 1,800 lines of Rust, and the CUDA kernels live in it as one big string. They’re compiled the first time the GPU is used, so it builds on a laptop with no CUDA toolkit or Visual Studio installed at all.',
  },
  {
    id: 'fpga-2048',
    name: 'FPGA 2048',
    kind: 'Digital hardware',
    date: 'Fall 2024',
    icon: '2048',
    tech: ['Verilog', 'VHDL', 'Quartus', 'ModelSim'],
    // opens the playable version in the games folder
    game: '2048',
    // interactive figures under these sections, see FpgaFigures.vue
    // the implementation list can drop them in between its paragraphs too
    figures: { lead: 'register' },
    summary: 'The tile-merging game, implemented in hardware on a DE1-SoC.',
    tagline: '2048 built on the DE1-SoC.',
    contribution: 'For ECE241, my partner and I built 2048 in Verilog on a DE1-SoC FPGA. It draws on a VGA display at 60 Hz, and you play it with a real PS/2 keyboard.',
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'Drawing tiles' },
      'Each tile is a sprite stored in on-chip ROM. Counters sweep across it one pixel at a time and send each pixel to our VGA adapter.',
      { figure: 'datapath' },
      { subheading: 'Sliding tiles' },
      'Moves happen right on the board register, in two steps: equal tiles merge, then everything slides toward the side you pushed.',
      { figure: 'slide' },
      { subheading: 'Reading the keyboard' },
      'A small FSM turns W, A, S and D into moves and swallows the key-up codes, so one press is always exactly one move.',
      { figure: 'fsm' },
      ['The ', { open: 'games', text: 'Games' }, ' folder has a browser version rebuilt from the same design.'],
    ],
    lessonsTitle: 'What I learned',
    lessons: 'Integrate early. Every module passed its own testbench, but the bugs lived in the wires between them.',
    funFact: 'The presentation for this project was due the same day as my interview with AMD, so I presented it to my interviewer as well! It went well enough, I spent the next 16 months interning there.',
  },
  {
    id: 'reversi-ai',
    name: 'Reversi AI Bot',
    kind: 'Game AI',
    date: 'Winter 2024',
    icon: 'reversi',
    tech: ['C'],
    // opens the playable version in the games folder
    game: 'reversi',
    // the board is its card's figure too, see ReversiFigures.vue. contribution places
    // it itself, between its two paragraphs
    figures: { lead: 'board' },
    summary: 'A terminal Reversi clone written in C, with an AI opponent, built for my Computer Fundamentals course (APS105).',
    tagline: 'Minimax Reversi in C.',
    // these are lists of paragraphs, { figure }, { list } and { heading } items, and
    // paragraphs given as arrays can hold { open, text } links to other windows. see
    // writeup() in AppContent.vue
    contribution: [
      'I rebuilt Reversi (aka Othello) from scratch in C over three weeks, then realized I had no one to play it with. So I built my own opponent, Clippy. Give it a try!',
      { figure: 'board' },
      ['The original code is lost to the depths of Quercus, so the version in the ', { open: 'games', text: 'Games' }, ' folder is a faithful recreation.'],
    ],
    implementationTitle: 'How Clippy thinks',
    implementation: [
      { subheading: 'Where to play' },
      'Every square has a weight. Corners are gold because they can never be flipped, and the squares next to an empty corner are traps.',
      { figure: 'weights' },
      { subheading: 'Scoring a move' },
      'Clippy plays each move on a copy of the board and adds up the square weights, how many moves it leaves each side, and the corners. Near the end of the game, it counts discs too.',
      { figure: 'eval' },
      { subheading: 'Looking ahead' },
      'The move that looks best now can be a mistake two turns later. So Clippy uses minimax: it looks two moves ahead and assumes you’ll reply with the move that hurts it most.',
      { figure: 'lookahead' },
    ],
    outcomes: [
      '100% win rate against basic random-move bots',
      '80% win rate against bots built by other students in the course',
      'A reality check of how bad I was at Reversi',
    ],
    lessonsTitle: 'What I learned',
    lessons: 'Games that humans play by intuition are surprisingly hard to program well. Maybe something with randomness, like Slay the Spire, is next.',
    funFact: 'My record against Clippy is 2–48.',
  },
];
