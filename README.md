# OpenDataABOnline - Svelte + Vite App

This application provides a web interface for OpenDataABOnline, built with Svelte and Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

## Need an official Svelte framework?

Check out [SvelteKit](https://github.com/sveltejs/kit#readme), which is also powered by Vite. Deploy anywhere with its serverless-first approach and adapt to various platforms, with out of the box support for TypeScript, SCSS, and Less, and easily-added support for mdsvex, GraphQL, PostCSS, Tailwind CSS, and more.

## Technical considerations

**Why use this over SvelteKit?**

- It brings its own routing solution which might not be preferable for some users.
- It is first and foremost a framework that just happens to use Vite under the hood, not a Vite app.

This template contains as little as possible to get started with Vite + Svelte, while taking into account the developer experience with regards to HMR and intellisense. It demonstrates capabilities on par with the other `create-vite` templates and is a good starting point for beginners dipping their toes into a Vite + Svelte project.

Should you later need the extended capabilities and extensibility provided by SvelteKit, the template has been structured similarly to SvelteKit so that it is easy to migrate.

**Why `global.d.ts` instead of `compilerOptions.types` inside `jsconfig.json` or `tsconfig.json`?**

Setting `compilerOptions.types` shuts out all other types not explicitly listed in the configuration. Using triple-slash references keeps the default TypeScript setting of accepting type information from the entire workspace, while also adding `svelte` and `vite/client` type information.

**Why include `.vscode/extensions.json`?**

Other templates indirectly recommend extensions via the README, but this file allows VS Code to prompt the user to install the recommended extension upon opening the project.

**Why enable `checkJs` in the JS template?**

It is likely that most cases of changing variable types in runtime are likely to be accidental, rather than deliberate. This provides advanced typechecking out of the box. Should you like to take advantage of the dynamically-typed nature of JavaScript, it is trivial to change the configuration.

**Why is HMR not preserving my local component state?**

HMR state preservation comes with a number of gotchas! It has been disabled by default in both `svelte-hmr` and `@sveltejs/vite-plugin-svelte` due to its often surprising behavior. You can read the details [here](https://github.com/sveltejs/svelte-hmr/tree/master/packages/svelte-hmr#preservation-of-local-state).

If you have state that's important to retain within a component, consider creating an external store which would not be replaced by HMR.

```js
// store.js
// An extremely simple external store
import { writable } from 'svelte/store'
export default writable(0)
```

## Deploying to GitHub Pages

This application is configured to deploy to GitHub Pages. Follow these steps to set it up:

1. **Create a GitHub Repository**
   
   Create a new GitHub repository or use an existing one to host this project.

2. **Configure Your Repository Name in vite.config.js**
   
   Open `vite.config.js` and update the `base` path to match your repository name:
   
   ```js
   // Uncomment and replace 'repo-name' with your actual repository name
   base: '/your-repo-name/',
   ```

3. **Set Up Repository Secrets**
   
   The app requires environment variables that contain sensitive API keys. These should be stored as GitHub repository secrets:
   
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `VITE_QDRANT_URL` - Your Qdrant database URL
     - `VITE_QDRANT_API_KEY` - Your Qdrant API key

4. **Push Your Code to GitHub**
   
   Commit and push your code to the GitHub repository:
   
   ```bash
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

5. **Enable GitHub Pages**
   
   In your GitHub repository:
   - Go to Settings → Pages
   - Under "Build and deployment" → "Source", select "GitHub Actions"
   
   The workflow file (`.github/workflows/deploy.yml`) provided in this repository will handle the build and deployment processes.

6. **Access Your Deployed Site**
   
   After the GitHub Actions workflow completes, your site will be available at:
   `https://yourusername.github.io/your-repo-name/`

### Handling Client-Side Routing

Since this app uses client-side routing, you may need to add a redirect in the `404.html` file for GitHub Pages to properly handle direct URL access to routes. This is automatically set up by the deployment workflow.
