<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import Header from '../components/Header.svelte';
</script>

<div class="layout">
  <Header />
  <main class="main-content">
    <div class="container">
      <slot />
    </div>
  </main>
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-section">
          <p class="mb-0">&copy; {new Date().getFullYear()} Eisenhawer Tech</p>
        </div>
        <div class="footer-section">
          <p class="text-right mb-0">Powered by vector search</p>
        </div>
      </div>
    </div>
  </footer>
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--color-background);
  }

.main-content {
  flex: 1;
  display: flex;
  flex-direction: row;
  padding: var(--spacing-xl) 0;
}

.container {
  display: flex;
  flex: 1;
}


  .footer {
    background-color: var(--color-background-alt);
    border-top: 1px solid var(--color-border);
    padding: var(--spacing-lg) 0;
    color: var(--color-text-light);
  }

  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  @media (max-width: 768px) {
    .footer-content {
      flex-direction: column;
      gap: var(--spacing-md);
      text-align: center;
    }

    .footer-section p.text-right {
      text-align: center;
    }

    .main-content {
      padding: var(--spacing-lg) 0;
    }
  }
</style>
