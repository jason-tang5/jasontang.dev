// the bar path of a 105 kg power clean, in assets/projects/liftlens-path.mp4, from
// liftlens's analysis of the original recording (its Export JSON). the path is the
// centre of the far plate, in cm from where it sat at setup: x is toward the lifter, who
// faces left, and y is up. speed is the bar's upward m/s, scaled from the 450 mm plate.
// the clip starts 0.85 s into the original, so the times here are shifted to match it.
// the path runs from setup to the top of the pull, and the clip carries on into the catch
export const pathClip = { duration: 1.9 };

// [seconds, x, height, bar speed]
export const path = [
  [0.123, 0.0, 0.0, 0.00],
  [0.190, 0.0, 0.1, 0.04],
  [0.257, -0.1, 0.5, 0.11],
  [0.323, -0.2, 1.5, 0.23],
  [0.390, -0.1, 3.6, 0.39],
  [0.457, 0.3, 6.7, 0.56],
  [0.523, 0.8, 11.0, 0.71],
  [0.590, 1.5, 16.1, 0.85],
  [0.657, 2.2, 22.4, 1.00],
  [0.723, 3.0, 29.4, 1.05],
  [0.790, 3.4, 36.4, 1.07],
  [0.857, 2.0, 43.6, 1.20],
  [0.923, 0.2, 52.4, 1.45],
  [0.990, -0.3, 62.7, 1.50],
  [1.057, 0.8, 72.3, 1.32],
  [1.123, 2.2, 80.3, 0.97],
  [1.190, 3.9, 85.3, 0.53],
  [1.257, 5.8, 87.4, 0.10],
  [1.323, 7.1, 88.9, 0.22],
  [1.390, 7.3, 90.4, -1.09],
];
