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
      'If you haven’t been around the block, Olympic lifts are one of the best compound movements you can do as an athlete. According to some random guy I saw online, the gold standard is a power clean of 1.5× bodyweight, so I figured, why not go for it?',
      { heading: 'What is a power clean?' },
      'In a nutshell, a power clean takes a barbell from the floor to your shoulders in one explosive movement.',
      'Think of it as a jump with a barbell in your hands. Your hips, knees and ankles straighten together in one burst, which is called triple extension. How well you do it depends on rate of force development, meaning how fast your muscles reach full force. A jump and a clean each last under a second, so the faster you build force, the higher you or the bar goes.',
      'Form decides how much of that force reaches the bar. Three common faults leak it. If your hips rise before your shoulders, the work shifts onto your lower back. If your arms bend early, you’re pulling with your weaker arm muscles before your legs finish pushing. If the bar drifts away from your body, some of your force moves it sideways. My replays showed a problem and left me guessing at the cause, so I built something to measure it.',
    ],
    contribution: [
      'LiftLens takes a side-on video of a snatch or clean & jerk, or a live webcam feed. It measures joint angles, bar path and bar speed through every phase of the lift, rep by rep.',
      { figure: 'angles' },
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'Tracking the body' },
      'The app uses a pose model, an AI that’s already learned what people look like. It finds 17 points on your body in every frame, like your shoulders, hips, knees and ankles. (Specifically, it’s a pretrained YOLOv8 model exported to ONNX so it runs fast.)',
      'Connect three points and you get an angle. Hip, knee and ankle give you the knee angle; shoulder, hip and knee give you the hip angle; shoulder, elbow and wrist give you the elbow angle. The knee and hip show how your body rises off the floor. The elbow shows whether your arms bend too early.',
      'The model also says how sure it is about each point. If it’s under 35% sure, the app leaves that angle blank, which beats showing you a made-up number.',
      { subheading: 'Finding the bar' },
      'This part took the most work. The usual approach would be training an AI to spot barbells, but that needs thousands of labelled videos, and I don’t have those yet. So I went old school.',
      'From the side, a weight plate is just a circle with the bar through its middle. The pose model already knows where your body is, and at the start of a lift the plates sit right by your ankles. So the app only looks there. A classic circle-finding algorithm called a Hough transform spots candidates, and each one gets scored on how much of its outline lines up with a real edge in the image.',
      { figure: 'plate' },
      'Knees and plates sitting on the rack also look like circles, but they rarely hold still. The app only trusts a circle once it shows up in the same spot and size three times in a row.',
      { subheading: 'Following the bar' },
      'Once it has the plate, the app follows it frame by frame, up to 60 times a second. Each frame, it guesses where the plate moved and looks for the circle around that spot. If the bar moves too fast and blurs, it matches against the last clear picture of the plate. If it loses the plate for 0.3 seconds, it stops tracking.',
      'Getting speed from position sounds easy: divide distance by time. But tracking is a little jittery, and the jitter turns into huge spikes in speed. The common fix, averaging nearby frames, smooths the spikes and also smears out the moment you care about most, the top speed at the end of your pull. So the app fits a small curve through the points around each frame and reads the speed off that.',
      { figure: 'smooth' },
      { subheading: 'Measuring in real units' },
      'Here’s the trick: every competition plate is 450 mm across. So if a plate is 90 pixels wide on screen, each pixel is 5 mm. That lets the app report bar speed in real metres per second with no setup. Coaches use bar speed to program training, so that number is useful on its own.',
      { subheading: 'Running it' },
      'You can upload a video or use your webcam. Uploaded videos go to a server that processes them in a queue (FastAPI, Redis and a Python worker) while the page shows progress. Webcam mode runs the whole model inside your browser, so your video never gets uploaded anywhere.',
      { subheading: 'Comparing reps' },
      'A slow rep and a fast rep take different amounts of time, so the app stretches every rep to the same 101 steps from start to finish. That way two lifts line up moment by moment on the same chart.',
      // the numbers here come from the clean in Fig. 1 (liftlens-clip.mjs and its export)
      { heading: 'What it showed me' },
      'My first cleans through LiftLens showed my hips rising before the bar passed my knees. The numbers put a size on it: from the floor to my knees, my knee angle opened 43° while my hip angle opened only 21°. In plain terms, my legs straightened twice as fast as my back came up, so my butt shot up first and my back did the lifting.',
      'I now film every heavy session. The target is still a power clean at 1.5× bodyweight.',
      { heading: 'What I learned' },
      'A clean takes under a second, and the mistakes that cost you power happen in a fraction of that, way too fast to catch by eye. Measuring the angles caught things I’d missed watching the replays over and over. Speed took the same care: the top speed lasts about 50 ms, and my first attempt at smoothing it flattened the peak and placed it too late, so I switched to the curve fit. Finding the bar taught me to use what I already had. I couldn’t train a barbell detector without labelled videos, but the pose model already knew where the ankles were, and the plates’ fixed 450 mm size gave me both where the bar was and how fast it was going.',
    ],
    funFact: 'Competition bumper plates all measure 450 mm across, from 10 kg to 25 kg. The plate works as a ruler whatever is loaded on the bar.',
  },
  {
    id: 'msn-messenger',
    name: 'MSN Messenger',
    kind: 'Real-time web',
    date: 'October 2026',
    icon: 'messenger',
    // opens the chat itself on the desktop
    app: 'chat',
    tech: ['JavaScript', 'Vue', 'Cloudflare Workers', 'Durable Objects', 'WebSockets', 'SQLite', 'Turnstile', 'Playwright'],
    // interactive figures, see MessengerFigures.vue. the lead is an animation, and
    // implementation places the rest
    figures: { lead: 'lobby' },
    summary: 'A public chat room for everyone visiting this site, styled after MSN Messenger.',
    why: [
      'The Analytics window tells you who’s here. I wanted a way to say hi. And what’s an early-2000s desktop without a messenger?',
    ],
    contribution: [
      ['Open ', { open: 'chat', text: 'MSN Messenger' }, ' on the desktop, pick a nickname, and you’re in one shared lobby with everyone else on the site. Messages show up for everyone the moment they’re sent. You can see who’s online, your draft survives a dropped connection, and I can moderate the room from the same window.'],
    ],
    implementationTitle: 'How it works',
    implementation: [
      { subheading: 'One room, one object' },
      'The whole room is a single Cloudflare Durable Object called lobby. Think of it as one tiny server that every visitor talks to, with its own SQLite database for messages and sessions. Each browser keeps a WebSocket open to it, a connection that stays open so the room can push new messages the moment they arrive instead of waiting for you to ask (Fig. 1).',
      'Because there’s only one room, there’s only one copy of the truth. Every send runs start to finish before the next one begins, so two messages can never trip over each other, and a mute or a ban can’t land halfway through a send.',
      { subheading: 'Sleeping between messages' },
      'Most of the time, nobody’s typing. Keeping a server awake to watch quiet sockets would be a waste, so the lobby uses Cloudflare’s hibernating WebSockets. When things go quiet, the room leaves memory, but every visitor stays connected. The next message wakes it right back up (Fig. 2).',
      { figure: 'sleep' },
      'The catch is that everything in memory is wiped each time it sleeps. My first design kept each visitor’s recent send times in a variable, which would have let a nap reset everyone’s rate limit. So those times live in SQLite instead, and the tests rebuild the room from scratch mid-test to prove the limits survive.',
      { subheading: 'Keeping it friendly' },
      'A public text box on the internet attracts exactly who you’d expect. Every message runs a gauntlet before it’s saved: 250 characters max, the same profanity filter as the Snake leaderboard, a 3-second slow mode, 20 messages a minute, and no repeats of your last three (Fig. 3).',
      { figure: 'checks' },
      'Signing in needs a Cloudflare Turnstile check, so bots can’t mint sessions, and each network gets 10 sign-ins every 10 minutes. Your session is a random cookie that your browser can’t read from JavaScript. The server only stores a hash of it, and only a daily-salted hash of your IP, never the address itself.',
      'When I’m signed in through Cloudflare Access, the window grows a Moderation button. I can delete messages, mute someone for 10 minutes or an hour, ban a session, change the slow mode, or shut the room off entirely.',
      { subheading: 'Never sending twice' },
      'Phones drop connections all the time. If yours drops after the room saved your message but before you heard back, your browser can’t tell whether it went through. So every message carries a random retry ID. When the browser reconnects, it just sends again with the same ID, and if the room already has it, it answers “got it” without saving a second copy (Fig. 4).',
      { figure: 'retry' },
      { heading: 'Other approaches I considered' },
      { table: [
        ['Approach', 'Pros', 'Cons'],
        ['**One Durable Object** (what I built)', 'One copy of the truth, so sends never race. New messages are pushed the instant they’re saved. It sleeps when the room is quiet, so an idle chat costs next to nothing. It lives in the same Worker as the rest of the site.', 'One object can only serve so many people at once: plenty for a portfolio, not for a big app. Memory is wiped on every nap, so anything that matters has to live in SQLite. It ties me to Cloudflare.'],
        ['**Supabase Realtime**', 'Postgres, live updates and sign-in out of the box.', 'Three systems (database, realtime and functions) that have to agree. Rate limits and moderation would sit in database rules or a separate function, away from the send itself. One more service and bill outside the site.'],
        ['**Polling an API**', 'The simplest to build: plain requests, no open connections, works everywhere.', 'Messages show up late, by up to one poll. Every open tab keeps asking the server for nothing.'],
        ['**Node and Socket.IO on a server**', 'Familiar, full control, a huge ecosystem.', 'A server running 24/7 for a room that’s empty most of the day. Uptime, scaling and patches are on me. Spread across more than one server, it needs Redis to share messages between them.'],
      ] },
      { heading: 'What I learned' },
      'Give shared state one owner. Because a single object owns the room, every send runs in order and there’s nothing to lock. Two servers can’t disagree about who’s muted because there’s only one. If the chat ever needed more rooms, the way to grow is one object per room, not locks around one big room.',
      'Treat memory as a cache. Hibernation means the room can vanish between any two messages, so anything that has to survive (sessions, mutes, rate limits) goes in SQLite. It’s the same rule as running stateless servers behind a load balancer: whatever only lives in memory is allowed to disappear.',
      'Networks deliver at least once, so make every write safe to repeat. You can’t guarantee a message arrives exactly once over a phone connection, but a retry ID turns “maybe sent” into “safe to send again”. Payment APIs like Stripe use the same idea with idempotency keys.',
      'Enforce rules where the data is written. Every check runs inside the room, right before the save, so the browser is only a convenience and can’t be trusted to skip anything. Playwright then tests it the way it really runs, with two visitors against the real Worker, SQLite and WebSockets.',
    ],
    funFact: 'Windows Live Messenger shut down in 2013 (2014 in China), and everyone was moved over to Skype. Skype itself shut down in May 2025, so for now this little lobby has outlived them both.',
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
