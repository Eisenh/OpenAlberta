<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount, onDestroy } from "svelte";
  import cytoscape from "cytoscape";

  export let graphData;
  export let onNodeClick;
  
  let cy; // Cytoscape instance
  let container;
  
  // Debugging variables
  let graphStatus = "Initializing";
  let nodeCount = 0;
  let edgeCount = 0;
  
  // Watch for changes in graphData
  $: if (cy && $graphData) {
    updateGraph($graphData);
  }
  
  // Initialize Cytoscape
  function initGraph() {
    if (!container) {
      console.error("Graph container element not found");
      graphStatus = "Error: Container not found";
      return;
    }
    
    console.log("Initializing Cytoscape graph");
    
    cy = cytoscape({
      container: container,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "white", // Use white background instead of hiding it
            "background-opacity": 1, // Show the background
            "label": function(ele) {
              // Truncate label to first 20 words and add ellipsis if needed
              const fullLabel = ele.data('label') || '';
              const words = fullLabel.split(' ');
              if (words.length > 20) {
                return words.slice(0, 20).join(' ') + '...';
              }
              return fullLabel;
            },
            "color": "#0B4F71", // Text color
            "text-valign": "center",
            "text-wrap": "wrap",
            "text-max-width": "180", // Increased max width for text
            "text-halign": "center",
            "font-weight": "bold",
            "font-size": "14px", // Further increased font size for better readability
            "width": 200, // Larger width for text boxes
            "height": 80, // Larger height for text boxes
            "shape": "rectangle", // Use rectangle shape to match text box
            "text-margin-y": 0, // No margin needed now
            "border-width": 1, // Add border to the node itself
            "border-color": "#E0E0E0", // Light border color
            "padding": 10 // Increased padding for easier grabbing
          },
        },
        {
          selector: "node[type='query']",
          style: {
            "color": "#F3A73C", // accent color for text
            "background-color": "white",
            "border-color": "#F3A73C", // accent color border
            "border-width": 2, // Thicker border for query nodes
            "width": 250, // Much larger for query nodes
            "height": 100, // Much larger for query nodes
            "padding": 15, // More padding for query nodes
            "font-size": "20px", // Even larger font for query nodes
            "text-max-width": "220", // Wider text for query node
          },
        },
        {
          selector: "edge",
          style: {
            "width": "mapData(weight, 1, 5, 1, 3)",
            "line-color": "#E0E0E0", // border color
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#E0E0E0", // border color
            "opacity": 0.7
          },
        },
      ],
      layout: { 
        name: "cose",
        idealEdgeLength: 150, // Increased for better spacing
        nodeOverlap: 10, // Reduced to prevent overlapping
        refresh: 20,
        fit: true,
        padding: 50, // Increased padding around the graph
        randomize: false,
        componentSpacing: 150, // Increased spacing between components
        nodeRepulsion: 600000, // Increased repulsion to spread nodes more
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 60, // Reduced gravity to allow nodes to spread out more
        numIter: 1500, // More iterations for better layout
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0
      },
      wheelSensitivity: 0.3,
    });

    // Handle hover event
    cy.on("mouseover", "node", (event) => {
      const node = event.target;
      node.style({
        'background-color': '#F5F5F5', // Slightly darker background on hover
        'border-color': node.data('type') === 'query' 
          ? '#F7BE6D' // accent-light color
          : '#1C6F99', // primary-light color
        'border-width': 2
      });
      
      const tooltip = document.getElementById("graph-tooltip");
      tooltip.innerHTML = node.data('description') || node.data('label');
      tooltip.style.display = "block";
      tooltip.style.left = `${event.originalEvent.pageX}px`;
      tooltip.style.top = `${event.originalEvent.pageY + 10}px`;
    });

    // Hide tooltip on mouseout
    cy.on("mouseout", "node", (event) => {
      const node = event.target;
      node.style({
        'background-color': 'white', // Reset to default
        'border-color': node.data('type') === 'query' 
          ? '#F3A73C' // accent color
          : '#E0E0E0', // default border color
        'border-width': node.data('type') === 'query' ? 2 : 1
      });
      document.getElementById("graph-tooltip").style.display = "none";
    });

    // Handle node click
    cy.on("tap", "node", (event) => {
      const node = event.target;
      if (onNodeClick) onNodeClick(node.data());
    });

    // Initial graph update if data is available
    if ($graphData && $graphData.nodes) {
      updateGraph($graphData);
    }
    
    graphStatus = "Graph initialized, waiting for data";
  }

  function updateGraph(data) {
    if (!cy) {
      graphStatus = "Error: Cytoscape not initialized";
      console.error("Cannot update graph: Cytoscape not initialized");
      return;
    }
    
    console.log("Updating graph with data:", data);
    
    cy.elements().remove(); // Clear previous elements
    
    if (!data.nodes || !data.links) {
      graphStatus = "Error: Invalid graph data structure";
      console.error("Invalid graph data structure:", data);
      return;
    }
    
    if (data.nodes.length === 0) {
      graphStatus = "No nodes to display";
      console.log("No nodes to display in graph");
      return;
    }
    
    // Format nodes
    const nodes = data.nodes.map(node => ({
      data: {
        ...node,
        type: node.id === 'query' ? 'query' : 'result',
      }
    }));
    
    // Format edges
    const edges = data.links.map((link, index) => ({
      data: {
        id: `edge-${index}`,
        source: link.source,
        target: link.target,
        weight: 3, // Default weight
      }
    }));
    
    console.log("Adding to graph:", nodes.length, "nodes and", edges.length, "edges");
    
    // Add elements and run layout
    try {
      cy.add([...nodes, ...edges]);
      cy.layout({ name: 'cose', fit: true }).run();
      cy.center();
      cy.fit();
      
      nodeCount = nodes.length;
      edgeCount = edges.length;
      graphStatus = `Rendered ${nodes.length} nodes and ${edges.length} edges`;
      console.log("Graph updated successfully");
    } catch (error) {
      graphStatus = `Error rendering graph: ${error.message}`;
      console.error("Error rendering graph:", error);
    }
  }

  onMount(() => {
    initGraph();
    
    // Add window resize handler
    const handleResize = () => {
      if (cy) {
        cy.resize();
        cy.fit();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
  
  onDestroy(() => {
    if (cy) {
      cy.destroy();
    }
  });
</script>

<!-- Graph Container -->
<div bind:this={container} class="graph-wrapper"></div>

<!-- Tooltip for hover event -->
<div id="graph-tooltip" class="graph-tooltip"></div>

<!-- Debug Overlay -->
<div class="graph-debug-overlay">
  <span>Status: {graphStatus}</span>
  <span>Nodes: {nodeCount} | Edges: {edgeCount}</span>
</div>

<style>
  .graph-wrapper {
    width: 100%;
    height: 500px;
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-md);
    position: relative;
  }
  
  .graph-tooltip {
    display: none;
    position: absolute;
    background: var(--color-background-alt);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    box-shadow: var(--shadow-md);
    font-size: 0.9rem;
    max-width: 280px;
    z-index: 1000;
    color: var(--color-text);
    text-align: center;
  }
  
  .graph-debug-overlay {
    position: absolute;
    bottom: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10;
    display: flex;
    flex-direction: column;
  }
</style>
