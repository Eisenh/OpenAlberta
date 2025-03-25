<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount, onDestroy } from "svelte";
  import cytoscape from "cytoscape";
  import { get } from "svelte/store";
  import fcose from "cytoscape-fcose";
  import { displaySimilarityThreshold } from "../stores/graphSettings.js";

  export let data;
  export let onNodeClick;
  export let onNodeDblClick;
  
  let cy; // Cytoscape instance
  let container;
  let lastTap = 0;
  const doubleClickDelay = 300; // milliseconds
  //let baseSize = 20;  // Base node size
  let minScaleFactor = 0.1;
  let maxScaleFactor = 50;
  // Debugging variables
  let graphStatus = "Initializing";
  let nodeCount = 0;
  let edgeCount = 0;
  let edgeMin, edgeMax, edgeMid = 0;
  let simMin, simMax = 0;
  let zoom = 1;
  
  let threshold = get(displaySimilarityThreshold);

  // Watch for changes in graphData
  $: if (cy && data) {
    //const data = get(graphData);
    console.log("GraphExpanded component reactive statement triggered with data:", data);
    edgeMax = Math.max(...data.links.map(obj => obj.weight));  
    edgeMin = Math.min(...data.links.map(obj => obj.weight));
    simMax = Math.max(...data.nodes.slice(1).map(obj => obj.similarity)); // ignore query node sim of 1
    simMin = Math.min(...data.nodes.map(obj => obj.similarity));

//    console.log(" sinMin ",simMin, "  max ", simMax, " edgeMin ",edgeMin, " edgeMax ", edgeMax )
    updateGraph(data);
    
  }

  // Function to update element styles based on threshold and zoom
  function updateElementStyles(graph) {
     // Ensure zoom is never zero to prevent division by zero
    const zoom = Math.max(0.00001, graph.zoom() || 0.00001);
    const scaleFactor = 2 / zoom;
    const fontsize = 12 * scaleFactor + "px";
    
    // Update nodes
    graph.nodes().forEach(node => {
      let newSize = 30* node.data('similarity') * scaleFactor;
      node.style({
          'width': newSize,
          'height': newSize,
          'font-size': fontsize,
      });
    });
    
    // Update edges based on threshold
    graph.edges().forEach(link => {
      let baseWeight = 5* (link.data('weight') - edgeMin) + 1;
      const weight = link.data('weight') || 0;
      const display = weight < threshold ? 'none' : '';
      
      link.style({
        'width': baseWeight * scaleFactor,
        'display': display
      });
    });
  }
  // Initialize Cytoscape
  function initGraph() {
    if (!container) {
      console.error("Graph container element not found");
      graphStatus = "Error: Container not found";
      return;
    }
    
//    console.log("Initializing Expanded Cytoscape graph ");
    
    cytoscape.use(fcose);
    cy = cytoscape({
      container: container,
      userPanningEnabled: true,
      userZoomingEnabled: true,
      //wheelSensitivity: 0.3,
      zoom: 1,  // Set initial zoom
      pan: { x: 0, y: 0 },  // Center the graph
      fit: true  // Adjust the viewport to fit all nodes
    });
    
    // Apply expanded style
    cy.style([
      {
        selector: "node",
        style: {
          "background-color": "#6c757d",
          "label": "",
          //'width': baseSize,
          //'height': baseSize,
          "border-width": 0
        }
      },
      {  // query node and identical nodes are styled differently
        selector: "node[similarity >= 0.99]",
        
          style: {
            'background-color': '#F3A73C',
            'label': 'data(label)',
            // TODO figure out why mapData is invalid
            //'width': 'mapData(data(similarity), 0.0, 1.1, 1, 50)', //baseSize,
            //'height': 'mapData(data(similarity), 0.3, 1, 1, 50)',
            //'font-size': '12px',
            'text-wrap': 'wrap', // Enable text wrapping
            //'text-max-width': '10em', // Set maximum width for text wrapping
            'border-width': 0,
            'text-background-color': 'lightgrey',
            'z-index': 50,
            'text-background-opacity': .8
          }
      },
      {
        selector: 'node.hover',
        style: {
          'background-color': 'green',
          //'width': 60,
          //'height': 60
        }
      },
      {
        selector: "edge",
        style: {
          //"width": 'data(weight)',  // Width based on weight
          "line-color": "#E0E0E0", // border color
          //"curve-style": "bezier",
          //"target-arrow-shape": "triangle",
          "target-arrow-color": "#E0E0E0", // border color
          "opacity": .9,
        }
      }
    ]);

    cy.on('zoom', () => updateElementStyles(cy));    
   
    // Handle hover event to show tooltip
    cy.on("mouseover", "node", (event) => {
      const node = event.target;
      node.addClass('hover');
      const similarity = node.data('similarity') || 0;
             
      const tooltip = document.getElementById("graph-tooltip-expanded");
      const containerRect = container.getBoundingClientRect();

      // Calculate position relative to the container
      const x = event.originalEvent.clientX - containerRect.left + 10;
      const y = event.originalEvent.clientY - containerRect.top + 10;

      setTimeout(() => {
        // Format similarity with 2 decimal places if available
        //const simText = similarity ? similarity.toFixed(2) + " - " : "";
        tooltip.innerHTML = "<b>" +  node.data('label') + "</b> <p>" +(node.data('description') ) + "</p>";
        tooltip.style.display = "block";
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
      }, 50);
    });

    cy.on("mouseover", "edge", (event) => {
      const edge = event.target;
      //node.addClass('hover-');
      const similarity = edge.data('weight') || 0;
             
      const tooltip = document.getElementById("graph-tooltip-expanded");
      const containerRect = container.getBoundingClientRect();

      // Calculate position relative to the container
      const x = event.originalEvent.clientX - containerRect.left + 10;
      const y = event.originalEvent.clientY - containerRect.top + 10;

      setTimeout(() => {
        // Format similarity with 2 decimal places if available
        const simText = similarity ? similarity.toFixed(2) : "unknown";
        tooltip.innerHTML = "Similarity: " + simText ;//+ (edge.data('description') || node.data('label'));
        tooltip.style.display = "block";
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
      }, 50);
    });

    // Hide tooltip on mouseout
    cy.on("mouseout", "node", (event) => {
      const node = event.target;
      
      node.removeClass('hover');
      
      document.getElementById("graph-tooltip-expanded").style.display = "none";
    });
    
    cy.on("tap", "node", (event) => {
      // Check if it is a double-click
      const currentTime = Date.now();
      if (currentTime - lastTap < doubleClickDelay) {
          const node = event.target;
          console.log("Double-clicked node:", node.id());
          onNodeDblClick(node.data());
      }
      lastTap = currentTime;
      const node = event.target;
      if (onNodeClick) onNodeClick(node.data());
    });

    // Initial graph update if data is available
    //if (data && data.nodes) {
     //updateGraph(data);
    //}
    
  // Subscribe to the displaySimilarityThreshold store
    displaySimilarityThreshold.subscribe(value => {
      threshold = value;
      if (cy) {
        updateElementStyles(cy);
      }
    });
    graphStatus = "Graph initialized, waiting for data";
    /*
    console.log("Expanded graph component initialized with data:", data);
    edgeMax = Math.max(...data.links.map(obj => obj.weight));
    edgeMin = Math.min(...data.links.map(obj => obj.weight));
    edgeMid = (edgeMax + edgeMin)/2;
    //displaySimilarityThreshold.set(edgeMid);
    simMax = Math.max(...data.nodes.slice(1).map(obj => obj.similarity));
    simMin = Math.min(...data.nodes.map(obj => obj.similarity));
    updateGraph(data);
    */
  }

  function updateGraph(data) {
    if (!cy || !data?.nodes) {
      console.error("Cannot update graph: missing Cytoscape instance or invalid data");
      return;
    }

//    console.log("Received graph data in expanded view:", data);

    try {
      cy.batch(() => {
        // Remove existing elements
        cy.elements().remove();

        let nodes = data.nodes;
        let links = data.links;


        // Add new elements
        // Add nodes with initial positions based on similarity
        const elements = data.nodes.map((node, index) => {
        // Calculate radius inversely proportional to similarity
        const minDistance = 5;  // Minimum distance from center
        const maxDistance = 300; // Maximum distance from center
        let norm = 0;
        // Use similarity to determine radius - higher similarity means closer to center
        // Default to maxDistance if similarity is missing or too low
        const similarity = node.similarity || 0.3;
        if (simMax === simMin) {
          norm = 1; 
        } else norm = (similarity - simMin + 0.1) / (simMax - simMin + 0.1); 
          //0-1
        
        if (index === 0) { //(node.id === 'query') {
          node.distance = 0;// * (simMax - similarity)/(simMax - simMin) ;
          node.diameter = 20;
          return {
            data: { ...node },
            position: { x: 0, y: 0 }
          };
        }
        node.distance = minDistance + minDistance / (norm * norm);// * (simMax - similarity)/(simMax - simMin) ;
        node.diameter = Math.max(10 + 20 * norm, 20);
        //console.log("distance ",index, " " , node.distance, "  similarity ",similarity, " norm ", norm)
        
        // Place nodes in a circle with radius based on similarity
        const angle = (2 * Math.PI * index) / (node.distance - 1);
          return {
            data: { ...node },
            position: {
              x: node.distance * Math.cos(angle),
              y: node.distance * Math.sin(angle)
            }
          };
        });
        
        // Add edges with weights based on similarity
        const edges = data.links.map(link => ({
          data: {
            ...link,
            // weight: link.weight * link.weight || 5
          }
        }));

        cy.add([...elements, ...edges]);
        
        //cy.center();
        //cy.fit();
      /*
        // Apply force-directed layout
        const layout = cy.layout({
          name: 'cose',
          idealEdgeLength: edge => {
            // TODO this is inefficent and should be move outside the loop
            let norm = 0;  // noralized weight ~0-1
            if (edgeMax === edgeMin) {
              norm = 1; 
            } else norm = (edge.data('weight') - edgeMin + 0.1) / (edgeMax - edgeMin + 0.1); 
            //0-1
            //const scale = 1/ ((edge.data('weight') - edgeMin + 0.1) / (edgeMax - edgeMin)); 
            //console.log("edge.data('weight') ",edge.data('weight'), " layout scale: ", scale);
            const minLength = 5; // Minimum length for high similarity
            const maxLength = 100; // Maximum length for low similarity
            const length = minLength +  minLength/ norm;  //Math.min(maxLength, minLength * scale);
            return length;
          },
          
          fit: true,
          padding: 50,
          quality: "default",
          randomize: false,
          nodeRepulsion: 0,
          nodeOverlap: 10,
          edgeElasticity: 0.45,
          gravity: 0.25,
          gravityRange: 3.8,
          gravityCompound: 1.0,
          gravityRangeCompound: 1.5,
          // Animation parameters
           numIter: 10,
          animate: true,
          animationDuration: 300,
          refresh: 10
        });

        layout.run();
        */
        cy.center();
        cy.fit();
      });
      nodeCount = data.nodes.length;
      edgeCount = data.links.length;
      graphStatus = `Rendered ${nodeCount} nodes and ${edgeCount} edges`;
      
//      console.log("Expanded graph updated successfully with ", nodeCount, " nodes, ", edgeCount, " edges");
    } catch (error) {
      console.error("Error updating expanded graph:", error);
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
<div id="graph-tooltip-expanded" class="graph-tooltip"></div>

<!-- Debug Overlay -->
{#if import.meta.env.DEV}
  <div class="graph-debug-overlay">
    <span>Status: {graphStatus}   Zoom {zoom}</span>
    <span>Nodes: {nodeCount} | Edges: {edgeCount}</span>
    <span>sinMin {simMin}, max {simMax}, edgeMin {edgeMin}, edgeMax {edgeMax}</span>
  </div>
{/if} 

<style>
  .graph-wrapper {
    width: 100%;
    height:100%;
    height: 500px;
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-md);
    position: relative; /* Added to make this the positioning context for the tooltip */
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
