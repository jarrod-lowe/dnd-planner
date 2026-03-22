<script lang="ts">
  /**
   * LandingPage component - displayed when user is not logged in.
   * Minimalist hero section with login call-to-action.
   */
  import { t } from '$lib/i18n';

  interface Props {
    onLogin: () => void;
  }

  let { onLogin }: Props = $props();
</script>

<svelte:head>
  <title>{$t('app.title')}</title>
</svelte:head>

<div class="landing">
  <div class="landing__backdrop" aria-hidden="true"></div>

  <main id="main-content" class="landing__content">
    <div class="landing__brand">
      <h1 class="landing__title">{$t('app.title')}</h1>
      <p class="landing__tagline">{$t('app.tagline')}</p>
    </div>

    <p class="landing__hero">{$t('landing.hero')}</p>
    <p class="landing__hero-subtitle">{$t('landing.heroSubtitle')}</p>

    <button class="landing__cta" onclick={onLogin} type="button">
      {$t('landing.getStarted')}
    </button>

    <div class="landing__features">
      <div class="landing__feature">
        <div class="landing__feature-header">
          <div class="landing__feature-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>
          <h3 class="landing__feature-title">{$t('landing.feature1Title')}</h3>
        </div>
        <p class="landing__feature-desc">{$t('landing.feature1Desc')}</p>
      </div>

      <div class="landing__feature">
        <div class="landing__feature-header">
          <div class="landing__feature-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h3 class="landing__feature-title">{$t('landing.feature2Title')}</h3>
        </div>
        <p class="landing__feature-desc">{$t('landing.feature2Desc')}</p>
      </div>

      <div class="landing__feature">
        <div class="landing__feature-header">
          <div class="landing__feature-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <h3 class="landing__feature-title">{$t('landing.feature3Title')}</h3>
        </div>
        <p class="landing__feature-desc">{$t('landing.feature3Desc')}</p>
      </div>
    </div>
  </main>
</div>

<style>
  .landing {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .landing__backdrop {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at 50% 0%,
      var(--md-sys-color-tertiary-container) 0%,
      transparent 50%
    );
    pointer-events: none;
  }

  .landing__backdrop::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: 0.5;
    pointer-events: none;
  }

  .landing__content {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: var(--spacing-xl);
    max-width: 48rem;
    width: 100%;
  }

  .landing__brand {
    margin-bottom: var(--spacing-2xl);
  }

  .landing__title {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 8vw, 4rem);
    font-weight: 700;
    color: var(--md-sys-color-primary);
    letter-spacing: 0.05em;
    margin-bottom: var(--spacing-sm);
    animation: fadeSlideUp 0.8s ease-out;
  }

  .landing__tagline {
    font-family: var(--font-body);
    font-size: var(--font-size-lg);
    color: var(--md-sys-color-on-surface-variant);
    font-style: italic;
    animation: fadeSlideUp 0.8s ease-out 0.1s both;
  }

  .landing__hero {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    font-weight: 600;
    color: var(--md-sys-color-on-background);
    margin-bottom: var(--spacing-md);
    animation: fadeSlideUp 0.8s ease-out 0.2s both;
  }

  .landing__hero-subtitle {
    font-size: var(--font-size-lg);
    color: var(--md-sys-color-on-surface-variant);
    max-width: 36rem;
    margin: 0 auto var(--spacing-2xl);
    line-height: 1.7;
    animation: fadeSlideUp 0.8s ease-out 0.3s both;
  }

  .landing__cta {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: linear-gradient(
      135deg,
      var(--md-sys-color-primary) 0%,
      var(--md-sys-color-tertiary) 100%
    );
    color: var(--md-sys-color-on-primary);
    border: none;
    padding: var(--spacing-lg) var(--spacing-2xl);
    border-radius: var(--radius-md);
    cursor: pointer;
    box-shadow: var(--shadow-md);
    transition:
      transform var(--transition-fast),
      box-shadow var(--transition-fast);
    animation: fadeSlideUp 0.8s ease-out 0.4s both;
    min-height: 3.5rem;
  }

  .landing__cta:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .landing__cta:focus-visible {
    outline: 2px solid var(--md-sys-color-tertiary);
    outline-offset: 3px;
  }

  .landing__cta:active {
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
  }

  .landing__features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--spacing-xl);
    margin-top: var(--spacing-2xl);
    animation: fadeSlideUp 0.8s ease-out 0.5s both;
  }

  .landing__feature {
    padding: var(--spacing-lg);
    background: var(--md-sys-color-surface-container);
    border-radius: var(--radius-lg);
    border: 1px solid var(--md-sys-color-outline-variant);
  }

  .landing__feature-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .landing__feature-icon {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    color: var(--md-sys-color-tertiary);
  }

  .landing__feature-title {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  .landing__feature-desc {
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface-variant);
    line-height: 1.6;
  }

  @keyframes fadeSlideUp {
    from {
      opacity: 0;
      transform: translateY(1rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
