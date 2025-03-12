<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { navigate } from '../stores/route.js';
</script>

<div class="not-found-page">
  <div class="not-found-content">
    <div class="not-found-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <h1>Page Not Found</h1>
    <p class="not-found-message">The page you are looking for doesn't exist or has been moved.</p>
    <div class="not-found-actions">
      <button class="primary-action" on:click={() => navigate('/')}>
        Return to Home
      </button>
      <button class="secondary-action outline" on:click={() => window.history.back()}>
        Go Back
      </button>
    </div>
  </div>
</div>

<style>
  .not-found-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
    padding: var(--spacing-xl);
  }

  .not-found-content {
    text-align: center;
    max-width: 600px;
    padding: var(--spacing-xxl);
    border-radius: var(--border-radius-lg);
    background-color: var(--color-background-alt);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border);
  }

  .not-found-icon {
    margin-bottom: var(--spacing-lg);
    color: var(--color-primary);
  }

  h1 {
    color: var(--color-primary);
    margin-bottom: var(--spacing-md);
    font-size: 2.2rem;
  }

  .not-found-message {
    margin-bottom: var(--spacing-xl);
    color: var(--color-text-light);
    font-size: 1.1rem;
  }

  .not-found-actions {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
  }

  .primary-action {
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--border-radius-md);
    font-size: 1rem;
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .primary-action:hover {
    background-color: var(--color-primary-light);
    transform: translateY(-2px);
  }

  .secondary-action {
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: transparent;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--border-radius-md);
    font-size: 1rem;
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .secondary-action:hover {
    background-color: rgba(11, 79, 113, 0.05);
    transform: translateY(-2px);
  }

  @media (max-width: 768px) {
    .not-found-actions {
      flex-direction: column;
      gap: var(--spacing-sm);
    }
  }
</style>
