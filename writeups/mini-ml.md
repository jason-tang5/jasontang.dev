<!-- the full writeup. the site shows a shorter version of it (src/content.mjs) -->

# Mini ML Framework

*Machine learning · Summer 2026*

> A small ML framework in Rust, from tensors to GPU training.

**Tech:** Rust, CUDA, TypeScript, PyTorch, TensorFlow

## Why I built it

I watched [3Blue1Brown’s neural network series](https://www.youtube.com/watch?v=aircAruvnKk&list=PLOH0RpNCcyWRxD8bYrbZbVZrto0U8axHR) and wanted to try it myself. PyTorch turns training a neural network into a few lines of code, but I wanted to know what those lines actually do, so I built the whole thing myself, from the numbers up to the GPU.

## What I built

A small deep learning library in Rust. It stores numbers in tensors (grids of numbers, like a spreadsheet with any number of dimensions), works out gradients automatically, and runs on either the CPU or an NVIDIA GPU. TypeScript bindings let you drive it from Node.js too.

To prove it works, I trained it to read handwritten digits from MNIST, the classic first dataset in machine learning. It gets 97.8% right on digits it has never seen, and the GPU trains about 16× faster than the CPU.

## How it works

### Working out gradients

Training means nudging every weight in the direction that makes the model a little less wrong. The gradient tells you which way that is. Working it out by hand for hundreds of thousands of weights is impossible, so the library does it automatically.

Every operation remembers what went into it and how to undo its effect on the gradient. Calling backward on the loss walks that chain in reverse and adds up every contribution. The adding matters: in (x·w + x)·(x + w), x feeds in from three places, so at x = 4 and w = 2 its gradient is 12 + 6 + 12 = 30 (Fig. 2).

*[Figure: graph]*

### Running on the GPU

A GPU is thousands of small cores doing the same thing at once, which is exactly what multiplying big grids of numbers needs. The code that runs on those cores is called a CUDA kernel.

The most important one is matrix multiply. Reading from the GPU’s main memory is slow, so the kernel copies 16 × 16 tiles into fast shared memory and lets a block of threads reuse each tile many times before fetching the next (Fig. 3). Transpose flags let the same kernel run the backward pass without copying anything.

*[Figure: tiles]*

Fewer trips to memory was the theme everywhere else too. Softmax and the loss run as one kernel instead of two, Adam updates each weight in place in a single kernel, and the backward pass starts straight from GPU memory, so a training step never waits on the CPU.

### Checking the math

A bug in a gradient doesn’t crash anything. The model just learns badly, and you can’t tell why. So every test case runs through PyTorch and TensorFlow first, and both sets of answers are saved. The Rust tests check every operation, gradient, the loss, and five steps of Adam and SGD against both, on CPU and GPU.

On top of that, finite difference checks nudge each input a tiny bit and compare the change with the gradient, which doesn’t rely on either framework being right.

### Using it from JavaScript

Bindings built with napi-rs expose tensors, the model and Adam to TypeScript, so the same training loop runs from Node.js.

## Results

- Trained a 235,146-parameter network on MNIST to **97.8% test accuracy** in 10 epochs.
- Cut training from 2.83 s to 0.18 s per epoch on an RTX 4080 laptop GPU, **about 16× faster** than the single-threaded CPU backend.

## What I learned

Test against more than one reference. Adam matched PyTorch to 1e-4 but not TensorFlow, and the difference wasn’t a bug in my code: Keras adds epsilon to √v before bias correction, not after. With only one framework to check against, I’d never have known which answer was the convention and which was the mistake (Fig. 4).

*[Figure: epsilon]*

Speed on a GPU is mostly about memory, not math. The cores are rarely the bottleneck; waiting on data is. Tiling, fusing kernels and keeping the whole step on the GPU all come down to the same thing: touch main memory as little as possible.

## Fun fact

The whole framework is about 1,800 lines of Rust, and the CUDA kernels live in it as one big string. They’re compiled the first time the GPU is used, so it builds on a laptop with no CUDA toolkit or Visual Studio installed at all.
