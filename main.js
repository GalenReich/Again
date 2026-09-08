import { story } from "./story.js";

gsap.registerPlugin(Observer);

const CARD_OVERLAP = 3;

const state = {
  currentNodeId: story.start,
  activeCardIndex: 0,
  transition: null,
  snapTween: null,
};

const cards = Array.from(document.querySelectorAll(".card"));
const deck = document.querySelector(".deck");
const SCROLL_PIXELS_PER_CARD = 780;

function preloadImages() {
  const urls = new Set(
    Object.values(story.nodes)
      .map((node) => node.image)
      .filter(Boolean),
  );
  urls.forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}

function resolveEdge(nodeId, direction) {
  const node = story.nodes[nodeId];
  if (!node) return null;

  const nextNodeId = direction > 0 ? node.down : node.up;
  if (nextNodeId == null) return null;
  if (!story.nodes[nextNodeId]) return null;

  return nextNodeId;
}

function fillCard(cardEl, nodeId) {
  const content = story.nodes[nodeId];
  if (!content) return;

  const largeTitleEl = cardEl.querySelector(".large-title");
  if (largeTitleEl && content.largeTitle) {
    largeTitleEl.textContent = content.largeTitle;
    largeTitleEl.hidden = false;
  } else {
    largeTitleEl.textContent = "";
    largeTitleEl.hidden = true;
  }

  const titleEl = cardEl.querySelector(".title");
  if (titleEl && content.title) {
    titleEl.textContent = content.title;
    titleEl.hidden = false;
  } else {
    titleEl.textContent = "";
    titleEl.hidden = true;
  }

  const bodyEl = cardEl.querySelector(".body");
  if (bodyEl && content.body) {
    bodyEl.innerHTML = content.body;
    bodyEl.hidden = false;
  } else {
    bodyEl.innerHTML = "";
    bodyEl.hidden = true;
  }

  const imgEl = cardEl.querySelector(".card-image");
  if (imgEl && content.image) {
    imgEl.src = content.image;
    imgEl.alt = content.imageAlt || content.title || content.largeTitle || "";
    imgEl.hidden = false;
  } else {
    imgEl.removeAttribute("src");
    imgEl.alt = "";
    imgEl.hidden = true;
  }

  cardEl.querySelector(".hint").textContent = nodeId;
}

function getCardPair() {
  const currentCard = cards[state.activeCardIndex];
  const nextCard = cards[1 - state.activeCardIndex];
  return { currentCard, nextCard };
}

function applyTransitionVisuals() {
  const t = state.transition;
  if (!t) return;

  const { currentCard, nextCard } = getCardPair();
  const p = gsap.utils.clamp(0, 1, t.progress);
  const leaveY = t.direction > 0 ? -100 : 100;
  const enterStartY = t.direction > 0 ? 100 : -100;
  const enterOffsetY =
    (t.direction > 0 ? -CARD_OVERLAP : CARD_OVERLAP) * (1 - p);

  gsap.set(currentCard, {
    yPercent: leaveY * p,
    y: 0,
    autoAlpha: 1,
  });
  gsap.set(nextCard, {
    yPercent: enterStartY * (1 - p),
    y: enterOffsetY,
    autoAlpha: 1,
  });

  const revealEls = [
    nextCard.querySelector(".large-title"),
    nextCard.querySelector(".title"),
    nextCard.querySelector(".body"),
    nextCard.querySelector(".card-image"),
    nextCard.querySelector(".hint"),
  ].filter((el) => el && !el.hidden);

  const reveal = gsap.utils.clamp(0, 1, (p - 0.12) / 0.48);
  gsap.set(revealEls, {
    autoAlpha: reveal,
    y: (t.direction > 0 ? 24 : -24) * (1 - reveal),
  });
}

