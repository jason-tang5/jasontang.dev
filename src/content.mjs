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
    // its card in the projects folder shows the figure in a little window: this file
    // name in a title bar of this colour, muted like the win95 colour schemes
    file: 'liftlens.exe',
    caption: '#9c5a14',
    tech: ['Python', 'OpenCV', 'PyTorch', 'ONNX Runtime', 'TypeScript', 'Next.js', 'FastAPI', 'Redis', 'Docker'],
    // interactive figures, see LiftLensFigures.vue. contribution and implementation place them
    figures: { lead: 'angles' },
    summary: 'A computer vision app that measures joint angles and bar path in Olympic lifts.',
    // 5-10 words for its card in the projects folder
    tagline: 'Computer vision that coaches your Olympic lifts.',
    why: [
      'Olympic lifts are one of the best things you can do as an athlete, but also one of the hardest to learn. Why not build something to make learning them easier?',
    ],
    contribution: [
      'Film a snatch or a clean from the side, then upload to LiftLens. A pose model finds your joints, LiftLens finds the bar, and you get joint angles, bar path and bar speed for every rep.',
      { figure: 'angles' },
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'Finding the bar' },
      'LiftLens looks for the plates. From the side, a plate is just a circle by your ankles, so LiftLens finds it with a Hough transform, a classic computer vision method for spotting simple shapes like lines and circles. Every edge in the frame votes for where a circle’s centre could be, and the spot with the most votes is the plate.',
      { figure: 'plate' },
      { subheading: 'Drawing the bar path' },
      'From there, LiftLens follows the plate through the whole lift. The plate’s centre sits right on the bar, so tracing it frame by frame draws the bar path.',
      { figure: 'path' },
      { subheading: 'Reading the speed' },
      'Speed is how far the plate moves from one frame to the next. Tracking is never perfect, so the plate’s position wobbles a little every frame. Frames are only a split second apart, so even a tiny wobble looks like a big jump in speed. To fix that, LiftLens fits a small curve through the frames around each point and reads the speed off the curve instead.',
      { figure: 'smooth' },
      { subheading: 'Comparing reps' },
      'To see what changed between two reps, you want to compare them at the same point in the lift. Time doesn’t work for that. A heavier clean takes longer, so one second in, a light rep might already be in the catch while a heavy one is still coming off the floor. So LiftLens measures each rep in how far through it is, from 0% to 100%. Only the timeline gets stretched, and the speeds stay real. Now the hip drive sits in about the same spot on both curves, and you can see exactly where one rep lost speed.',
      { figure: 'reps' },
      // measured speeds from liftlens-clip.mjs and liftlens-path.mjs
      { heading: 'Some progress!' },
      'A month after that first clean, I was lifting 5 kg more and moving the bar faster, hitting 1.50 m/s at 105 kg compared to 1.31 m/s at 100 kg. Not bad!',
      { figure: 'compare' },
    ],
    funFact: 'The UofT gym uses kilograms. A quick trick to convert is to double it and add 10%, so 105 kg is about 231 lb.',
  },
  {
    id: 'msn-messenger',
    name: 'Fishbowl',
    kind: 'Interactive web',
    date: 'Fall 2026',
    icon: 'koi',
    file: 'fishbowl.exe',
    caption: '#0b5e7a',
    app: 'chat',
    tech: ['Canvas 2D', 'Cloudflare Workers', 'Durable Objects', 'WebSockets', 'SQLite', 'Workers AI', 'Playwright'],
    figures: { lead: 'fishbowl' },
    summary: 'A chat room with some eavesdropping fish.',
    tagline: 'Say hi, feed fish.',
    why: [
      'Browsing a portfolio is usually a solo thing. I wanted people on the site to be able to bump into each other and say hi.',
    ],
    contribution: [
      'The pond is inspired by [Dao Ho’s pond](https://www.daoho.dev/), and the fish are borrowed from this site’s koi wallpaper.',
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'Fish made of letters' },
      'Each koi is a chain of points that bends like a spine, with a wave running down it to swing the tail. It’s drawn as a grid of shaded characters, and every fish gets its own markings.',
      { subheading: 'A pond you can touch' },
      'Click the water to drop food, and nearby koi race over to eat it. Fish fade under messages so you can still read them, and with reduced motion on, they hold still.',
      { subheading: 'One shared room' },
      'The whole room is one Cloudflare Durable Object. It pushes messages to every browser over WebSockets and keeps messages, sessions and rate limits in SQLite.',
      { figure: 'lobby' },
      { subheading: 'Sleeping between messages' },
      'When nobody’s talking, the room goes to sleep but keeps everyone connected. Rate limits are saved in SQLite, so waking it up doesn’t reset them.',
      { figure: 'sleep' },
      { subheading: 'Keeping it friendly' },
      'You pass a Turnstile check to join. Every message is checked for length and profanity, then held to slow mode and 20 a minute, and it can’t repeat any of your last three. I can also delete messages, ban people, or close the room.',
      { figure: 'checks' },
      { subheading: 'Safe to send again' },
      'Sometimes a message saves but the reply never makes it back. The browser sends it again with the same ID, and the room returns the saved copy instead of posting it twice.',
      { figure: 'retry' },
      { heading: 'Clippy lives here too' },
      'Fishbowl also has an AI assistant. Start a message with @Clippy to ask him anything about the site.',
      'He runs on Gemma 4 through Workers AI. Every question he’s asked comes with context about the site, the recent chat and the live stats, so he knows what’s going on.',
    ],
    funFact: 'The oldest koi on record, Hanako, lived to 226.',
  },
  {
    id: 'portfolio',
    name: 'Portfolio Website',
    kind: 'Web development',
    date: 'Fall 2026',
    icon: 'computer',
    file: 'portfolio.exe',
    caption: '#000080',
    tech: ['Vue', 'JavaScript', 'Cloudflare Workers', 'Durable Objects', 'Workers KV', 'Vite', 'Playwright'],
    // interactive figures, see PortfolioFigures.vue. lead sits under the what i built
    // heading before the text and plays on its card in the projects folder too. the
    // others are placed in contribution and implementation, see writeup() in AppContent.vue
    figures: { lead: 'desktop' },
    summary: 'This site!',
    tagline: 'This site!',
    contribution: [
      'Most portfolios are a page you scroll once and close. I wanted mine to be something you’d actually poke around in.',
      'So I built a desktop and filled it with things I like.',
      'Credit to sharyap.com, expensive.toys, daoho.dev and the react-video-ascii package.',
      { figure: 'apps' },
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'One Worker for everything' },
      'A single Cloudflare Worker serves the whole site. Vue runs the desktop, and a SQLite Durable Object keeps the live stats.',
      { figure: 'stack' },
      { subheading: 'No sound files' },
      'Every click and chime is generated live with Web Audio, so there isn’t a single audio file on the site.',
      { subheading: 'Real visitors only' },
      'Bots and link previews don’t count. A visit only counts once you click or press a key, so every visit below is a real person.',
      { figure: 'live' },
      { heading: 'Lessons learned' },
      'Make what you want to make. I had no idea what this would end up looking like, but starting is what showed me where to go next.',
    ],
    funFact: 'iPhones won’t let a web page vibrate, but Safari buzzes when you flip a switch. The site hides one and flips it whenever it wants a haptic tick.',
  },
  {
    id: 'mini-ml',
    name: 'Mini ML Framework',
    kind: 'Machine learning',
    date: 'Summer 2026',
    icon: 'chip',
    file: 'mini-ml.exe',
    caption: '#5b4a94',
    // the trained network is a game in the games folder, the writeup's play it button
    game: 'digits',
    tech: ['Rust', 'CUDA', 'TypeScript', 'PyTorch', 'TensorFlow'],
    // interactive figures, see MlFigures.vue. the implementation list places the rest
    figures: { lead: 'train' },
    summary: 'A small ML framework in Rust that trains on the GPU.',
    tagline: 'Machine learning from scratch in Rust.',
    why: [
      'After watching [3Blue1Brown’s neural network series](https://www.youtube.com/watch?v=aircAruvnKk&list=PLOH0RpNCcyWRxD8bYrbZbVZrto0U8axHR), I wanted to know what PyTorch actually does when it trains a network in a few lines. So I built the whole thing myself.',
    ],
    contribution: [
      'This project was my first dive into Rust and ML. It’s a small deep learning library with the whole stack built from scratch: tensors, automatic gradients, CUDA kernels for the GPU, and TypeScript bindings on top.',
      'It reads handwritten digits with **97.8% accuracy**, and training on the GPU is about **16× faster** than on one CPU thread.',
      { figure: 'draw' },
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'What it learns' },
      'Each neuron holds a number, like in [3Blue1Brown’s lessons](https://www.3blue1brown.com/lessons/neural-networks). A layer takes a weighted sum of the layer before, adds a bias, and keeps the result only if it’s positive. Anything negative becomes 0, which is called ReLU. Importantly, the weighted sums for a whole layer can all be done at once as one matrix multiply.',
      'Training squashes how wrong the network is into one number, called the cost or loss. Then it nudges all 235,146 weights a little downhill on it, one [shuffled batch](https://www.3blue1brown.com/lessons/backpropagation) of 128 digits at a time.',
      { figure: 'layer' },
      { subheading: 'Working out gradients' },
      'Backpropagation is just [the chain rule](https://www.3blue1brown.com/lessons/backpropagation-calculus) with good bookkeeping. As the network runs forward, every operation remembers how to pass a gradient back. Calling backward then walks that chain in reverse, handing each gradient to whatever came before it. When one value feeds into several places, it gets a gradient back from each of them, so those get added together instead of overwritten.',
      { figure: 'graph' },
      { subheading: 'Running on the GPU' },
      'On a GPU, speed is mostly about memory, not math. So the matrix multiply copies 16 × 16 tiles into fast shared memory and reuses each one before fetching the next.',
      { figure: 'tiles' },
      { subheading: 'Picking an optimizer' },
      'The gradient tells us which way is downhill, and the optimizer decides how far to actually step in that direction. There are a few ways to do this. Plain SGD steps straight down the slope. Momentum keeps some speed from one step to the next, and RMSProp gives every weight its own step size.',
      'There’s no best optimizer for every problem, since the shape of the loss changes which one does well. I chose Adam, which is a mix of momentum and RMSProp.',
      { figure: 'optim' },
      { subheading: 'Checking the math' },
      'Gradient bugs are sneaky. Nothing crashes, and the model quietly learns worse than it should. To catch them, I test every operation against PyTorch and TensorFlow and make sure the numbers match.',
      'That’s how I found out the two don’t agree on Adam. Both add a tiny epsilon to avoid dividing by zero, but Keras adds it in a different place, so its steps come out smaller for tiny gradients early in training.',
      { figure: 'epsilon' },
    ],
    funFact: 'The handwritten digits it learned from (MNIST) were written by US Census Bureau employees and high school students. The students’ digits were so much messier that the dataset mixes both, so the network has to handle either.',
  },
  {
    id: 'fpga-2048',
    name: 'FPGA 2048',
    kind: 'Digital hardware',
    date: 'Fall 2024',
    icon: '2048',
    file: '2048.sof',
    caption: '#8c2a1c',
    tech: ['Verilog', 'VHDL', 'Quartus', 'ModelSim'],
    // opens the playable version in the games folder
    game: '2048',
    // interactive figures under these sections, see FpgaFigures.vue
    // the implementation list can drop them in between its paragraphs too
    figures: { lead: 'register' },
    summary: 'The tile-merging game built in hardware on a DE1-SoC.',
    tagline: '2048 built on the DE1-SoC.',
    contribution: '2048 is a simple game to play, but building it out of hardware is a whole different story. For ECE241 (Digital Systems), my partner and I built it in Verilog. It runs on a DE1-SoC FPGA, draws to a VGA monitor at 60 Hz, and takes moves from a real PS/2 keyboard.',
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'Drawing tiles' },
      'Each tile is a sprite stored in on-chip ROM. To draw one, counters sweep across it pixel by pixel and send each pixel to our VGA adapter.',
      { figure: 'datapath' },
      { subheading: 'Sliding tiles' },
      'The whole board lives in one 64-bit register. Every tile is a power of two, so instead of storing 2048 we only store the 11 in 2¹¹, which fits in 4 bits. Moves happen right on that register in two steps. First equal tiles merge, then everything slides toward the side you pushed.',
      { figure: 'slide' },
      { subheading: 'Reading the keyboard' },
      'A PS/2 keyboard sends a code when you press a key and another when you let go. If we acted on both, every press would move the board twice. So a small FSM only listens for W, A, S and D going down and ignores them coming back up.',
      { figure: 'fsm' },
      ['You can play a browser version rebuilt from the same design in the ', { open: 'games', text: 'Games' }, ' folder.'],
      { heading: 'What I learned' },
      'Hardware punishes you for skipping steps. Splitting the game into small, separate pieces made bugs easy to track down, and testing edge cases early meant we never built on top of something broken.',
    ],
    funFact: 'My demo for this project was the same day as my AMD interview, so I showed it to my interviewer too. It went well enough that I spent the next 16 months interning there!',
  },
  {
    id: 'reversi-ai',
    name: 'Reversi AI Bot',
    kind: 'Game AI',
    date: 'Winter 2024',
    icon: 'reversi',
    file: 'reversi.exe',
    caption: '#2f6b45',
    tech: ['C'],
    // opens the playable version in the games folder
    game: 'reversi',
    // the board is its card's figure too, see ReversiFigures.vue. contribution places
    // it itself, between its two paragraphs
    figures: { lead: 'board' },
    summary: 'A terminal Reversi game in C with an AI opponent.',
    tagline: 'Minimax Reversi in C.',
    // these are lists of paragraphs, { figure }, { list } and { heading } items, and
    // paragraphs given as arrays can hold { open, text } links to other windows. see
    // writeup() in AppContent.vue
    contribution: [
      'For APS105 (Computer Fundamentals), I built Reversi in C over three weeks. Then I wrote an AI good enough to beat me.',
      { figure: 'board' },
      ['The original code is lost to the depths of Quercus, so the version in the ', { open: 'games', text: 'Games' }, ' folder is a faithful recreation.'],
    ],
    implementationTitle: 'How the AI thinks',
    implementation: [
      { subheading: 'Where to play' },
      'Not all squares are created equal. Corners are the best because nothing can ever flip them. Edges come next, since a disc on an edge can only be flipped along that edge. The squares next to an empty corner look harmless, but playing there hands your opponent the corner. I learned that one the hard way. The AI gives every square a weight based on all this.',
      { figure: 'weights' },
      { subheading: 'Scoring a move' },
      'For each possible move, the AI plays it on a copy of the board and scores the result. The score mixes the square weights, how many moves each side has left, and who holds the corners. Having more moves matters because a player with no good options gets forced into bad ones. Near the end of the game, it counts discs too, since that’s what decides the winner.',
      { figure: 'eval' },
      { subheading: 'Looking ahead' },
      'The move that looks best now can be a mistake two turns later. So the AI uses a classic strategy for two-player games called minimax. The idea is to assume your opponent always plays their best reply. For each of its moves, the AI looks at every way you could answer and finds the one that hurts it most. Then it picks the move whose worst case is the least bad, so it never walks into a trap it could have seen coming.',
      { figure: 'lookahead' },
    ],
    outcomes: [
      '100% win rate against basic random-move bots',
      '80% win rate against bots built by other students in the course',
      'A reality check of how bad I was at Reversi',
    ],
    lessonsTitle: 'What I learned',
    lessons: 'Games that humans play by intuition are surprisingly hard to program well. Maybe something with randomness, like Slay the Spire, is next.',
    funFact: 'My record against my own AI is 2–48.',
  },
];
