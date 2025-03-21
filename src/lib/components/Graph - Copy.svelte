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
              "background-color": "white",
              "background-opacity": 1,
              "label": "data(label)",
              "color": "#0B4F71",
              "text-valign": "center",
              "text-wrap": "wrap",
              "text-max-width": "200",
              "text-halign": "center",
              "font-weight": "bold", 
              "font-size": "20px",
              "width": 280,
              "height": 140,
              "shape": "rectangle",
              "border-width": 1,
              "border-color": "#E0E0E0",
              "padding": 12
            },
          },
          {
            selector: "node[type='query']",
            style: {
              "color": "#F3A73C",
              "background-color": "white",
              "border-color": "#F3A73C",
              "border-width": 3,
              "width": 280,
              "height": 120,
              "padding": 12,
              "font-size": "24px",
              "text-max-width": "300",
            },
          },
        {
          selector: "edge",
          style: {
            "width": "mapData(weight, 0.5, 1, 1, 8)",
            "line-color": "#E0E0E0", // border color
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#E0E0E0", // border color
            "opacity": 0.7
          },
        },
        {
          selector: "edge.debug",
          style: {
            "label": "data(weight)",
            "font-size": "12px",
            "color": "black",
            "text-background-color": "white",
            "text-background-opacity": 0.7
          }
        },
      ],
      layout: {
        name: "preset",
        fit: true,
        padding: 30,
      },
      userPanningEnabled: true,
      userZoomingEnabled: true,
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
      // Add small delay and offset to prevent click interference
      setTimeout(() => {
        tooltip.innerHTML = node.data('description') || node.data('label');
        tooltip.style.display = "block";
        tooltip.style.left = `${event.originalEvent.pageX + 25}px`; // Increased horizontal offset
        tooltip.style.top = `${event.originalEvent.pageY + 30}px`; // Increased vertical offset
      }, 50); // Reduced delay
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
// Add this function before updateGraph
function calculateNodePosition(index) {
  const width = 800;  // Horizontal spread
  const height = 500; // Vertical spread
  
  const positions = [
    { x: -width/2, y: -height/2 },  // top-left
    { x: width/2, y: -height/2 },   // top-right
    { x: width/2, y: height/2 },    // bottom-right
    { x: -width/2, y: height/2 },   // bottom-left
    { x: 0, y: -height/2 },         // top-center
    { x: width/2, y: 0 },           // right-center
    { x: 0, y: height/2 },          // bottom-center
    { x: -width/2, y: 0 }           // left-center
  ];
  
  return positions[index % 8];
}

function updateGraph(data) {
  if (!cy || !data?.nodes) {
    console.error("Cannot update graph: missing Cytoscape instance or invalid data");
    return;
  }

  console.log("Received graph data:", data);

  try {
    // Remove existing elements
    cy.elements().remove();

    // Add new elements
    cy.add([
      // Add nodes with positions
      ...data.nodes.map((node, index) => ({
        data: {
          ...node,
          type: node.type || (node.id === 'query' ? 'query' : 'result')
        },
        position: node.id === 'query' 
          ? { x: 0, y: 0 }
          : calculateNodePosition(index - 1)
      })),
      // Add edges with weights
      ...data.links.map((link, index) => ({
        data: {
          id: `edge-${index}`,
          source: link.source,
          target: link.target,
          weight: link.weight || 3
        }
      }))
    ]);

    // Apply layout
    cy.layout({ name: 'preset', fit: true }).run();
    cy.center();
    cy.fit();

    nodeCount = data.nodes.length;
    edgeCount = data.links.length;
    graphStatus = `Rendered ${nodeCount} nodes and ${edgeCount} edges`;
    
    console.log("Graph updated successfully");
  } catch (error) {
    console.error("Error updating graph:", error);
    graphStatus = `Error: ${error.message}`;
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
    pointer-events: none;
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
