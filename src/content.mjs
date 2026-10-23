// all the text about me that shows up on the desktop.
// career stuff was checked against my resume on 2026-10-09.
export const profile = {
  name: 'Jason Tang',
  subtitle: 'Computer Engineering @ UofT',
  // typed out one at a time under my name on the about page
  roles: ['Software Engineer', 'Autodidact', 'Problem Solver', 'Tinkerer', 'Get-It-Done Guy', 'Builder', 'Student Athlete', 'Gym Rat?'],
  intro: 'Hi, I’m Jason, a third-year Computer Engineering student at UofT and former software engineering intern at AMD. I like building useful tools, learning new technologies, and digging into complex problems.',
  links: {
    linkedin: 'https://www.linkedin.com/in/jason-tang-uoft/',
    github: 'https://github.com/jason-tang5',
  },
  bio: 'When I’m not building, I’m usually playing some sport, at the gym, or learning some random skill.',
  // the quick facts under the divider on the about page (AboutFacts.vue): work first, then
  // for fun. the text takes *italic* and **bold** like the blog. awards each get a ribbon
  // medal under the fact, and books sets the links in the pixel font with a little book
  facts: [
    {
      label: 'Studying',
      text: 'Comp Eng @ UofT ’28',
      awards: ['Edward S Rogers Sr. Scholarship', 'Faculty of Applied Science and Engineering Scholarship'],
    },
    { label: 'Previously', text: '16-month SWE intern @ AMD, building tooling for 1,000+ engineers' },
    { label: 'Currently building', text: 'LiftLens, a computer vision app that analyzes Olympic lifts and gives technique feedback' },
    { label: 'Sports', text: 'volleyball (captain), ultimate frisbee, badminton' },
    // best lifts in lb, each weight in the pixel font after the lift's name
    { label: 'Lifts (lb)', lifts: [['Power clean', '265'], ['Squat', '405'], ['Bench', '265'], ['Pull-up', '+100']] },
    { label: 'Favorite books', text: '[The Name of the Wind](https://www.goodreads.com/book/show/186074.The_Name_of_the_Wind), [Meditations](https://www.goodreads.com/book/show/30659.Meditations)', books: true },
  ],
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
    date: 'October 2026 – Present',
    icon: 'barbell',
    tech: ['Python', 'OpenCV', 'PyTorch', 'ONNX Runtime', 'TypeScript', 'Next.js', 'FastAPI', 'Redis', 'Docker'],
    // interactive figures, see LiftLensFigures.vue. contribution and implementation place them
    figures: { lead: 'angles' },
    summary: 'A computer vision app that measures joint angles and bar path in Olympic lifts.',
    why: [
      'I’m training for a 40-inch vertical, which means I need to get cracked at Olympic lifts. My current goal is a power clean at 1.5× bodyweight. The clean is basically a loaded jump. Driving through triple extension of the hips, knees and ankles is the same rate-of-force-development pattern a vertical depends on, so getting better at one carries over to the other.',
      'The catch is that form matters a lot. If my hips shoot up early, my arms bend before full extension, or the bar loops away from my body, I leak power I can’t get back. Watching my own lifts on video, I could tell something was off, but not exactly what. So I built something to measure it.',
    ],
    contribution: [
      'LiftLens takes a side-on video of a snatch or clean & jerk, or a live webcam feed. It measures my joint angles, bar path and bar speed through every phase of the lift, rep by rep.',
      { figure: 'angles' },
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'Tracking the body' },
      'A pretrained YOLOv8 pose model, exported to ONNX, finds 17 keypoints on the lifter in each frame. Knee, hip and elbow angles each come from three keypoints on the side facing the camera. Those three angles tell most of the story. The knee and hip show whether I’m keeping my back angle through the first pull and getting the double knee bend in the transition. The elbow shows whether my arms stay long until the second pull is finished. If any keypoint is under 35% confidence, the angle is left blank instead of guessed from the other side.',
      { subheading: 'Finding the bar' },
      'Finding the bar was the hard part. A barbell detector needs labelled training footage, which I don’t have yet, so I used classical computer vision instead. From the side, a bumper plate is a circle with the bar at its centre. At setup, the lifter’s wrists are below their hips and the plates sit by their ankles, so the pose tells me where to look. A Hough circle search finds candidate circles there, and each one is scored by how much of its rim has a strong edge.',
      { figure: 'plate' },
      'False circles, like a knee or a plate on the rack, rarely hold still. A plate only counts once three samples in a row agree on its centre and size, and across reps only plates of the most common size are kept.',
      { subheading: 'Following the bar' },
      'Each frame, at up to 60 fps, the tracker predicts where the plate moved and re-fits the circle around that spot. Under motion blur, it falls back to matching the last clear image of the plate. After 0.3 seconds without a match, it stops instead of drifting. A quadratic fit over a short window around each point then gives position, velocity and acceleration, without the lag of a moving average. That matters for peak bar velocity, which happens in a split second at the top of the second pull.',
      { figure: 'smooth' },
      { subheading: 'Measuring in real units' },
      'Competition bumper plates are 450 mm across, so the plate’s size in pixels sets the scale. Bar speed comes out in metres per second with no extra calibration, which makes it useful for velocity-based training.',
      { subheading: 'Running it' },
      'Uploaded videos go to a FastAPI server, which queues them in Redis for a Python worker while the page polls for progress. Live mode runs the same model in the browser with ONNX Runtime Web inside a Web Worker, one frame at a time, so no video ever leaves the computer.',
      { subheading: 'Comparing reps' },
      'Saved reps are resampled to 101 points from start to finish, so two lifts of different lengths can be compared phase by phase on the same knee angle chart.',
      // the numbers here come from the clean in Fig. 1 (liftlens-clip.mjs and its export)
      { heading: 'What it showed me' },
      'The first time I ran my own cleans through LiftLens, my hips were rising before the bar passed my knees. On video it just looked like a slightly slow pull. In the numbers it was obvious: from the floor to my knees, my knee angle opened 43° while my hip angle opened only 21°.',
      'Since then, I’ve been filming every heavy session on the way to a 1.5× bodyweight power clean.',
      { heading: 'What I learned' },
      '**Seeing isn’t measuring.** I thought I knew what a good clean looked like. But a clean takes under a second, and the faults that cost power happen in a fraction of that. Putting numbers on the first pull, the transition and the second pull showed me things that watching the replay never did.',
      '**Noise hides the moment that matters.** Peak bar velocity happens in about 50 ms at the top of the second pull. My first version smoothed the speed with a moving average, and it flattened the peak and shifted it late, which is exactly the number I cared about most. Fitting a curve around each point kept the peak where it actually was.',
      '**Use what you already know.** I planned around a trained barbell detector but had no labelled footage to train it on. Instead, I used what the pose model already knew: at setup, the plate sits by the lifter’s ankles. That, plus the fact that every competition plate is 450 mm across, was enough to find the bar and measure its speed in real units, without any training data.',
      { heading: 'Under the hood' },
      'Runs as four Docker containers with one command. It’s tested from the angle math all the way through a real video in the queue, and the pipeline for a trained barbell detector is ready for when I have labelled footage.',
    ],
    funFact: 'Competition bumper plates are all 450 mm across, whether they weigh 10 kg or 25 kg. That’s what lets the plate double as a ruler: it’s the same size no matter what’s loaded on the bar.',
  },
  {
    id: 'portfolio',
    name: 'Portfolio Website',
    kind: 'Web development',
    date: 'September 2026',
    icon: 'computer',
    tech: ['Vue', 'JavaScript', 'Cloudflare Workers', 'Durable Objects', 'Workers KV', 'Vite', 'Playwright'],
    // interactive figures, see PortfolioFigures.vue. lead sits under the what i built
    // heading before the text and shows in the projects folder's preview too. the
    // others are placed in contribution and implementation, see writeup() in AppContent.vue
    figures: { lead: 'desktop' },
    summary: 'This site!',
    contribution: [
      'Most portfolios are a scrolling page with a list of projects and experiences. To stand out, I wanted mine to feel like something you’d want to poke around in, so I spent a decent chunk of time thinking about what would be cool to make. I first got inspired by desktop-style sites like sharyap.com and expensive.toys. Then I saw this really cool video-to-ASCII npm package by Lucas, react-video-ascii, and that got me thinking: what if I made a desktop too?',
      'Then I filled it with things I’d want to find. My email is locked inside a Breakout arcade cabinet, and you have to clear the bricks to get it. Snake has a worldwide leaderboard. Clippy is back, and he’ll trash-talk you over Reversi. There’s also Minesweeper, a CD player that plays my music on Spotify, sticky notes, and this blog.',
      { figure: 'apps' },
    ],
    implementationTitle: 'Cool things hiding in here',
    implementation: [
      'There isn’t a single sound file. Every click, beep and chime is generated on the fly with Web Audio. The game backgrounds are animated ASCII art. It felt more in the spirit of the era to make the retro stuff instead of downloading it.',
      'Your iPhone vibrates, too. Safari doesn’t let websites trigger haptics, but toggle switches get a little haptic tick. So there’s a hidden switch on the page, and the site flips it whenever it wants your phone to buzz.',
      'People are creative with leaderboard names, so the Snake leaderboard had a profanity filter from day one. It sees through letter swaps, and names are checked in your browser and again on the server.',
      'The analytics ignore bots and link previews. Nothing is counted until you actually click or press a key, so every visit in Fig. 3 is a real person.',
      { heading: 'What I learned' },
      'Safari is its own boss fight. Videos played everywhere except Safari, which turned out to need the server to send them in chunks. The haptics trick exists only because Safari says no to the normal way.',
      'Tests are what let me keep adding things. With more than a dozen apps sharing one desktop, every new feature risked breaking an old one. Playwright now clicks through every app at desktop and phone sizes, so I can add things without breaking what’s already there.',
      'Building for everyone makes it better for everyone. I added keyboard controls and screen reader announcements for accessibility, and they made the games nicer to play for everyone.',
      { figure: 'stack' },
      { heading: 'Under the hood' },
      'For anyone curious how it all fits together:',
      { bullets: true, list: [
        '**Frontend:** Vue and Vite. The window manager’s geometry is plain JavaScript with no Vue, so it can be unit tested in Node.',
        '**Server:** One Cloudflare Worker serves the site and handles every /api request.',
        '**Live data:** A SQLite Durable Object tracks visits, who’s online, game wins and the Snake leaderboard.',
        '**Blog:** Posts are stored in Workers KV and edited from the site itself, behind Cloudflare Access.',
        '**Contact form:** Messages are sent through Cloudflare Email Routing.',
        '**Analytics:** Anonymous and cookie-free. Visits go to Workers Analytics Engine, and the Analytics window reads them back with its SQL API.',
        '**Testing:** Unit tests cover the worker, window geometry and games. Playwright clicks through every app at desktop and phone sizes.',
        '**Deploys:** Every push to main goes live automatically.',
        '**Accessibility:** It respects reduced motion and works with a keyboard and screen reader.',
      ] },
      { figure: 'live' },
    ],
  },
  {
    id: 'mini-ml',
    name: 'Mini ML Framework',
    kind: 'Machine learning',
    date: 'August 2026',
    icon: 'chip',
    tech: ['Rust', 'CUDA', 'TypeScript', 'PyTorch', 'TensorFlow'],
    // interactive figures, see MlFigures.vue. the implementation list places the rest
    figures: { lead: 'train' },
    summary: 'A small ML framework in Rust, from tensors to GPU training.',
    contribution: 'Built a deep learning library in Rust with tensors, reverse-mode automatic differentiation, a CPU backend, a CUDA backend with hand-written kernels, and TypeScript bindings for Node.js, then trained an MNIST classifier with it.',
    implementation: [
      'Every operation on a tensor that needs gradients records its inputs and a backward rule. Calling backward on the loss walks that graph in reverse and adds up every contribution. The adding matters: in x·x + x, x gets gradient from three places, so at x = 3 it’s 3 + 3 + 1 = 7.',
      { figure: 'graph' },
      'The CUDA kernels are written by hand: elementwise ops with grid-stride loops, sums and maxes with warp shuffles and shared memory, and a 16 × 16 tiled matrix multiply with transpose flags, so the backward pass never has to transpose anything. Softmax and cross-entropy are fused into one kernel, and Adam updates each parameter in place in one kernel too.',
      { figure: 'tiles' },
      'The backward kernels read their starting gradient from GPU memory, so a training step never has to wait on the CPU.',
      'Each test case runs through PyTorch and TensorFlow first, and both sets of answers are saved as fixtures. The Rust tests check ops, gradients, the loss, and five steps of Adam and SGD with momentum against both, on CPU and GPU, plus finite difference checks that don’t depend on either framework.',
      { figure: 'epsilon' },
      'The Node bindings, built with napi-rs, expose tensors, the model and Adam to TypeScript, so the same training loop runs from JavaScript.',
    ],
    outcomes: [
      'Trained a 235,146-parameter MLP on MNIST to 97.8% test accuracy in 10 epochs, using cross-entropy loss and Adam.',
      'Cut training from 2.83 s to 0.18 s per epoch on an RTX 4080 laptop GPU: about 16× faster than the single-threaded CPU backend.',
    ],
    lessons: 'Test against more than one reference. Adam matched PyTorch to 1e-4 but not TensorFlow, and the difference wasn’t a bug in my code: Keras adds epsilon to √v before bias correction, not after. With only one framework to check against, I’d never have known which answer was the convention and which was the mistake.',
    funFact: 'The whole framework is about 1,800 lines of Rust, and the CUDA kernels live in it as one big string. They’re compiled the first time the GPU is used, so it builds on a laptop with no CUDA toolkit or Visual Studio installed at all.',
  },
  {
    id: 'fpga-2048',
    name: 'FPGA 2048',
    kind: 'Digital hardware',
    date: 'September 2024',
    icon: '2048',
    tech: ['Verilog', 'VHDL', 'Quartus', 'ModelSim'],
    // opens the playable version in the games folder
    game: '2048',
    // interactive figures under these sections, see FpgaFigures.vue
    // the implementation list can drop them in between its paragraphs too
    figures: { lead: 'register' },
    summary: 'The tile-merging game, implemented in hardware on a DE1-SoC.',
    contribution: 'For ECE241 (Digital Systems), my partner and I built 2048 on an FPGA in Verilog. It runs on a 160 × 120 VGA display at 60 Hz through a custom VGA adapter, and you play it with a real PS/2 keyboard.',
    implementationTitle: 'How it works',
    implementation: [
      'The game is split into a datapath and an FSM controller, which handle moving, merging and scoring the tiles. We tested it with ModelSim testbenches, Tcl simulations and, finally, the actual board.',
      { subheading: 'Drawing tiles' },
      'Each tile, from 2 up to 2048, is a sprite stored in on-chip ROM. Multiplexers pick which sprite to draw and which cell it goes in, and registers hold that cell’s corner. Row and column counters then sweep across the tile one pixel at a time and send each pixel to the VGA adapter in one of 8 colours.',
      { figure: 'datapath' },
      { subheading: 'Sliding tiles' },
      'Moves work directly on the board register, in two steps. First, equal tiles combine, even if there are gaps between them. Then everything compacts toward the side you pushed.',
      { figure: 'slide' },
      { subheading: 'Reading the keyboard' },
      'A PS/2 keyboard sends a make code when a key goes down. When the key comes up, it sends a break code (F0) followed by the key’s code again. A one-hot FSM turns W, A, S and D into 0001, 0010, 0100 and 1000. A gap state swallows the extra code, so one press is always exactly one move.',
      { figure: 'fsm' },
      ['The ', { open: 'games', text: 'Games' }, ' folder has a browser version rebuilt from the same design. It includes the game-over check and sliding animation we had listed as next steps but never got to on the FPGA.'],
    ],
    lessonsTitle: 'What I learned',
    lessons: 'Integrate early. Every module passed its own testbench, but the bugs lived in the wires between them. Wire widths didn’t match, and one module numbered the board bus [0:63] while another used [63:0]. Next time, I’d agree on the interfaces first and wire the modules together while they’re still small.',
    funFact: 'The presentation for this project was due the same day as my interview with AMD, so I presented it to my interviewer as well! It went well enough, I spent the next 16 months interning there.',
  },
  {
    id: 'reversi-ai',
    name: 'Reversi AI Bot',
    kind: 'Game AI',
    date: 'February 2024',
    icon: 'reversi',
    tech: ['C'],
    // opens the playable version in the games folder
    game: 'reversi',
    // the board is the preview's figure too, see ReversiFigures.vue. contribution places
    // it itself, between its two paragraphs
    figures: { lead: 'board' },
    summary: 'A terminal Reversi clone written in C, with an AI opponent, built for my Computer Fundamentals course (APS105).',
    // these are lists of paragraphs, { figure }, { list } and { heading } items, and
    // paragraphs given as arrays can hold { open, text } links to other windows. see
    // writeup() in AppContent.vue
    contribution: [
      'Over three weeks, I rebuilt Reversi (aka Othello) from scratch in C. When I realized I had no one to play it with, I built my own opponent, Clippy. Give it a try!',
      { figure: 'board' },
      ['Unfortunately, the original source code is lost to the depths of Quercus. The version in the ', { open: 'games', text: 'Games' }, ' folder is a faithful recreation.'],
    ],
    implementationTitle: 'How Clippy thinks',
    implementation: [
      'Clippy scores each possible move by looking at board position, mobility and corner control.',
      'Board position starts from a table of weights. Corners are worth the most because a disc there can never be flipped. The squares next to an empty corner are the worst, because playing one usually hands the corner to your opponent.',
      { figure: 'weights' },
      'To score a move, Clippy plays it on a copy of the board and adds up three things:',
      { list: ['The weights of the squares each side holds', 'Mobility: how many moves it keeps compared with how many it leaves you', 'The corners it owns'] },
      'When there are 13 or fewer empty squares left, it also starts counting discs.',
      { figure: 'eval' },
      { heading: 'Looking ahead with minimax' },
      'This greedy approach has a flaw: the move that scores best right now can still turn out to be a mistake a few turns later. The solution is minimax.',
      'Minimax lets Clippy look two moves ahead. For each of its own moves, it assumes you’ll reply with the move that hurts it most. It then picks the move whose worst case is best.',
      { figure: 'lookahead' },
    ],
    outcomes: [
      '100% win rate against basic random-move bots',
      '80% win rate against bots built by other students in the course',
      'A reality check of how bad I was at Reversi',
    ],
    lessonsTitle: 'What I learned',
    lessons: [
      'Games that humans play by intuition are surprisingly hard to program well.',
      'Reversi is about as simple as it gets: there are only ever a handful of legal moves, and with enough compute the game is even solved. Getting a bot to play it well still showed me how much we weigh without noticing, like which squares matter, what the opponent might do next, and when to give something up now to win later.',
      'That makes me wonder about harder games, like ones with randomness (Slay the Spire) or ones where you play against several opponents at once (Teamfight Tactics). Maybe one of those will be my next project?',
    ],
    funFact: 'My record against Clippy is 2–48.',
  },
];
