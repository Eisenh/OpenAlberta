<script>
  import { onMount } from 'svelte';
  
  // State to track if terms are expanded/collapsed
  let sectionsExpanded = {
    introduction: true,
    license: true,
    dataUsage: true,
    userConduct: true,
    limitations: true,
    privacyPolicy: true,
    changes: true
  };
  
  // Toggle section expansion with keyboard and click support
  function toggleSection(section) {
    sectionsExpanded[section] = !sectionsExpanded[section];
  }
  
  // Handle keyboard events for accessibility
  function handleKeyDown(event, section) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSection(section);
    }
  }
  
  // Format date for the footer
  const currentYear = new Date().getFullYear();
</script>

<div class="terms-container">
  <header>
    <h1>Terms of Service</h1>
    <p class="last-updated">Last Updated: March 21, 2025</p>
  </header>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('introduction')}
      on:keydown={(e) => handleKeyDown(e, 'introduction')}
      aria-expanded={sectionsExpanded.introduction}
      aria-controls="introduction-content"
      type="button"
    >
      <h2>1. Introduction</h2>
      <span class="toggle-icon">{sectionsExpanded.introduction ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.introduction}
      <div class="section-content" id="introduction-content">
        <p>
          Welcome to the Open Alberta web application. By accessing or using this application,
          you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms,
          you may not access or use the application.
        </p>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('license')}
      on:keydown={(e) => handleKeyDown(e, 'license')}
      aria-expanded={sectionsExpanded.license}
      aria-controls="license-content"
      type="button"
    >
      <h2>2. License</h2>
      <span class="toggle-icon">{sectionsExpanded.license ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.license}
      <div class="section-content" id="license-content">
        <p>
          This web application is copyright © {currentYear} Eisenhawer Tech and is licensed under the MIT License. Source code is available at <a href = "https://github.com/Eisenh/OpenAlberta">https://github.com/Eisenh/OpenAlberta</a>
        </p>
        <p>
          Permission is hereby granted, free of charge, to any person obtaining a copy of this software and 
          associated documentation files (the "Software"), to deal in the Software without restriction, including 
          without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or 
          sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject 
          to the following conditions:
        </p>
        <p>
          The above copyright notice and this permission notice shall be included in all copies or substantial 
          portions of the Software.
        </p>
        <p class="license-disclaimer">
          THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
          LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
          IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
          WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
          SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
        </p>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('dataUsage')}
      on:keydown={(e) => handleKeyDown(e, 'dataUsage')}
      aria-expanded={sectionsExpanded.dataUsage}
      aria-controls="dataUsage-content"
      type="button"
    >
      <h2>3. Data Usage and Attribution</h2>
      <span class="toggle-icon">{sectionsExpanded.dataUsage ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.dataUsage}
      <div class="section-content" id="dataUsage-content">
        <p>
          This application uses data sourced from the open.alberta.ca CKAN repository. This data is made 
          available under the terms set by the Government of Alberta.
        </p>
        <p>
          Users acknowledge that:
        </p>
        <ul>
          <li>The data is provided by the Government of Alberta and Eisenhawer Tech does not guarantee its accuracy, completeness, or currency</li>
          <li>When using or redistributing the data, proper attribution to the original source (open.alberta.ca) must be maintained</li>
          <li>Any derivative works should clearly indicate that they are based on open data from the Government of Alberta</li>
        </ul>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('userConduct')}
      on:keydown={(e) => handleKeyDown(e, 'userConduct')}
      aria-expanded={sectionsExpanded.userConduct}
      aria-controls="userConduct-content"
      type="button"
    >
      <h2>4. User Conduct</h2>
      <span class="toggle-icon">{sectionsExpanded.userConduct ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.userConduct}
      <div class="section-content" id="userConduct-content">
        <p>
          Users of this application agree not to:
        </p>
        <ul>
          <li>Use the application in any way that violates applicable local, provincial, national, or international law</li>
          <li>Attempt to interfere with, compromise, or disrupt the application or servers connected to it, including database infrastruture</li>
          <li>Attempt to reverse engineer or access source code not made available under the MIT license</li>
          <li>Use automated methods to scrape or harvest data from the application beyond reasonable use</li>
          <li>Use the application to transmit any material that is unlawful, harmful, threatening, abusive, or otherwise objectionable</li>
        </ul>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('limitations')}
      on:keydown={(e) => handleKeyDown(e, 'limitations')}
      aria-expanded={sectionsExpanded.limitations}
      aria-controls="limitations-content"
      type="button"
    >
      <h2>5. Limitations of Liability</h2>
      <span class="toggle-icon">{sectionsExpanded.limitations ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.limitations}
      <div class="section-content" id="limitations-content">
        <p>
          Eisenhawer Tech shall not be liable for any direct, indirect, incidental, special, consequential, 
          or exemplary damages resulting from:
        </p>
        <ul>
          <li>Your use or inability to use the application</li>
          <li>Any unauthorized access to or use of our servers and/or any data stored therein</li>
          <li>Any errors, mistakes, or inaccuracies in the data</li>
          <li>Any interruption or cessation of transmission to or from the application</li>
        </ul>
        <p>
          This limitation of liability applies whether the alleged liability is based on contract, tort, 
          negligence, strict liability, or any other basis, even if Eisenhawer Tech has been advised of 
          the possibility of such damage.
        </p>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('privacyPolicy')}
      on:keydown={(e) => handleKeyDown(e, 'privacyPolicy')}
      aria-expanded={sectionsExpanded.privacyPolicy}
      aria-controls="privacyPolicy-content"
      type="button"
    >
      <h2>6. Privacy Policy</h2>
      <span class="toggle-icon">{sectionsExpanded.privacyPolicy ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.privacyPolicy}
      <div class="section-content" id="privacyPolicy-content">
        <p>
          Your use of the application is also governed by our Privacy Policy, which outlines how we collect, 
          use, and protect your personal information. By using this application, you consent to the data 
          practices described in the Privacy Policy.
        </p>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('changes')}
      on:keydown={(e) => handleKeyDown(e, 'changes')}
      aria-expanded={sectionsExpanded.changes}
      aria-controls="changes-content"
      type="button"
    >
      <h2>7. Changes to Terms</h2>
      <span class="toggle-icon">{sectionsExpanded.changes ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.changes}
      <div class="section-content" id="changes-content">
        <p>
          Eisenhawer Tech reserves the right to modify or replace these Terms at any time. Material changes to 
          these Terms will be notified through the application or via email. Your continued use of the application 
          after any such changes constitutes your acceptance of the new Terms.
        </p>
      </div>
    {/if}
  </section>
  
  <footer>
    <p>© {currentYear} Eisenhawer Tech. All rights reserved.</p>
    <p>If you have any questions about these Terms, or to report security concerns please contact us at security@eisenhawer.ca</p>
  </footer>
</div>

<style>
  .terms-container {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.6;
    color: #333;
  }
  
  header {
    margin-bottom: 2rem;
    border-bottom: 1px solid #eaeaea;
    padding-bottom: 1rem;
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  h2 {
    font-size: 1.25rem;
    margin: 0;
  }
  
  .last-updated {
    font-size: 0.9rem;
    color: #666;
  }
  
  section {
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #eaeaea;
    padding-bottom: 0.5rem;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    text-align: left;
    padding: 0.75rem 0;
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
  }
  
  .section-header:hover {
    background-color: #f5f5f5;
  }
  
  .section-header:focus {
    outline: 2px solid #007bff;
    border-radius: 4px;
  }
  
  .toggle-icon {
    font-size: 1.5rem;
    font-weight: bold;
    color: #555;
  }
  
  .section-content {
    padding: 0.5rem 0 1rem;
  }
  
  ul {
    padding-left: 1.5rem;
    margin-top: 0.5rem;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
  
  .license-disclaimer {
    font-size: 0.9rem;
    background-color: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
  }
  
  footer {
    margin-top: 2rem;
    font-size: 0.9rem;
    color: #666;
    text-align: center;
  }
</style>