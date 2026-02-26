export const fadeIn = {
  animate: {
    opacity: 1,
    transition: {
      bounce: 0,
      duration: 0.05,
      ease: 'linear',
    },
  },
  initial: {
    opacity: 0,
  },
  exit: {
    opacity: 0,
  },
};

export const fadeInTransition = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      bounce: 0,
      duration: 0.1,
      ease: 'linear',
      delay: 0.05,
    },
  },
  exit: {
    opacity: 0,
    y: 10,
  },
};

export const routerFadeIn = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      bounce: 0,
      duration: 0.1,
      ease: 'linear',
      delay: 0.01,
    },
  },
};

export const ErrorExitAnime = {
  exit: {
    opacity: 0,
    height: 0,
    transition: {bounce: 0},
    duration: 0.01,
  },
};

export const imageFadeIn = {
  animate: {
    opacity: 1,
    duration: 0.01,
  },
  initial: {
    opacity: 0,
  },
};
