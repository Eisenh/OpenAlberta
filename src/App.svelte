<script>
  import { currentRoute } from './lib/stores/route';
  import MainLayout from './lib/layouts/MainLayout.svelte';
  import { routes } from '../routes';
  import NotFound from './lib/pages/NotFound.svelte';

  let component;

  $: {  component = routes[$currentRoute] || NotFound; }
</script>

<MainLayout>
  <svelte:component this={component} />
</MainLayout>
