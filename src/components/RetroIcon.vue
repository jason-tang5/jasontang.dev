<script setup>
// hand drawn 32x32 pixel icons for the desktop, menus and taskbar.
// "small" shrinks it for the taskbar and title bars. anything unknown falls back to a document.
import { balloonColors, balloonFrames, balloonString } from '../balloon-sprite.js';

defineProps({ name: { type: String, default: 'document' }, small: Boolean });
const [balloonBody, balloonEdge] = balloonColors[0];
</script>
<template>
  <svg :class="['retro-icon', { small }]" viewBox="0 0 32 32" aria-hidden="true" shape-rendering="crispEdges">
    <g stroke="#111" stroke-width="1" stroke-linejoin="miter">
      <!-- three bars stepping up side by side, sharing their thick outlines, on a base,
           each lit from the top left -->
      <g v-if="name === 'messenger'" stroke="#355b72">
        <path fill="#80bbec" d="M18 4h7v2h2v7h-2v2h-7v-2h-2V6h2zM17 16h9l4 5v7H14v-7z"/>
        <path fill="#76c752" d="M7 3h7v2h2v8h-2v2H7v-2H5V5h2zM5 16h11l4 6v8H1v-8z"/>
        <path fill="#b9ef95" stroke="none" d="M7 5h5v2H7zM3 23h2v5H3zM6 18h6v2H6z"/>
        <path fill="#d5edff" stroke="none" d="M19 6h4v2h-4zM22 18h3v2h-3z"/>
      </g>
      <g v-else-if="name === 'chart'" stroke="none">
        <path fill="#111" d="M4 14h9v12H4zM11 8h9v18h-9zM18 2h9v24h-9zM2 26h28v2H2z"/>
        <path fill="#c8c8c8" d="M2 28h28v2H2z"/>
        <path fill="#1f6fc4" d="M6 16h5v10H6z"/>
        <path fill="#f7c928" d="M13 10h5v16h-5z"/>
        <path fill="#e0261b" d="M20 4h5v22h-5z"/>
        <!-- a little light down the left of each bar and shade down the right, lit from
             the top left like the other icons -->
        <path fill="#4f8fd6" d="M6 16h1v10H6z"/>
        <path fill="#1a5ca4" d="M10 16h1v10h-1z"/>
        <path fill="#fbd955" d="M13 10h1v16h-1z"/>
        <path fill="#d8ac12" d="M17 10h1v16h-1z"/>
        <path fill="#ea5047" d="M20 4h1v22h-1z"/>
        <path fill="#b81f16" d="M24 4h1v22h-1z"/>
      </g>
      <!-- the linkedin badge: a blue square with a white "in". the letters are separate
           so they can bounce on the about page -->
      <g v-else-if="name === 'linkedin'" stroke="none">
        <path fill="#111" d="M3 1h26v1h-26zM2 2h1v1h-1zM29 2h1v1h-1zM1 3h1v1h-1zM30 3h1v1h-1zM1 4h1v1h-1zM30 4h1v1h-1zM1 5h1v1h-1zM30 5h1v1h-1zM1 6h1v1h-1zM30 6h1v1h-1zM1 7h1v1h-1zM30 7h1v1h-1zM1 8h1v1h-1zM30 8h1v1h-1zM1 9h1v1h-1zM30 9h1v1h-1zM1 10h1v1h-1zM30 10h1v1h-1zM1 11h1v1h-1zM30 11h1v1h-1zM1 12h1v1h-1zM30 12h1v1h-1zM1 13h1v1h-1zM30 13h1v1h-1zM1 14h1v1h-1zM30 14h1v1h-1zM1 15h1v1h-1zM30 15h1v1h-1zM1 16h1v1h-1zM30 16h1v1h-1zM1 17h1v1h-1zM30 17h1v1h-1zM1 18h1v1h-1zM30 18h1v1h-1zM1 19h1v1h-1zM30 19h1v1h-1zM1 20h1v1h-1zM30 20h1v1h-1zM1 21h1v1h-1zM30 21h1v1h-1zM1 22h1v1h-1zM30 22h1v1h-1zM1 23h1v1h-1zM30 23h1v1h-1zM1 24h1v1h-1zM30 24h1v1h-1zM1 25h1v1h-1zM30 25h1v1h-1zM1 26h1v1h-1zM30 26h1v1h-1zM1 27h1v1h-1zM30 27h1v1h-1zM1 28h1v1h-1zM30 28h1v1h-1zM2 29h1v1h-1zM29 29h1v1h-1zM3 30h26v1h-26z"/>
        <path fill="#0a66c2" d="M3 2h26v1h-26zM2 3h1v1h-1zM29 3h1v1h-1zM2 4h1v1h-1zM4 4h26v1h-26zM2 5h1v1h-1zM4 5h26v1h-26zM2 6h1v1h-1zM4 6h26v1h-26zM2 7h1v1h-1zM4 7h26v1h-26zM2 8h1v1h-1zM4 8h26v1h-26zM2 9h1v1h-1zM4 9h26v1h-26zM2 10h1v1h-1zM4 10h26v1h-26zM2 11h1v1h-1zM4 11h26v1h-26zM2 12h1v1h-1zM4 12h26v1h-26zM2 13h1v1h-1zM4 13h26v1h-26zM2 14h1v1h-1zM4 14h26v1h-26zM2 15h1v1h-1zM4 15h26v1h-26zM2 16h1v1h-1zM4 16h26v1h-26zM2 17h1v1h-1zM4 17h26v1h-26zM2 18h1v1h-1zM4 18h26v1h-26zM2 19h1v1h-1zM4 19h26v1h-26zM2 20h1v1h-1zM4 20h26v1h-26zM2 21h1v1h-1zM4 21h26v1h-26zM2 22h1v1h-1zM4 22h26v1h-26zM2 23h1v1h-1zM4 23h26v1h-26zM2 24h1v1h-1zM4 24h26v1h-26zM2 25h1v1h-1zM4 25h26v1h-26zM2 26h1v1h-1zM4 26h26v1h-26zM2 27h1v1h-1zM4 27h26v1h-26zM2 28h1v1h-1zM4 28h26v1h-26zM3 29h26v1h-26z"/>
        <path fill="#3b8ad8" d="M3 3h26v1h-26zM3 4h1v1h-1zM3 5h1v1h-1zM3 6h1v1h-1zM3 7h1v1h-1zM3 8h1v1h-1zM3 9h1v1h-1zM3 10h1v1h-1zM3 11h1v1h-1zM3 12h1v1h-1zM3 13h1v1h-1zM3 14h1v1h-1zM3 15h1v1h-1zM3 16h1v1h-1zM3 17h1v1h-1zM3 18h1v1h-1zM3 19h1v1h-1zM3 20h1v1h-1zM3 21h1v1h-1zM3 22h1v1h-1zM3 23h1v1h-1zM3 24h1v1h-1zM3 25h1v1h-1zM3 26h1v1h-1zM3 27h1v1h-1zM3 28h1v1h-1z"/>
        <path class="li-dot" fill="#fff" d="M7 6h4v4H7z"/>
        <path class="li-i" fill="#fff" d="M7 12h4v15H7z"/>
        <path class="li-n" fill="#fff" d="M13 12h4v15h-4zM17 12h5v1h-5zM17 13h6v1h-6zM20 14h4v13h-4z"/>
      </g>
      <!-- the github cat, cut out of a dark circle. its tail is drawn separately so it
           can wag on the about page -->
      <g v-else-if="name === 'github'" stroke="none">
        <path fill="#24292f" d="M14 1h4v1H14zM10 2h12v1H10zM8 3h16v1H8zM7 4h18v1H7zM6 5h20v1H6zM5 6h4v1H5zM10 6h12v1H10zM23 6h4v1H23zM4 7h5v1H4zM11 7h10v1H11zM23 7h5v1H23zM3 8h6v1H3zM12 8h8v1H12zM23 8h6v1H23zM3 9h6v1H3zM23 9h6v1H23zM2 10h6v1H2zM24 10h6v1H24zM2 11h6v1H2zM24 11h6v1H24zM2 12h6v1H2zM24 12h6v1H24zM2 13h6v1H2zM24 13h6v1H24zM1 14h7v1H1zM24 14h7v1H24zM1 15h7v1H1zM24 15h7v1H24zM1 16h7v1H1zM24 16h7v1H24zM1 17h8v1H1zM23 17h8v1H23zM2 18h8v1H2zM22 18h8v1H22zM2 19h10v1H2zM20 19h10v1H20zM2 20h4v1H2zM7 20h6v1H7zM19 20h11v1H19zM2 21h4v1H2zM8 21h5v1H8zM19 21h11v1H19zM3 22h4v1H3zM10 22h3v1H10zM19 22h10v1H19zM3 23h5v1H3zM19 23h10v1H19zM4 24h6v1H4zM19 24h9v1H19zM5 25h7v1H5zM20 25h7v1H20zM6 26h6v1H6zM20 26h6v1H20zM7 27h5v1H7zM20 27h5v1H20zM8 28h4v1H8zM20 28h4v1H20zM10 29h2v1H10zM20 29h2v1H20zM6 20h1v1H6zM6 21h2v1H6zM7 22h3v1H7zM8 23h5v1H8z"/>
        <path fill="#fff" d="M9 6h1v1H9zM22 6h1v1H22zM9 7h2v1H9zM21 7h2v1H21zM9 8h3v1H9zM20 8h3v1H20zM9 9h14v1H9zM8 10h16v1H8zM8 11h16v1H8zM8 12h16v1H8zM8 13h16v1H8zM8 14h16v1H8zM8 15h16v1H8zM8 16h16v1H8zM9 17h14v1H9zM10 18h12v1H10zM12 19h8v1H12zM13 20h6v1H13zM13 21h6v1H13zM13 22h6v1H13zM13 23h6v1H13zM10 24h9v1H10zM12 25h8v1H12zM12 26h8v1H12zM12 27h8v1H12zM12 28h8v1H12zM12 29h8v1H12zM14 30h4v1H14z"/>
        <!-- the tail: resting, then curled up and swept out, which it flicks between
             to wag. rows overlap where they share columns, so no seams open up when the
             icon is drawn smaller than 32px -->
        <path class="gh-tail gh-rest" fill="#fff" d="M6 20h1v1H6zM6 21h2v1H6zM7 22h3v1H7zM8 23h5v1H8z"/>
        <path class="gh-tail gh-wag-up" fill="#fff" d="M6 19h1v1H6zM6 19h1v2H6zM6 20h2v1H6zM7 20h1v2H7zM7 21h2v1H7zM8 21h1v2H8zM8 22h5v1H8z"/>
        <path class="gh-tail gh-wag-down" fill="#fff" d="M4 21h1v1H4zM4 21h1v2H4zM4 22h3v1H4zM6 22h1v2H6zM6 23h7v1H6z"/>
      </g>
      <!-- a mint cd drawn like the cd player's disc sprites: a dark rim on the bottom
           right, a white shine round the top left, a cyan, green and yellow rainbow
           through the middle and a see-through hole in the hub -->
      <g v-else-if="name === 'music'" stroke="none">
        <path fill="#96dfcf" d="M14 2h4v1h-4zM11 3h3v1h-3zM16 3h5v1h-5zM23 3h1v1h-1zM9 4h2v1h-2zM16 4h9v1h-9zM7 5h3v1h-3zM16 5h10v1h-10zM6 6h5v1h-5zM16 6h10v1h-10zM5 7h6v1h-6zM16 7h11v1h-11zM5 8h5v1h-5zM11 8h1v1h-1zM16 8h7v1h-7zM24 8h3v1h-3zM4 9h5v1h-5zM11 9h1v1h-1zM16 9h6v1h-6zM23 9h5v1h-5zM4 10h4v1h-4zM10 10h3v1h-3zM17 10h4v1h-4zM22 10h6v1h-6zM3 11h5v1h-5zM9 11h4v1h-4zM19 11h1v1h-1zM21 11h8v1h-8zM3 12h4v1h-4zM8 12h4v1h-4zM20 12h9v1h-9zM3 13h4v1h-4zM8 13h3v1h-3zM21 13h8v1h-8zM2 14h5v1h-5zM8 14h3v1h-3zM21 14h9v1h-9zM2 15h8v1h-8zM22 15h8v1h-8zM1 16h9v1h-9zM22 16h8v1h-8zM1 17h10v1h-10zM21 17h3v1h-3zM25 17h5v1h-5zM2 18h9v1h-9zM21 18h3v1h-3zM25 18h4v1h-4zM2 19h10v1h-10zM20 19h4v1h-4zM25 19h4v1h-4zM2 20h9v1h-9zM12 20h1v1h-1zM19 20h4v1h-4zM24 20h5v1h-5zM2 21h8v1h-8zM11 21h4v1h-4zM19 21h3v1h-3zM24 21h4v1h-4zM3 22h6v1h-6zM10 22h6v1h-6zM20 22h1v1h-1zM23 22h5v1h-5zM3 23h5v1h-5zM9 23h7v1h-7zM20 23h1v1h-1zM22 23h5v1h-5zM4 24h12v1h-12zM21 24h6v1h-6zM5 25h11v1h-11zM21 25h5v1h-5zM7 26h9v1h-9zM22 26h3v1h-3zM9 27h7v1h-7zM21 27h2v1h-2zM11 28h5v1h-5zM18 28h3v1h-3zM14 29h4v1h-4z"/>
        <path fill="#5a867c" d="M14 0h4v1h-4zM10 1h4v1h-4zM18 1h4v1h-4zM8 2h2v1h-2zM22 2h2v1h-2zM7 3h1v1h-1zM24 3h1v1h-1zM5 4h2v1h-2zM25 4h2v1h-2zM4 5h2v1h-2zM4 6h1v1h-1zM3 7h1v1h-1zM2 8h1v1h-1zM2 9h1v1h-1zM1 10h1v1h-1zM15 10h2v1h-2zM1 11h1v1h-1zM13 11h2v1h-2zM17 11h2v1h-2zM1 12h1v1h-1zM12 12h1v1h-1zM19 12h1v1h-1zM1 13h1v1h-1zM11 13h1v1h-1zM20 13h1v1h-1zM0 14h1v1h-1zM11 14h1v1h-1zM20 14h1v1h-1zM0 15h1v1h-1zM10 15h1v1h-1zM21 15h1v1h-1zM0 16h1v1h-1zM10 16h1v1h-1zM21 16h1v1h-1zM0 17h1v1h-1zM11 17h1v1h-1zM20 17h1v1h-1zM1 18h1v1h-1zM11 18h1v1h-1zM20 18h1v1h-1zM1 19h1v1h-1zM12 19h1v1h-1zM19 19h1v1h-1zM1 20h1v1h-1zM13 20h2v1h-2zM17 20h2v1h-2zM1 21h1v1h-1zM15 21h2v1h-2zM2 22h1v1h-1zM2 23h1v1h-1zM3 24h1v1h-1zM4 25h1v1h-1zM4 26h1v1h-1z"/>
        <path fill="#344e48" d="M26 6h1v1h-1zM27 7h1v1h-1zM27 8h2v1h-2zM28 9h1v1h-1zM28 10h2v1h-2zM29 11h1v1h-1zM29 12h1v1h-1zM29 13h1v1h-1zM30 14h1v1h-1zM30 15h1v1h-1zM30 16h1v1h-1zM30 17h1v1h-1zM29 18h1v1h-1zM29 19h1v1h-1zM29 20h1v1h-1zM28 21h2v1h-2zM28 22h1v1h-1zM27 23h2v1h-2zM27 24h1v1h-1zM26 25h1v1h-1zM6 26h1v1h-1zM25 26h1v1h-1zM7 27h2v1h-2zM23 27h2v1h-2zM8 28h3v1h-3zM21 28h3v1h-3zM10 29h4v1h-4zM18 29h4v1h-4zM14 30h4v1h-4z"/>
        <path fill="#caefe7" d="M10 8h1v1h-1zM9 9h2v1h-2zM8 10h2v1h-2zM8 11h1v1h-1zM7 12h1v1h-1zM7 13h1v1h-1zM18 13h2v1h-2zM7 14h1v1h-1zM19 14h1v1h-1zM19 15h2v1h-2zM19 16h2v1h-2zM19 17h1v1h-1zM24 17h1v1h-1zM13 18h1v1h-1zM18 18h2v1h-2zM24 18h1v1h-1zM13 19h6v1h-6zM24 19h1v1h-1zM15 20h2v1h-2zM23 20h1v1h-1zM22 21h2v1h-2zM21 22h2v1h-2zM21 23h1v1h-1z"/>
        <path fill="#ffffff" d="M14 1h4v1h-4zM10 2h4v1h-4zM18 2h4v1h-4zM8 3h3v1h-3zM21 3h2v1h-2zM7 4h2v1h-2zM6 5h1v1h-1zM5 6h1v1h-1zM4 7h1v1h-1zM3 8h2v1h-2zM23 8h1v1h-1zM3 9h1v1h-1zM22 9h1v1h-1zM2 10h2v1h-2zM21 10h1v1h-1zM2 11h1v1h-1zM15 11h2v1h-2zM20 11h1v1h-1zM2 12h1v1h-1zM13 12h6v1h-6zM2 13h1v1h-1zM12 13h2v1h-2zM1 14h1v1h-1zM12 14h1v1h-1zM1 15h1v1h-1zM11 15h2v1h-2zM11 16h2v1h-2zM12 17h1v1h-1zM12 18h1v1h-1zM11 20h1v1h-1zM10 21h1v1h-1zM9 22h1v1h-1zM8 23h1v1h-1z"/>
        <path fill="#111111" d="M26 5h2v1h-2zM27 6h1v1h-1zM28 7h1v1h-1zM29 8h1v1h-1zM29 9h1v1h-1zM30 10h1v1h-1zM30 11h1v1h-1zM30 12h1v1h-1zM14 13h4v1h-4zM30 13h1v1h-1zM13 14h1v1h-1zM18 14h1v1h-1zM31 14h1v1h-1zM13 15h1v1h-1zM18 15h1v1h-1zM31 15h1v1h-1zM13 16h1v1h-1zM18 16h1v1h-1zM31 16h1v1h-1zM13 17h1v1h-1zM18 17h1v1h-1zM31 17h1v1h-1zM14 18h4v1h-4zM30 18h1v1h-1zM30 19h1v1h-1zM30 20h1v1h-1zM30 21h1v1h-1zM29 22h1v1h-1zM29 23h1v1h-1zM28 24h1v1h-1zM27 25h1v1h-1zM5 26h1v1h-1zM26 26h2v1h-2zM5 27h2v1h-2zM25 27h2v1h-2zM7 28h1v1h-1zM24 28h1v1h-1zM8 29h2v1h-2zM22 29h2v1h-2zM10 30h4v1h-4zM18 30h4v1h-4zM14 31h4v1h-4z"/>
        <path fill="#00ffff" d="M11 4h1v1h-1zM10 5h2v1h-2zM11 6h2v1h-2zM11 7h2v1h-2zM12 8h1v1h-1zM12 9h2v1h-2zM13 10h1v1h-1zM18 21h1v1h-1zM18 22h2v1h-2zM19 23h1v1h-1zM19 24h2v1h-2zM19 25h2v1h-2zM20 26h2v1h-2zM20 27h1v1h-1z"/>
        <path fill="#00ff00" d="M12 4h2v1h-2zM12 5h2v1h-2zM13 6h1v1h-1zM13 7h2v1h-2zM13 8h2v1h-2zM14 9h1v1h-1zM14 10h1v1h-1zM17 21h1v1h-1zM17 22h1v1h-1zM17 23h2v1h-2zM17 24h2v1h-2zM18 25h1v1h-1zM18 26h2v1h-2zM18 27h2v1h-2z"/>
        <path fill="#ffff00" d="M14 3h2v1h-2zM14 4h2v1h-2zM14 5h2v1h-2zM14 6h2v1h-2zM15 7h1v1h-1zM15 8h1v1h-1zM15 9h1v1h-1zM16 22h1v1h-1zM16 23h1v1h-1zM16 24h1v1h-1zM16 25h2v1h-2zM16 26h2v1h-2zM16 27h2v1h-2zM16 28h2v1h-2z"/>
      </g>
      <g v-else-if="name === 'pictures'">
        <path fill="#ddd" d="M2 4h28v24H2z"/>
        <path fill="#fff" d="M4 6h24v20H4z"/>
        <path fill="#87bcdb" d="M6 8h20v16H6z"/>
        <path fill="#ffe079" d="M19 10h4v4h-4z"/>
        <path fill="#387964" d="m6 23 7-10 6 8 4-5 3 7z"/>
      </g>
      <!-- reset desktop: a chunky teal arrow coming round, lit on its top left -->
      <g v-else-if="name === 'reset'" stroke="none">
        <path fill="#111111" d="M15 1h1v1h-1zM14 2h1v1h-1zM16 2h1v1h-1zM14 3h1v1h-1zM17 3h1v1h-1zM14 4h1v1h-1zM18 4h1v1h-1zM11 5h4v1h-4zM19 5h1v1h-1zM10 6h1v1h-1zM20 6h1v1h-1zM8 7h2v1h-2zM21 7h1v1h-1zM7 8h1v1h-1zM21 8h1v1h-1zM6 9h1v1h-1zM20 9h1v1h-1zM6 10h1v1h-1zM19 10h1v1h-1zM24 10h2v1h-2zM5 11h1v1h-1zM13 11h2v1h-2zM18 11h1v1h-1zM22 11h2v1h-2zM26 11h1v1h-1zM4 12h1v1h-1zM11 12h2v1h-2zM14 12h1v1h-1zM17 12h1v1h-1zM21 12h1v1h-1zM27 12h1v1h-1zM4 13h1v1h-1zM11 13h1v1h-1zM14 13h1v1h-1zM16 13h1v1h-1zM20 13h1v1h-1zM27 13h1v1h-1zM4 14h1v1h-1zM10 14h1v1h-1zM15 14h1v1h-1zM21 14h1v1h-1zM27 14h1v1h-1zM4 15h1v1h-1zM10 15h1v1h-1zM21 15h1v1h-1zM27 15h1v1h-1zM4 16h1v1h-1zM10 16h1v1h-1zM21 16h1v1h-1zM27 16h1v1h-1zM4 17h1v1h-1zM10 17h1v1h-1zM21 17h1v1h-1zM27 17h1v1h-1zM4 18h1v1h-1zM10 18h1v1h-1zM21 18h1v1h-1zM27 18h1v1h-1zM4 19h1v1h-1zM10 19h1v1h-1zM21 19h1v1h-1zM27 19h1v1h-1zM4 20h1v1h-1zM11 20h1v1h-1zM20 20h1v1h-1zM27 20h1v1h-1zM4 21h1v1h-1zM11 21h2v1h-2zM19 21h2v1h-2zM27 21h1v1h-1zM5 22h1v1h-1zM13 22h6v1h-6zM26 22h1v1h-1zM6 23h1v1h-1zM25 23h1v1h-1zM6 24h1v1h-1zM25 24h1v1h-1zM7 25h1v1h-1zM24 25h1v1h-1zM8 26h2v1h-2zM22 26h2v1h-2zM10 27h1v1h-1zM21 27h1v1h-1zM11 28h10v1h-10z"/>
        <path fill="#008080" d="M15 2h1v1h-1zM15 3h2v1h-2zM15 4h3v1h-3zM15 5h4v1h-4zM11 6h9v1h-9zM10 7h2v1h-2zM13 7h8v1h-8zM8 8h2v1h-2zM12 8h9v1h-9zM7 9h2v1h-2zM11 9h9v1h-9zM7 10h1v1h-1zM9 10h10v1h-10zM6 11h1v1h-1zM9 11h4v1h-4zM15 11h3v1h-3zM24 11h1v1h-1zM5 12h2v1h-2zM8 12h3v1h-3zM15 12h2v1h-2zM22 12h3v1h-3zM5 13h1v1h-1zM7 13h4v1h-4zM15 13h1v1h-1zM23 13h3v1h-3zM5 14h1v1h-1zM7 14h3v1h-3zM23 14h3v1h-3zM5 15h1v1h-1zM7 15h3v1h-3zM23 15h3v1h-3zM5 16h5v1h-5zM24 16h2v1h-2zM5 17h5v1h-5zM24 17h2v1h-2zM5 18h5v1h-5zM23 18h3v1h-3zM5 19h5v1h-5zM23 19h3v1h-3zM5 20h6v1h-6zM23 20h3v1h-3zM5 21h6v1h-6zM22 21h3v1h-3zM6 22h5v1h-5zM21 22h4v1h-4zM7 23h5v1h-5zM20 23h4v1h-4zM7 24h8v1h-8zM17 24h6v1h-6zM10 25h12v1h-12zM12 26h8v1h-8z"/>
        <path fill="#7fffff" d="M12 7h1v1h-1zM10 8h2v1h-2zM9 9h2v1h-2zM8 10h1v1h-1zM7 11h2v1h-2zM7 12h1v1h-1zM6 13h1v1h-1zM6 14h1v1h-1zM6 15h1v1h-1z"/>
        <path fill="#005050" d="M25 11h1v1h-1zM25 12h2v1h-2zM21 13h2v1h-2zM26 13h1v1h-1zM22 14h1v1h-1zM26 14h1v1h-1zM22 15h1v1h-1zM26 15h1v1h-1zM22 16h2v1h-2zM26 16h1v1h-1zM22 17h2v1h-2zM26 17h1v1h-1zM22 18h1v1h-1zM26 18h1v1h-1zM22 19h1v1h-1zM26 19h1v1h-1zM21 20h2v1h-2zM26 20h1v1h-1zM21 21h1v1h-1zM25 21h2v1h-2zM11 22h2v1h-2zM19 22h2v1h-2zM25 22h1v1h-1zM12 23h8v1h-8zM24 23h1v1h-1zM15 24h2v1h-2zM23 24h2v1h-2zM8 25h2v1h-2zM22 25h2v1h-2zM10 26h2v1h-2zM20 26h2v1h-2zM11 27h10v1h-10z"/>
      </g>
      <g v-else-if="name === 'computer'">
        <path fill="#888" d="M3 2h25v22H3zM11 24h10v3H11zM5 27h23v4H5z"/>
        <path fill="#ddd" d="M2 1h25v22H2z"/>
        <path fill="#fff" d="M5 4h19v15H5z"/>
        <path fill="#008080" d="M7 6h15v11H7z"/>
        <path stroke="#7fffff" d="M9 8h6M9 9h3"/>
        <path fill="#eee" d="M3 26h25v4H3z"/>
        <path stroke="#555" d="M6 28h13M23 28h2"/>
      </g>
      <!-- an ms-dos prompt window: a navy title bar over a black screen with a yellow
           prompt and a cursor -->
      <!-- the koi pond: a gold koi and a red and black one circling each other in a splash
           of blue water, each edged in cream -->
      <g v-else-if="name === 'koi'" stroke="none">
        <path fill="#f6f1e4" d="M27 1h1v1H27zM23 2h4v1H23zM28 2h1v1H28zM21 3h2v1H21zM29 3h1v1H29zM16 4h5v1H16zM25 4h3v1H25zM29 4h1v1H29zM14 5h2v1H14zM29 5h1v1H29zM12 6h2v1H12zM19 6h8v1H19zM28 6h1v1H28zM11 7h1v1H11zM17 7h2v1H17zM27 7h1v1H27zM10 8h1v1H10zM16 8h1v1H16zM10 9h1v1H10zM15 9h1v1H15zM9 10h1v1H9zM15 10h1v1H15zM18 10h3v1H18zM9 11h1v1H9zM14 11h1v1H14zM17 11h1v1H17zM21 11h1v1H21zM8 12h1v1H8zM14 12h1v1H14zM17 12h1v1H17zM21 12h1v1H21zM7 13h1v1H7zM15 13h1v1H15zM17 13h1v1H17zM21 13h2v1H21zM7 14h1v1H7zM15 14h1v1H15zM17 14h1v1H17zM19 14h1v1H19zM23 14h1v1H23zM8 15h1v1H8zM14 15h1v1H14zM17 15h1v1H17zM24 15h1v1H24zM8 16h1v1H8zM14 16h1v1H14zM17 16h1v1H17zM24 16h1v1H24zM9 17h1v1H9zM13 17h1v1H13zM17 17h1v1H17zM24 17h1v1H24zM9 18h1v1H9zM13 18h1v1H13zM18 18h1v1H18zM24 18h1v1H24zM10 19h1v1H10zM13 19h1v1H13zM18 19h1v1H18zM23 19h1v1H23zM11 20h2v1H11zM18 20h1v1H18zM23 20h1v1H23zM17 21h1v1H17zM22 21h1v1H22zM17 22h1v1H17zM22 22h1v1H22zM16 23h1v1H16zM21 23h1v1H21zM15 24h1v1H15zM20 24h1v1H20zM7 25h8v1H7zM18 25h2v1H18zM6 26h1v1H6zM16 26h2v1H16zM5 27h1v1H5zM9 27h1v1H9zM14 27h2v1H14zM4 28h1v1H4zM7 28h3v1H7zM12 28h2v1H12zM5 29h1v1H5zM10 29h2v1H10zM6 30h1v1H6zM8 30h2v1H8zM7 31h1v1H7z"/>
        <path fill="#5db4e4" d="M12 2h6v1H12zM10 3h10v1H10zM10 4h2v1H10zM9 5h2v1H9zM8 6h2v1H8zM7 7h2v1H7zM10 7h1v1H10zM20 7h2v1H20zM5 8h3v1H5zM18 8h1v1H18zM20 8h2v1H20zM4 9h3v1H4zM22 9h3v1H22zM4 10h2v1H4zM22 10h6v1H22zM5 11h2v1H5zM25 11h3v1H25zM5 12h2v1H5zM27 12h2v1H27zM5 13h2v1H5zM27 13h2v1H27zM6 14h1v1H6zM28 14h2v1H28zM6 15h2v1H6zM28 15h2v1H28zM5 16h2v1H5zM29 16h2v1H29zM5 17h2v1H5zM29 17h2v1H29zM5 18h2v1H5zM28 18h2v1H28zM5 19h2v1H5zM14 19h1v1H14zM27 19h3v1H27zM5 20h2v1H5zM26 20h2v1H26zM5 21h3v1H5zM25 21h2v1H25zM5 22h2v1H5zM15 22h1v1H15zM24 22h2v1H24zM5 23h2v1H5zM23 23h3v1H23zM5 24h2v1H5zM8 24h1v1H8zM23 24h2v1H23zM5 25h2v1H5zM20 25h5v1H20zM5 26h1v1H5zM18 26h1v1H18zM21 26h2v1H21z"/>
        <path fill="#c98f45" d="M27 2h1v1H27zM23 3h6v1H23zM21 4h4v1H21zM28 4h1v1H28zM21 5h8v1H21zM27 6h1v1H27z"/>
        <path fill="#1f6bb5" d="M12 4h4v1H12zM11 5h3v1H11zM10 6h2v1H10zM9 7h1v1H9zM19 7h1v1H19zM8 8h2v1H8zM17 8h1v1H17zM19 8h1v1H19zM7 9h3v1H7zM16 9h6v1H16zM6 10h3v1H6zM16 10h2v1H16zM21 10h1v1H21zM7 11h2v1H7zM15 11h2v1H15zM22 11h3v1H22zM7 12h1v1H7zM15 12h2v1H15zM22 12h5v1H22zM16 13h1v1H16zM23 13h4v1H23zM16 14h1v1H16zM24 14h4v1H24zM15 15h2v1H15zM25 15h3v1H25zM7 16h1v1H7zM15 16h2v1H15zM25 16h4v1H25zM7 17h2v1H7zM14 17h3v1H14zM25 17h4v1H25zM7 18h2v1H7zM14 18h4v1H14zM25 18h3v1H25zM7 19h3v1H7zM15 19h3v1H15zM24 19h3v1H24zM7 20h4v1H7zM13 20h5v1H13zM24 20h2v1H24zM8 21h9v1H8zM23 21h2v1H23zM7 22h8v1H7zM16 22h1v1H16zM23 22h1v1H23zM7 23h9v1H7zM22 23h1v1H22zM7 24h1v1H7zM9 24h6v1H9zM21 24h2v1H21z"/>
        <path fill="#f2d7a2" d="M16 5h2v1H16zM14 6h1v1H14zM12 7h2v1H12zM11 8h2v1H11zM11 9h1v1H11zM10 10h1v1H10zM10 11h1v1H10zM9 12h2v1H9zM9 13h1v1H9zM9 14h1v1H9zM9 15h1v1H9zM9 16h1v1H9z"/>
        <path fill="#d9a95b" d="M18 5h2v1H18zM15 6h3v1H15zM14 7h2v1H14zM13 8h2v1H13zM12 9h2v1H12zM11 10h2v1H11zM11 11h2v1H11zM11 12h2v1H11zM10 13h2v1H10zM10 14h1v1H10zM10 15h2v1H10zM10 16h2v1H10zM11 17h1v1H11zM10 18h2v1H10zM11 19h1v1H11z"/>
        <path fill="#a8783a" d="M20 5h1v1H20zM18 6h1v1H18zM16 7h1v1H16zM15 8h1v1H15zM14 9h1v1H14zM13 10h2v1H13zM13 11h1v1H13zM13 12h1v1H13zM12 13h2v1H12zM12 14h2v1H12zM12 15h2v1H12zM13 16h1v1H13zM12 17h1v1H12zM12 18h1v1H12zM12 19h1v1H12z"/>
        <path fill="#3b2a32" d="M18 11h3v1H18zM18 12h3v1H18zM18 13h3v1H18zM18 14h1v1H18zM20 14h3v1H20zM18 15h2v1H18zM19 16h1v1H19zM19 17h1v1H19zM19 18h1v1H19zM19 19h1v1H19zM19 20h1v1H19zM18 21h1v1H18zM18 22h1v1H18zM17 23h1v1H17zM16 24h1v1H16zM15 25h1v1H15z"/>
        <path fill="#c99748" d="M8 13h1v1H8zM14 13h1v1H14zM8 14h1v1H8zM14 14h1v1H14z"/>
        <path fill="#e0263c" d="M11 14h1v1H11z"/>
        <path fill="#b5173a" d="M20 15h2v1H20zM20 16h2v1H20zM20 17h2v1H20zM20 18h2v1H20zM20 19h2v1H20zM20 20h2v1H20zM19 21h2v1H19zM19 22h2v1H19zM18 23h2v1H18zM17 24h2v1H17zM16 25h1v1H16zM14 26h1v1H14z"/>
        <path fill="#d9506a" d="M22 15h1v1H22zM22 16h1v1H22zM22 17h1v1H22zM22 18h1v1H22zM22 19h1v1H22zM22 20h1v1H22zM21 21h1v1H21zM21 22h1v1H21zM20 23h1v1H20zM19 24h1v1H19zM17 25h1v1H17zM15 26h1v1H15z"/>
        <path fill="#c23a5c" d="M23 15h1v1H23zM18 16h1v1H18zM23 16h1v1H23zM18 17h1v1H18zM23 17h1v1H23zM23 18h1v1H23z"/>
        <path fill="#2a1d14" d="M12 16h1v1H12zM10 17h1v1H10z"/>
        <path fill="#5e3a4c" d="M7 26h7v1H7zM6 27h3v1H6zM10 27h4v1H10zM5 28h2v1H5zM10 28h2v1H10zM6 29h4v1H6zM7 30h1v1H7z"/>
      </g>
      <g v-else-if="name === 'terminal'">
        <path fill="#888" d="M4 5h27v25H4z"/>
        <path fill="#c0c0c0" d="M2 3h27v25H2z"/>
        <path fill="#000080" stroke="none" d="M3 4h26v4H3z"/>
        <path fill="#fff" stroke="none" d="M25 5h3v2h-3z"/>
        <path fill="#000" d="M4 10h23v16H4z"/>
        <path fill="#ffff55" stroke="none" d="M7 13h1v1H7zM8 14h1v1H8zM9 15h1v1H9zM8 16h1v1H8zM7 17h1v1H7z"/>
        <path fill="#c0c0c0" stroke="none" d="M12 17h4v1h-4z"/>
      </g>
      <g v-else-if="name === 'notebook'">
        <path fill="#999" d="M6 5h18v26H6z"/>
        <path fill="#fff" d="M3 3h18v26H3z"/>
        <path stroke="#589ab8" d="M6 9h12M6 13h12M6 17h7M6 21h9M6 25h12"/>
        <path stroke="#c44" d="M8 3v26"/>
        <path fill="none" stroke="#111" d="M25 3l3 3-13 13-4 1 1-4z"/>
        <path fill="#e88aa0" stroke="none" d="M25 4h3v3h-3zM24 5h3v3h-3z"/>
        <path fill="#b8b8b8" stroke="none" d="M23 6h3v3h-3z"/>
        <path fill="#f2c230" stroke="none" d="M22 7h3v3h-3zM21 8h3v3h-3zM20 9h3v3h-3zM19 10h3v3h-3zM18 11h3v3h-3zM17 12h3v3h-3zM16 13h3v3h-3z"/>
        <path fill="#e8c99a" stroke="none" d="M15 14h2v2h-2z"/>
        <path fill="#333" stroke="none" d="M14 15h2v2h-2z"/>
      </g>
      <g v-else-if="name === 'games'">
        <path fill="#c69b27" d="M2 8h11l3 3h14v5H2z"/>
        <path fill="#fff3a3" d="M3 6h10l3 3h13v6H3z"/>
        <path fill="#f3d568" d="M1 13h30l-4 16H4z"/>
        <path stroke="#fff5b8" d="M4 15h23"/>
        <path fill="#5b2fa0" stroke="none" d="M12 18h1v1H12zM18 18h1v1H18zM13 19h1v1H13zM17 19h1v1H17zM12 20h7v1H12zM11 21h2v1H11zM14 21h3v1H14zM18 21h2v1H18zM10 22h11v1H10zM10 23h1v1H10zM12 23h7v1H12zM20 23h1v1H20zM10 24h1v1H10zM12 24h1v1H12zM18 24h1v1H18zM20 24h1v1H20zM13 25h2v1H13zM16 25h2v1H16z"/>
      </g>
      <!-- the fun stuff folder: the same yellow folder with a pixel star on the front -->
      <g v-else-if="name === 'funstuff'">
        <path fill="#c69b27" d="M2 8h11l3 3h14v5H2z"/>
        <path fill="#fff3a3" d="M3 6h10l3 3h13v6H3z"/>
        <path fill="#f3d568" d="M1 13h30l-4 16H4z"/>
        <path stroke="#fff5b8" d="M4 15h23"/>
        <path fill="#e8467c" stroke="none" d="M15 17h2v2h-2zM14 19h4v1h-4zM10 20h12v2H10zM12 22h8v1h-8zM13 23h6v1h-6zM12 24h3v2h-3zM17 24h3v2h-3zM11 26h2v1h-2zM19 26h2v1h-2z"/>
        <path fill="#ffb3c9" stroke="none" d="M15 19h1v1h-1zM12 20h2v1h-2z"/>
      </g>
      <g v-else-if="name === 'folder' || name === 'case'">
        <path :fill="name === 'case' ? '#936d35' : '#c69b27'" d="M2 8h11l3 3h14v5H2z"/>
        <path fill="#fff3a3" d="M3 6h10l3 3h13v6H3z"/>
        <path :fill="name === 'case' ? '#b98645' : '#f3d568'" d="M1 13h30l-4 16H4z"/>
        <path stroke="#fff5b8" d="M4 15h23"/>
        <path v-if="name === 'case'" fill="#d5c7ac" d="M13 16h5v5h-5z"/>
      </g>
      <g v-else-if="name === 'person'">
        <path fill="#999" d="M4 3h24v27H4z"/>
        <path fill="#fff" d="M2 1h24v27H2z"/>
        <path fill="#ddd" stroke="none" d="M4 3h20v22H4z"/>
        <path fill="#000080" d="M6 18h4v-3h9v3h4v7H6z"/>
        <path fill="#e5bb8f" d="M10 7h9v8h-9z"/>
        <path fill="#492c1a" d="M9 7V5h11v6h-2V8h-6v2H9z"/>
        <path stroke="#111" d="M12 11h1m3 0h1"/>
      </g>
      <!-- a friendly envelope: rounded pixel corners, a soft brown outline instead of
           black, a cream flap with a white shine along its edge and a flat tip, and the
           darker tan pocket underneath. mail has the red "new message" flag, contact doesn't -->
      <g v-else-if="name === 'mail' || name === 'contact'" stroke="none">
        <path fill="#efe4d0" d="M8 6h2v1h-2zM12 6h17v1h-17zM4 7h25v1h-25zM2 8h1v1h-1zM5 8h23v1h-23zM29 8h1v1h-1zM2 9h2v1h-2zM6 9h21v1h-21zM28 9h2v1h-2zM2 10h3v1h-3zM7 10h19v1h-19zM27 10h3v1h-3zM2 11h4v1h-4zM8 11h17v1h-17zM26 11h4v1h-4zM2 12h5v1h-5zM9 12h15v1h-15zM25 12h5v1h-5zM2 13h6v1h-6zM10 13h13v1h-13zM24 13h6v1h-6zM2 14h7v1h-7zM11 14h11v1h-11zM23 14h7v1h-7zM2 15h8v1h-8zM12 15h9v1h-9zM22 15h8v1h-8zM2 16h9v1h-9zM13 16h7v1h-7zM21 16h9v1h-9zM2 17h10v1h-10zM20 17h10v1h-10zM2 18h6v1h-6zM24 18h6v1h-6zM2 19h5v1h-5zM25 19h5v1h-5zM2 20h4v1h-4zM26 20h4v1h-4zM2 21h3v1h-3zM27 21h3v1h-3zM2 22h2v1h-2zM28 22h2v1h-2zM2 23h1v1h-1zM29 23h1v1h-1z"/>
        <path fill="#d6bf9c" d="M9 18h4v1h-4zM19 18h4v1h-4zM8 19h16v1h-16zM7 20h18v1h-18zM6 21h20v1h-20zM5 22h22v1h-22zM4 23h24v1h-24zM3 24h26v1h-26z"/>
        <path fill="#fffaf0" d="M3 6h5v1h-5zM10 6h2v1h-2zM3 7h1v1h-1zM4 8h1v1h-1zM5 9h1v1h-1zM6 10h1v1h-1zM7 11h1v1h-1zM8 12h1v1h-1zM9 13h1v1h-1zM10 14h1v1h-1zM11 15h1v1h-1zM12 16h1v1h-1zM13 17h6v1h-6z"/>
        <path fill="#bda384" d="M3 25h26v1h-26z"/>
        <path fill="#8f7a62" d="M2 7h1v1h-1zM29 7h1v1h-1zM3 8h1v1h-1zM28 8h1v1h-1zM4 9h1v1h-1zM27 9h1v1h-1zM5 10h1v1h-1zM26 10h1v1h-1zM6 11h1v1h-1zM25 11h1v1h-1zM7 12h1v1h-1zM24 12h1v1h-1zM8 13h1v1h-1zM23 13h1v1h-1zM9 14h1v1h-1zM22 14h1v1h-1zM10 15h1v1h-1zM21 15h1v1h-1zM11 16h1v1h-1zM20 16h1v1h-1zM12 17h1v1h-1zM19 17h1v1h-1zM8 18h1v1h-1zM13 18h6v1h-6zM23 18h1v1h-1zM7 19h1v1h-1zM24 19h1v1h-1zM6 20h1v1h-1zM25 20h1v1h-1zM5 21h1v1h-1zM26 21h1v1h-1zM4 22h1v1h-1zM27 22h1v1h-1zM3 23h1v1h-1zM28 23h1v1h-1zM2 24h1v1h-1zM29 24h1v1h-1z"/>
        <path fill="#7d6a55" d="M3 5h26v1h-26zM2 6h1v1h-1zM29 6h1v1h-1zM1 7h1v1h-1zM30 7h1v1h-1zM1 8h1v1h-1zM30 8h1v1h-1zM1 9h1v1h-1zM30 9h1v1h-1zM1 10h1v1h-1zM30 10h1v1h-1zM1 11h1v1h-1zM30 11h1v1h-1zM1 12h1v1h-1zM30 12h1v1h-1zM1 13h1v1h-1zM30 13h1v1h-1zM1 14h1v1h-1zM30 14h1v1h-1zM1 15h1v1h-1zM30 15h1v1h-1zM1 16h1v1h-1zM30 16h1v1h-1zM1 17h1v1h-1zM30 17h1v1h-1zM1 18h1v1h-1zM30 18h1v1h-1zM1 19h1v1h-1zM30 19h1v1h-1zM1 20h1v1h-1zM30 20h1v1h-1zM1 21h1v1h-1zM30 21h1v1h-1zM1 22h1v1h-1zM30 22h1v1h-1zM1 23h1v1h-1zM30 23h1v1h-1zM1 24h1v1h-1zM30 24h1v1h-1zM2 25h1v1h-1zM29 25h1v1h-1zM3 26h26v1h-26z"/>
        <path v-if="name === 'mail'" fill="#e0483e" stroke="#7d6a55" d="M23 3h7v6h-7z"/>
      </g>
      <g v-else-if="name === 'chip'">
        <path stroke="#ddd" stroke-width="3" d="M2 8h28M2 15h28M2 22h28M9 1v30M16 1v30M23 1v30"/>
        <path fill="#316b43" d="M5 4h23v24H5z"/>
        <path fill="#222" d="M9 8h15v16H9z"/>
        <path stroke="#ccc" d="M12 12h9M12 15h6M12 18h4"/>
      </g>
      <g v-else-if="name === 'game'">
        <path fill="#222" d="M2 2h28v28H2z"/>
        <path stroke="none" fill="#d05c48" d="M5 6h6v3H5zm8 0h6v3h-6zm8 0h6v3h-6z"/>
        <path stroke="none" fill="#e1c34a" d="M5 11h6v3H5zm8 0h6v3h-6zm8 0h6v3h-6z"/>
        <path fill="#fff" d="M19 19h3v3h-3z"/>
        <path fill="#5de5ee" d="M9 25h12v2H9z"/>
      </g>
      <g v-else-if="name === 'snake'" stroke="none">
        <!-- A tall miniature of the playable handheld, on the same pixel grid. -->
        <path fill="#555" d="M7 1h18v1h1v25h-1v2h-2v2H7v-1H6V2h1z"/>
        <path fill="#d6d3c9" d="M7 2h18v24h-1v2h-2v2H7z"/>
        <path fill="#efece4" d="M7 2h18v1H8v26H7z"/>
        <path fill="#aaa69a" d="M24 3h1v23h-1v2h-2v2H8v-1h14v-2h2z"/>
        <path fill="#5c5d6b" d="M9 5h14v11h-1v1H9z"/>
        <path fill="#173825" d="M11 7h10v7H11z"/>
        <path fill="#8cdf84" d="M12 12h6v-2h-4V8h5v1h-4v1h4v3h-7z"/>
        <path fill="#b2f29d" d="M18 8h2v2h-2z"/>
        <path fill="#ef9e68" d="M12 8h1v1h-1z"/>
        <path fill="#26307f" d="M9 18h5v1H9z"/>
        <path fill="#3b5bdb" d="M15 20h2v2h-2z"/>
        <path fill="#2f9e44" d="M12 22h2v2h-2z"/>
        <path fill="#e03131" d="M18 22h2v2h-2z"/>
        <path fill="#f2c318" d="M15 24h2v2h-2z"/>
        <path fill="#5f5d66" d="M11 27h3v1h-3zM16 27h3v1h-3z"/>
        <path fill="#a29e92" d="M21 24h1v3h-1zM23 23h1v3h-1z"/>
      </g>
      <!-- four tiles spelling 2048, in the original game's colours -->
      <g v-else-if="name === '2048'" stroke="none">
        <path fill="#eee4da" d="M2 1h12v1h1v12h-1v1H2v-1H1V2h1z"/>
        <path fill="#776e65" d="M5 3h2v2h-2zM7 3h2v2h-2zM9 3h2v2h-2zM9 5h2v2h-2zM5 7h2v2h-2zM7 7h2v2h-2zM9 7h2v2h-2zM5 9h2v2h-2zM5 11h2v2h-2zM7 11h2v2h-2zM9 11h2v2h-2z"/>
        <path fill="#f67c5f" d="M18 1h12v1h1v12h-1v1H18v-1H17V2h1z"/>
        <path fill="#fff" d="M21 3h2v2h-2zM23 3h2v2h-2zM25 3h2v2h-2zM21 5h2v2h-2zM25 5h2v2h-2zM21 7h2v2h-2zM25 7h2v2h-2zM21 9h2v2h-2zM25 9h2v2h-2zM21 11h2v2h-2zM23 11h2v2h-2zM25 11h2v2h-2z"/>
        <path fill="#ede0c8" d="M2 17h12v1h1v12h-1v1H2v-1H1V18h1z"/>
        <path fill="#776e65" d="M5 19h2v2h-2zM9 19h2v2h-2zM5 21h2v2h-2zM9 21h2v2h-2zM5 23h2v2h-2zM7 23h2v2h-2zM9 23h2v2h-2zM9 25h2v2h-2zM9 27h2v2h-2z"/>
        <path fill="#f2b179" d="M18 17h12v1h1v12h-1v1H18v-1H17V18h1z"/>
        <path fill="#fff" d="M21 19h2v2h-2zM23 19h2v2h-2zM25 19h2v2h-2zM21 21h2v2h-2zM25 21h2v2h-2zM21 23h2v2h-2zM23 23h2v2h-2zM25 23h2v2h-2zM21 25h2v2h-2zM25 25h2v2h-2zM21 27h2v2h-2zM23 27h2v2h-2zM25 27h2v2h-2z"/>
      </g>
      <!-- the same red pixel balloon that floats up over the about page, with the bottom
           of its string cut off so the balloon fills more of the icon. it rests leaning
           left, and on the about page it flips to leaning right and back, the way the
           real ones bob -->
      <svg v-else-if="name === 'balloon'" x="3.2" width="25.6" height="32" viewBox="-1 0 16 20" stroke="none">
        <g v-for="(f, k) in [balloonFrames[0], balloonFrames[2]]" :key="k" :class="k ? 'bl-b' : 'bl-a'">
          <path :d="f.outline" :fill="balloonEdge"/>
          <path :d="f.fill" :fill="balloonBody"/>
          <path :d="f.shine" fill="#fff" fill-opacity=".75"/>
          <path :d="f.knot" :fill="balloonEdge"/>
          <path :d="f.string" :fill="balloonString"/>
        </g>
      </svg>
      <!-- a barbell side on, two bumper plates a side, framed by a camera's viewfinder
           corners in liftlens's green -->
      <g v-else-if="name === 'barbell'">
        <path stroke="none" fill="#7bbf2a" d="M2 2h8v2H4v6H2zM22 2h8v8h-2V4h-6zM2 22h2v6h6v2H2zM28 22h2v8h-8v-2h6z"/>
        <path fill="#bbb" d="M4 15h24v2H4z"/>
        <path fill="#333" d="M8 8h4v16H8zM20 8h4v16h-4z"/>
        <path fill="#555" d="M6 11h2v10H6zM24 11h2v10h-2z"/>
        <path stroke="none" fill="#777" d="M9 9h1v14H9zM21 9h1v14h-1z"/>
      </g>
      <!-- a green board with the four opening discs in the middle -->
      <g v-else-if="name === 'reversi'">
        <path fill="#6b3e1c" d="M2 2h28v28H2z"/>
        <path stroke="none" fill="#1f7a45" d="M4 4h24v24H4z"/>
        <path stroke="#14512c" d="M10 4v24M16 4v24M22 4v24M4 10h24M4 16h24M4 22h24"/>
        <path fill="#fff" d="M11 11h4v4h-4zM17 17h4v4h-4z"/>
        <path fill="#111" d="M17 11h4v4h-4zM11 17h4v4h-4z"/>
      </g>
      <g v-else-if="name === 'mine'">
        <path fill="#808080" d="M3 3h27v27H3z"/>
        <path fill="#c0c0c0" d="M2 2h27v27H2z"/>
        <path stroke="#fff" d="M3 3h25M3 3v25"/>
        <path stroke="#111" stroke-width="2" d="M16 6v20M6 16h20M9 9l14 14M23 9 9 23"/>
        <path fill="#111" d="M10 10h12v12H10z"/>
        <path fill="#fff" stroke="none" d="M13 13h3v3h-3z"/>
      </g>
      <g v-else-if="name === 'settings'">
        <path fill="#ddd" d="M2 4h27v24H2z"/>
        <path fill="#000080" d="M3 5h25v4H3z"/>
        <path stroke="#666" d="M8 12v12m7-12v12m7-12v12"/>
        <path fill="#c0c0c0" d="M5 15h6v4H5zm7 5h6v4h-6zm7-8h6v4h-6z"/>
      </g>
      <g v-else-if="name === 'sound' || name === 'mute'">
        <path fill="#c0c0c0" d="M4 11h6V9h3V6h3V4h2v24h-2v-2h-3v-3h-3v-2H4z"/>
        <path fill="#fff" stroke="none" d="M5 12h4v1H5z"/>
        <path v-if="name === 'sound'" fill="none" stroke-width="2" d="M21 11h2v3h2v4h-2v3h-2M26 7h2v4h2v10h-2v4h-2"/>
        <path v-else fill="none" stroke="#c00" stroke-width="3" d="M21 11l9 10M30 11l-9 10"/>
      </g>
      <g v-else-if="name === 'sticky'">
        <path fill="#6b5a00" stroke="none" d="M6 6h24v18l-6 6H6z"/>
        <path fill="#ffe66e" d="M3 3h24v18l-6 6H3z"/>
        <path fill="#e6b800" d="M3 3h24v5H3z"/>
        <path fill="#c9a000" d="M21 21h6l-6 6z"/>
        <path fill="none" stroke="#8a7400" d="M7 13h15M7 17h15M7 21h10"/>
      </g>
      <!-- stepped silhouettes and top-left highlights match the desktop's pixel icons -->
      <g v-else-if="name === 'sun'">
        <path fill="#ffd21f" d="M15 2h2v4h-2zM15 26h2v4h-2zM2 15h4v2H2zM26 15h4v2h-4zM5 5h3v3H5zM24 5h3v3h-3zM5 24h3v3H5zM24 24h3v3h-3z"/>
        <path fill="#ffd21f" d="M12 9h8v1h2v2h1v8h-1v2h-2v1h-8v-1h-2v-2H9v-8h1v-2h2z"/>
        <path fill="#e6a817" stroke="none" d="M21 12h1v8h-1v2h-2v-2h1v-8zM12 21h7v1h-7z"/>
        <path fill="#fff6b0" stroke="none" d="M12 11h6v1h-6zM11 12h2v3h-2z"/>
      </g>
      <g v-else-if="name === 'moon'">
        <path fill="#f3e9a6" d="M13 4h7v2h-4v2h-2v3h-1v10h1v3h2v2h4v2h-7v-2h-3v-2H8v-3H7V11h1V8h2V6h3z"/>
        <path fill="#fff9d4" stroke="none" d="M13 5h4v1h-4zM10 7h3v1h-3zM9 9h2v3H9zM8 12h1v7H8z"/>
        <path fill="#c9b968" stroke="none" d="M9 21h2v3h2v2h3v1h-3v-2h-3v-2H9z"/>
        <path fill="#fff" stroke="none" d="M23 8h2v2h-2zM21 16h2v2h-2zM26 21h2v2h-2z"/>
      </g>
      <g v-else-if="name === 'start'">
        <path fill="#d44528" d="M3 3h11v11H3z"/>
        <path fill="#559b2e" d="M17 3h11v11H17z"/>
        <path fill="#2666b1" d="M3 17h11v11H3z"/>
        <path fill="#e6bf36" d="M17 17h11v11H17z"/>
      </g>
      <g v-else>
        <path fill="#999" d="M8 3h15l6 6v22H8z"/>
        <path fill="#fff" d="M5 1h15l6 6v22H5z"/>
        <path fill="#ddd" d="M20 1v6h6"/>
        <path stroke="#888" d="M9 12h13M9 16h13M9 20h13M9 24h8"/>
      </g>
    </g>
  </svg>
</template>
