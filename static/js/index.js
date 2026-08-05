const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function initCarousels() {
  document.querySelectorAll('[data-carousel-slider]').forEach((carousel) => {
    initSlidingCarousel(carousel);
  });

  const controls = document.querySelectorAll('[data-carousel-prev], [data-carousel-next]');

  controls.forEach((control) => {
    if (control.closest('[data-carousel-slider]')) return;

    const carouselName = control.dataset.carouselPrev || control.dataset.carouselNext;
    const track = document.querySelector(`[data-carousel="${carouselName}"]`);
    if (!track) return;

    const direction = control.hasAttribute('data-carousel-next') ? 1 : -1;
    control.addEventListener('click', () => {
      track.scrollBy({
        left: direction * track.clientWidth * 0.82,
        behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
      });
    });
  });
}

function syncCarouselVideoPlayback(viewport) {
  const viewportBox = viewport.getBoundingClientRect();
  const videos = [...viewport.querySelectorAll('video')];
  const viewportIsVisible = viewportBox.bottom > 0
    && viewportBox.top < window.innerHeight
    && viewportBox.right > 0
    && viewportBox.left < window.innerWidth;

  videos.forEach((video) => {
    const videoBox = video.getBoundingClientRect();
    const isVisible = viewportIsVisible
      && videoBox.bottom > viewportBox.top
      && videoBox.top < viewportBox.bottom
      && videoBox.right > viewportBox.left
      && videoBox.left < viewportBox.right
      && videoBox.bottom > 0
      && videoBox.top < window.innerHeight
      && videoBox.right > 0
      && videoBox.left < window.innerWidth;

    video.loop = true;
    video.muted = true;
    if (!isVisible) {
      video.pause();
      return;
    }

    const playRequest = video.play();
    if (playRequest && typeof playRequest.catch === 'function') playRequest.catch(() => {});
  });
}

function initSlidingCarousel(carousel) {
  const viewport = carousel.querySelector('[data-carousel]');
  const track = viewport?.querySelector('.carousel-track');
  const previous = viewport?.querySelector('[data-carousel-prev]');
  const next = viewport?.querySelector('[data-carousel-next]');
  const pagination = viewport?.querySelector('.carousel-pagination');
  const slides = track ? [...track.children] : [];

  if (!viewport || !track || !previous || !next || !pagination || slides.length === 0) return;

  const visibleSlides = Number.parseInt(getComputedStyle(carousel).getPropertyValue('--carousel-visible'), 10) || 1;
  const cloneCount = Math.min(visibleSlides - 1, slides.length - 1);
  const leadingClones = slides.slice(-cloneCount).map((slide) => slide.cloneNode(true));
  const trailingClones = slides.slice(0, cloneCount).map((slide) => slide.cloneNode(true));

  [...leadingClones, ...trailingClones].forEach((slide) => slide.setAttribute('aria-hidden', 'true'));
  track.prepend(...leadingClones);
  track.append(...trailingClones);

  const totalSlides = slides.length;
  const labelPrefix = carousel.dataset.carouselSlider === 'failures' ? 'failure case' : 'additional experiment';
  const dots = slides.map((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to ${labelPrefix} ${index + 1}`);
    dot.dataset.carouselIndex = String(index);
    pagination.append(dot);
    return dot;
  });

  let logicalIndex = 0;
  let physicalIndex = cloneCount;
  let locked = false;
  let settleTimer;

  const render = (animate = true) => {
    track.style.transition = animate && !prefersReducedMotion.matches ? 'transform 360ms ease' : 'none';
    track.style.transform = `translate3d(-${(physicalIndex * 100) / visibleSlides}%, 0, 0)`;
    dots.forEach((dot, index) => {
      const active = index === logicalIndex;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  const move = (direction) => {
    if (locked) return;

    locked = true;
    logicalIndex = (logicalIndex + direction + totalSlides) % totalSlides;
    physicalIndex += direction;
    const needsWrap = physicalIndex === 0 || physicalIndex === totalSlides + cloneCount;
    render();

    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      if (needsWrap) {
        physicalIndex = physicalIndex === 0 ? totalSlides : cloneCount;
        render(false);
      }
      syncCarouselVideoPlayback(viewport);
      locked = false;
    }, prefersReducedMotion.matches ? 0 : 380);
  };

  const goTo = (index) => {
    if (locked || index === logicalIndex) return;

    locked = true;
    logicalIndex = index;
    physicalIndex = cloneCount + index;
    render();
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      syncCarouselVideoPlayback(viewport);
      locked = false;
    }, prefersReducedMotion.matches ? 0 : 380);
  };

  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  dots.forEach((dot) => dot.addEventListener('click', () => goTo(Number(dot.dataset.carouselIndex))));

  viewport.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  let pointerStartX = null;
  viewport.addEventListener('pointerdown', (event) => {
    pointerStartX = event.clientX;
  });
  viewport.addEventListener('pointerup', (event) => {
    if (pointerStartX === null) return;
    const distance = event.clientX - pointerStartX;
    if (Math.abs(distance) > 36) move(distance < 0 ? 1 : -1);
    pointerStartX = null;
  });
  viewport.addEventListener('pointercancel', () => {
    pointerStartX = null;
  });

  render(false);
}

function initVideoVisibility() {
  const videos = [...document.querySelectorAll('video')];
  if (!videos.length) return;

  const updatePlayback = (video, shouldPlay) => {
    if (!shouldPlay) {
      video.pause();
      return;
    }

    video.muted = true;
    const playRequest = video.play();
    if (playRequest && typeof playRequest.catch === 'function') playRequest.catch(() => {});
  };

  if (!('IntersectionObserver' in window)) {
    videos.slice(0, 1).forEach((video) => updatePlayback(video, true));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => updatePlayback(entry.target, entry.isIntersecting));
  }, {
    rootMargin: '220px 0px',
    threshold: 0.01,
  });

  videos.forEach((video) => observer.observe(video));
}

function initCitationCopy() {
  const button = document.querySelector('[data-copy-citation]');
  const citation = document.querySelector('#citation code');
  if (!button || !citation) return;

  const defaultLabel = button.textContent;
  let resetTimer;

  const copyWithFallback = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  };

  button.addEventListener('click', async () => {
    try {
      await copyWithFallback(citation.innerText);
      button.textContent = 'Copied';
      button.dataset.copied = 'true';
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        button.textContent = defaultLabel;
        delete button.dataset.copied;
      }, 1600);
    } catch {
      button.textContent = 'Copy failed';
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        button.textContent = defaultLabel;
      }, 1600);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCarousels();
  initVideoVisibility();
  initCitationCopy();
});