function startTransition(direction) {
  const nextNodeId = resolveEdge(state.currentNodeId, direction);
  if (!nextNodeId) return false;

  const { currentCard, nextCard } = getCardPair();
  fillCard(nextCard, nextNodeId);

  const enterStartY = direction > 0 ? 100 : -100;
  const enterOffsetY = direction > 0 ? -CARD_OVERLAP : CARD_OVERLAP;

  gsap.set(nextCard, {
    yPercent: enterStartY,
    y: enterOffsetY,
    autoAlpha: 1,
    zIndex: 2,
  });
  gsap.set(currentCard, { zIndex: 1, autoAlpha: 1, yPercent: 0, y: 0 });

  state.transition = {
    direction,
    fromNodeId: state.currentNodeId,
    toNodeId: nextNodeId,
    progress: 0,
  };
  applyTransitionVisuals();
  return true;
}

function completeTransition() {
  const t = state.transition;
  if (!t) return;
  const { currentCard, nextCard } = getCardPair();

  gsap.set(currentCard, { yPercent: 0, y: 0, autoAlpha: 0 });
  gsap.set(nextCard, { yPercent: 0, y: 0, autoAlpha: 1 });
  state.activeCardIndex = 1 - state.activeCardIndex;
  state.currentNodeId = t.toNodeId;
  state.transition = null;
}

function cancelTransition() {
  const { currentCard, nextCard } = getCardPair();
  gsap.set(currentCard, { yPercent: 0, y: 0, autoAlpha: 1, zIndex: 2 });
  gsap.set(nextCard, { yPercent: 0, y: 0, autoAlpha: 0, zIndex: 1 });
  state.transition = null;
}

function consumeProgress(direction, amount) {
  let remaining = amount;

  while (remaining > 0.0001) {
    if (!state.transition) {
      const started = startTransition(direction);
      if (!started) return;
    }

    const t = state.transition;

    if (t.direction !== direction) {
      const towardZero = Math.min(remaining, t.progress);
      t.progress -= towardZero;
      remaining -= towardZero;
      applyTransitionVisuals();

      if (t.progress <= 0.0001) {
        cancelTransition();
      }
      continue;
    }

    const towardOne = Math.min(remaining, 1 - t.progress);
    t.progress += towardOne;
    remaining -= towardOne;
    applyTransitionVisuals();

    if (t.progress >= 0.9999) {
      completeTransition();
    }
  }
}

function snapTransition() {
  if (!state.transition) return;
  if (state.snapTween) state.snapTween.kill();

  const t = state.transition;
  const target = t.progress > 0.15 ? 1 : 0;

  state.snapTween = gsap.to(t, {
    progress: target,
    duration: 0.34,
    ease: "power3.out",
    onUpdate: applyTransitionVisuals,
    onComplete: () => {
      if (!state.transition) return;
      if (target === 1) completeTransition();
      else cancelTransition();
      state.snapTween = null;
    },
  });
}

function travel(direction) {
  consumeProgress(direction, 1);
  snapTransition();
}

function setup() {
  fillCard(cards[0], story.start);
  gsap.set(cards[0], { autoAlpha: 1, yPercent: 0, y: 0, zIndex: 2 });
  gsap.set(cards[1], { autoAlpha: 0, yPercent: 0, y: 0, zIndex: 1 });

  Observer.create({
    target: window,
    type: "wheel,touch,pointer",
    wheelSpeed: 1,
    tolerance: 2,
    preventDefault: true,
    onChangeY: (self) => {
      if (state.snapTween) state.snapTween.kill();
      const rawDelta = self.deltaY;
      if (!rawDelta) return;

      // Touch drag deltas are opposite wheel deltas for this interaction.
      const isTouch =
        !!self.event && String(self.event.type).startsWith("touch");
      const delta = isTouch ? -rawDelta : rawDelta;

      const direction = delta > 0 ? 1 : -1;
      const isWheel = self.event?.type === "wheel";
      const pixelsPerCard = isWheel
        ? SCROLL_PIXELS_PER_CARD
        : deck.clientHeight;
      const amount = Math.abs(delta) / pixelsPerCard;
      consumeProgress(direction, amount);
    },
    onStop: snapTransition,
    onStopDelay: 0.5,
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      travel(1);
    }
    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      travel(-1);
    }
  });
}

preloadImages();
setup();
