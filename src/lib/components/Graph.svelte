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
    const nodes = data.nodes.map((node, index) => {
      const isQueryNode = node.id === 'query';
      const position = isQueryNode ? { x: 0, y: 0 } : calculateNodePosition(index - 1);
      
      // For query node, use search text from description
      const nodeData = isQueryNode ? {
        ...node,
        label: node.label, // Use full search text as label
        description: node.description, // preserve full description
        type: 'query'
      } : {
        ...node,
        type: 'result'
      };

      return {
        data: nodeData,
        position: position
      };
    });

    // Calculate positions for rectangular layout
    function calculateNodePosition(index) {
      const width = 800;  // Increased horizontal spread
      const height = 500; // Maintain vertical spread
      
      // Positions arranged with one node near each corner and side
      const positions = [
        { x: -width/2, y: -height/2 },  // top-left
        { x: width/2, y: -height/2 },    // top-right
        { x: width/2, y: height/2 },     // bottom-right
        { x: -width/2, y: height/2 },    // bottom-left
        { x: 0, y: -height/2 },         // top-center
        { x: width/2, y: 0 },           // right-center
        { x: 0, y: height/2 },          // bottom-center
        { x: -width/2, y: 0 }           // left-center
      ];
      
      // Use modulo to cycle through positions if more than 8 nodes
      return positions[index % 8];
    }
    
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
      cy.layout({ name: 'preset', fit: true }).run();
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
