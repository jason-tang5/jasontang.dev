<!-- the full writeup. the site shows a shorter version of it (src/content.mjs) -->

# LiftLens

*Computer vision · Fall 2026*

> A computer vision app that measures joint angles and bar path in Olympic lifts.

**Tech:** Python, OpenCV, PyTorch, ONNX Runtime, TypeScript, Next.js, FastAPI, Redis, Docker

## Why I built it

If you haven’t been around the block, Olympic lifts are one of the best compound movements you can do as an athlete. According to some random guy I saw online, the gold standard is a power clean of 1.5× bodyweight, so I figured, why not go for it?

## What is a power clean?

In a nutshell, a power clean takes a barbell from the floor to your shoulders in one explosive movement.

Think of it as a jump with a barbell in your hands. Your hips, knees and ankles straighten together in one burst, which is called triple extension. How well you do it depends on rate of force development, meaning how fast your muscles reach full force. A jump and a clean each last under a second, so the faster you build force, the higher you or the bar goes.

Form decides how much of that force reaches the bar. Three common faults leak it. If your hips rise before your shoulders, the work shifts onto your lower back. If your arms bend early, you’re pulling with your weaker arm muscles before your legs finish pushing. If the bar drifts away from your body, some of your force moves it sideways. My replays showed a problem and left me guessing at the cause, so I built something to measure it.

## What I built

LiftLens takes a side-on video of a snatch or clean & jerk, or a live webcam feed. It measures joint angles, bar path and bar speed through every phase of the lift, rep by rep.

*[Figure: angles]*

## How it works

### Tracking the body

The app uses a pose model, an AI that’s already learned what people look like. It finds 17 points on your body in every frame, like your shoulders, hips, knees and ankles. (Specifically, it’s a pretrained YOLOv8 model exported to ONNX so it runs fast.)

Connect three points and you get an angle. Hip, knee and ankle give you the knee angle; shoulder, hip and knee give you the hip angle; shoulder, elbow and wrist give you the elbow angle. The knee and hip show how your body rises off the floor. The elbow shows whether your arms bend too early.

The model also says how sure it is about each point. If it’s under 35% sure, the app leaves that angle blank, which beats showing you a made-up number.

### Finding the bar

This part took the most work. The usual approach would be training an AI to spot barbells, but that needs thousands of labelled videos, and I don’t have those yet. So I went old school.

From the side, a weight plate is just a circle with the bar through its middle. The pose model already knows where your body is, and at the start of a lift the plates sit right by your ankles. So the app only looks there. A classic circle-finding algorithm called a Hough transform spots candidates, and each one gets scored on how much of its outline lines up with a real edge in the image.

*[Figure: plate]*

Knees and plates sitting on the rack also look like circles, but they rarely hold still. The app only trusts a circle once it shows up in the same spot and size three times in a row.

### Following the bar

Once it has the plate, the app follows it frame by frame, up to 60 times a second. Each frame, it guesses where the plate moved and looks for the circle around that spot. If the bar moves too fast and blurs, it matches against the last clear picture of the plate. If it loses the plate for 0.3 seconds, it stops tracking.

Getting speed from position sounds easy: divide distance by time. But tracking is a little jittery, and the jitter turns into huge spikes in speed. The common fix, averaging nearby frames, smooths the spikes and also smears out the moment you care about most, the top speed at the end of your pull. So the app fits a small curve through the points around each frame and reads the speed off that.

*[Figure: smooth]*

### Measuring in real units

Here’s the trick: every competition plate is 450 mm across. So if a plate is 90 pixels wide on screen, each pixel is 5 mm. That lets the app report bar speed in real metres per second with no setup. Coaches use bar speed to program training, so that number is useful on its own.

### Running it

You can upload a video or use your webcam. Uploaded videos go to a server that processes them in a queue (FastAPI, Redis and a Python worker) while the page shows progress. Webcam mode runs the whole model inside your browser, so your video never gets uploaded anywhere.

### Comparing reps

A slow rep and a fast rep take different amounts of time, so the app stretches every rep to the same 101 steps from start to finish. That way two lifts line up moment by moment on the same chart.

*[Figure: reps]*

## What it showed me

My first cleans through LiftLens showed my hips rising before the bar passed my knees. The numbers put a size on it: from the floor to my knees, my knee angle opened 43° while my hip angle opened only 21°. In plain terms, my legs straightened twice as fast as my back came up, so my butt shot up first and my back did the lifting.

*[Figure: hips]*

I now film every heavy session. The target is still a power clean at 1.5× bodyweight.

## What I learned

A clean takes under a second, and the mistakes that cost you power happen in a fraction of that, way too fast to catch by eye. Measuring the angles caught things I’d missed watching the replays over and over. Speed took the same care: the top speed lasts about 50 ms, and my first attempt at smoothing it flattened the peak and placed it too late, so I switched to the curve fit. Finding the bar taught me to use what I already had. I couldn’t train a barbell detector without labelled videos, but the pose model already knew where the ankles were, and the plates’ fixed 450 mm size gave me both where the bar was and how fast it was going.

## Fun fact

Competition bumper plates all measure 450 mm across, from 10 kg to 25 kg. The plate works as a ruler whatever is loaded on the bar.
