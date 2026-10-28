<!-- the full writeup. the site shows a shorter version of it (src/content.mjs) -->

# Reversi AI Bot

*Game AI · Winter 2024*

> A terminal Reversi clone written in C, with an AI opponent, built for my Computer Fundamentals course (APS105).

**Tech:** C

## What I built

Over three weeks, I rebuilt Reversi (aka Othello) from scratch in C. When I realized I had no one to play it with, I built my own opponent, Clippy. Give it a try!

*[Figure: board]*

Unfortunately, the original source code is lost to the depths of Quercus. The version in the Games folder is a faithful recreation.

## How Clippy thinks

Clippy scores each possible move by looking at board position, mobility and corner control.

Board position starts from a table of weights. Corners are worth the most because a disc there can never be flipped. The squares next to an empty corner are the worst, because playing one usually hands the corner to your opponent.

*[Figure: weights]*

To score a move, Clippy plays it on a copy of the board and adds up three things:

1. The weights of the squares each side holds
2. Mobility: how many moves it keeps compared with how many it leaves you
3. The corners it owns

When there are 13 or fewer empty squares left, it also starts counting discs.

*[Figure: eval]*

## Looking ahead with minimax

This greedy approach has a flaw: the move that scores best right now can still turn out to be a mistake a few turns later. The solution is minimax.

Minimax lets Clippy look two moves ahead. For each of its own moves, it assumes you’ll reply with the move that hurts it most. It then picks the move whose worst case is best.

*[Figure: lookahead]*

## Outcomes

- 100% win rate against basic random-move bots
- 80% win rate against bots built by other students in the course
- A reality check of how bad I was at Reversi

## What I learned

Games that humans play by intuition are surprisingly hard to program well.

Reversi is about as simple as it gets: there are only ever a handful of legal moves, and with enough compute the game is even solved. Getting a bot to play it well still showed me how much we weigh without noticing, like which squares matter, what the opponent might do next, and when to give something up now to win later.

That makes me wonder about harder games, like ones with randomness (Slay the Spire) or ones where you play against several opponents at once (Teamfight Tactics). Maybe one of those will be my next project?

## Fun fact

My record against Clippy is 2–48.
