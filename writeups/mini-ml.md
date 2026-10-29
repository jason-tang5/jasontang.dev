<!-- the full writeup. the site shows a shorter version of it (src/content.mjs) -->

# Mini ML Framework

*Machine learning · Summer 2026*

> A small ML framework in Rust, from tensors to GPU training.

**Tech:** Rust, CUDA, TypeScript, PyTorch, TensorFlow

## Why I built it

I watched [3Blue1Brown’s neural network series](https://www.youtube.com/watch?v=aircAruvnKk&list=PLOH0RpNCcyWRxD8bYrbZbVZrto0U8axHR) and wanted to try it myself. PyTorch turns training a neural network into a few lines of code, but I wanted to know what those lines actually do, so I built the whole thing myself, from the numbers up to the GPU.

## What I built

A small deep learning library in Rust. It stores numbers in tensors (grids of numbers, like a spreadsheet with any number of dimensions), works out gradients automatically, and runs on either the CPU or an NVIDIA GPU. TypeScript bindings let you drive it from Node.js too.

To prove it works, I trained it to read handwritten digits from MNIST, the classic first dataset in machine learning (Fig. 1). It gets 97.8% right on digits it has never seen, and the GPU trains about 16× faster than the single-threaded CPU backend.

*[Figure: train]*

## How it works

### What it learns

The network is the one from [3Blue1Brown’s first lesson](https://www.3blue1brown.com/lessons/neural-networks), scaled up. Each neuron holds one number. A neuron in the next layer takes a weighted sum of every number in the layer before it, adds its bias, and passes the result through an activation function. Doing that for a whole layer at once is a single matrix multiply, plus adding the biases, which is why matrix multiply is the kernel worth making fast (Fig. 2).

*[Figure: layer]*

Mine takes the 784 pixels of a digit, passes them through hidden layers of 256 and 128 neurons, and ends in 10 outputs, one per digit. That’s 235,146 weights and biases to tune, against the 13,002 in the videos. It also makes two more modern choices. The first is ReLU as the activation function instead of sigmoid. Sigmoid squashes every sum into the range 0 to 1. ReLU just keeps a positive sum as it is and turns a negative one into 0, and the series points out that ReLU is the more common choice today. The second is cross-entropy for the cost instead of squared error.

Learning works the way [lesson 2](https://www.3blue1brown.com/lessons/gradient-descent) describes. The cost is one number that says how wrong the network is, and it depends on every weight. The gradient points in the direction that raises the cost fastest, so each step moves every weight a little the other way. As in [lesson 3](https://www.3blue1brown.com/lessons/backpropagation), each step uses a shuffled mini-batch of 128 digits rather than all 60,000. The path downhill gets a little wobbly, but each step is about 470 times cheaper. Adam decides how big each weight’s step is (see Picking an optimizer).

### Working out gradients

The gradient has one entry per weight, so working it out by hand is impossible. Backpropagation works it out with the chain rule. [Lesson 4](https://www.3blue1brown.com/lessons/backpropagation-calculus) breaks the effect of one weight on the cost into a product of small, local sensitivities, one for each step between them. The library stores that local rule with every operation. An add passes the gradient straight through, and a multiply scales it by the other input. Calling backward on the loss walks the chain in reverse and applies each rule.

The same lesson’s key point is that when a value feeds several places, its effect on the cost is the sum over every path. So the library adds gradients and never overwrites them. In (x·w + x)·(x + w), x feeds in from three places, so at x = 4 and w = 2 its gradient is 12 + 6 + 12 = 30 (Fig. 3). Overwriting would keep only the last piece, 12, and nothing would crash.

*[Figure: graph]*

### Running on the GPU

A GPU is thousands of small cores doing the same thing at once, which is exactly what multiplying big grids of numbers needs. The code that runs on those cores is called a CUDA kernel.

The most important one is matrix multiply. Reading from the GPU’s main memory is slow, so the kernel copies 16 × 16 tiles into fast shared memory and lets a block of threads reuse each tile many times before fetching the next (Fig. 4). The backward pass needs the same matrices flipped (transposed), so the kernel takes flags that read them in flipped order instead of making flipped copies first.

*[Figure: tiles]*

Fewer trips to memory was the theme everywhere else too. Softmax and the loss run as one kernel instead of two, and Adam updates each weight tensor in place with one kernel. The backward kernels read their gradients straight from GPU memory, so a training step never has to stop and wait for the CPU.

### Picking an optimizer

The gradient says which way is downhill. The optimizer decides how far to step. Plain SGD moves every weight by the learning rate times its gradient. Momentum keeps a running sum of past gradients where older ones slowly fade, so it builds up speed on a long slope and rolls through small bumps. RMSProp divides each weight’s gradient by a running average of its size, so every weight gets its own step size: steep directions get smaller steps and flat ones bigger ones. Adam does both. It divides Momentum’s running gradient by RMSProp’s running size, with a correction for the first few steps, when both averages are still near zero.

The framework ships SGD with momentum and Adam, and Fig. 5 adds plain SGD and RMSProp for comparison. None of them wins everywhere. In a long narrow ravine, SGD bounces between the walls while Adam and RMSProp head straight down the floor. On a ridge where the slope is nearly zero, the adaptive two still take full steps. Past a small dip, only Momentum has the speed to roll through, because Adam’s steps stay near the learning rate. In a plain round bowl, plain SGD gets there first.

*[Figure: optim]*

### Checking the math

A bug in a gradient doesn’t crash anything. The model just learns badly, and you can’t tell why. So every test case runs through PyTorch and TensorFlow first, and both sets of answers are saved. The Rust tests check every operation, gradient, the loss, and five steps of Adam and SGD against both, on CPU and GPU.

On top of that, finite difference checks nudge each input a tiny bit and compare the change with the gradient, which doesn’t rely on either framework being right.

### Using it from JavaScript

Bindings built with napi-rs expose tensors, the model and Adam to TypeScript, so the same training loop runs from Node.js.

## Results

- Trained a 235,146-parameter network on MNIST to **97.8% test accuracy** in 10 epochs.
- Cut training from 2.83 s to 0.18 s per epoch on an RTX 4080 laptop GPU, **about 16× faster** than the single-threaded CPU backend.

## What I learned

Test against more than one reference. Adam matched PyTorch to 1e-4 but not TensorFlow, and the difference wasn’t a bug in my code: Keras adds epsilon to √v before bias correction, not after. With only one framework to check against, I’d never have known which answer was the convention and which was the mistake (Fig. 6).

*[Figure: epsilon]*

Speed on a GPU is mostly about memory, not math. The cores are rarely the bottleneck; waiting on data is. Tiling, fusing kernels and keeping the whole step on the GPU all come down to the same thing: touch main memory as little as possible.

## Fun fact

The whole framework is about 1,800 lines of Rust, and the CUDA kernels live in it as one big string. They’re compiled the first time the GPU is used, so it builds on a laptop with no CUDA toolkit or Visual Studio installed at all.
