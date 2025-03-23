<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount, onDestroy } from "svelte";
  import cytoscape from "cytoscape";
  import { get } from "svelte/store";
  import fcose from "cytoscape-fcose";
  import { displaySimilarityThreshold } from "../stores/graphSettings.js";
  

  export let data;  // this is where the siilarityGraphData is passed.
  let threshold = get(displaySimilarityThreshold);
  export let onNodeClick;
  export let onNodeDblClick;
  
  let cy; // Cytoscape instance
  let container;
  let lastTap = 0;
  const doubleClickDelay = 300; // milliseconds
  //let baseSize = 5;  // Base node size
  let minScaleFactor = 0.1;
  let maxScaleFactor = 1.2;

  // Debugging variables
  let graphStatus = "Initializing";
  let nodeCount = 0;
  let edgeCount = 0;
  let edgeMin, edgeMax, edgeMid = 0;
  let simMin, simMax = 0;
  let zoom = 1;
  /*
  // Watch for changes in graphData
  $: if (cy && data) {
    //const data = get(graphData);
    console.log("Network graph component reactive statement triggered with data:", data);
    edgeMax = Math.max(...data.links.map(obj => obj.weight));
    edgeMin = Math.min(...data.links.map(obj => obj.weight));
    edgeMid = (edgeMax + edgeMin)/2;
    displaySimilarityThreshold.set(edgeMid);
    simMax = Math.max(...data.nodes.slice(1).map(obj => obj.similarity));
    simMin = Math.min(...data.nodes.map(obj => obj.similarity));
    updateGraph(data);
  }
*/
  // Function to update element styles based on threshold and zoom
  function updateElementStyles(graph) {
    const scaleFactor = 1 / (graph.zoom());
    const fontsize = 12 * scaleFactor + "px";
    
    // Update nodes
    graph.nodes().forEach(node => {
      let newSize = node.data('diameter') * scaleFactor;
      node.style({
          'width': newSize,
          'height': newSize,
          'font-size': fontsize,
          'text-wrap': 'wrap',
          'text-max-width': '100px'
      });
    });

    // Update edges based on threshold
    graph.edges().forEach(link => {
      let baseWeight = 10 * (link.data('weight') - edgeMin) + 3;
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
    
    console.log("Initializing Similarity Cytoscape graph");
    
    cytoscape.use(fcose);
    cy = cytoscape({
      container: container,
      userPanningEnabled: true,
      userZoomingEnabled: true,
     // wheelSensitivity: 0.3
      zoom: 1,  // Set initial zoom
      pan: { x: 0, y: 0 },  // Center the graph
      //fit: true  // Adjust the viewport to fit all nodes
    });
    
  // Subscribe to the displaySimilarityThreshold store
    displaySimilarityThreshold.subscribe(value => {
      threshold = value;
      if (cy) {
        updateElementStyles(cy);
      }
    });
    // Apply expanded style
    cy.style([
      {
        selector: 'node.hover',
        style: {
          'background-color': 'green',
        }
      },
    ]);

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

    cy.on("mouseout", "edge", (event) => {
      const node = event.target;
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

    graphStatus = "Graph initialized, waiting for data";
    //updateGraph();
    edgeMax = Math.max(...data.links.map(obj => obj.weight));
    edgeMin = Math.min(...data.links.map(obj => obj.weight));
    edgeMid = (edgeMax + edgeMin)/2;
    //displaySimilarityThreshold.set(edgeMid);
    simMax = Math.max(...data.nodes.slice(1).map(obj => obj.similarity));
    simMin = Math.min(...data.nodes.map(obj => obj.similarity));
    updateGraph(data);
    console.log("Network graph component initialized with data:", data);
  }

  function updateGraph(data) {
    if (!cy || !data?.nodes) {
      console.error("Cannot update graph: missing Cytoscape instance or invalid data");
      return;
    }

    console.log("Received graph data in network view:", data);

    try {
      cy.batch(() => {
        // Remove existing elements
        cy.elements().remove();

        const minDistance = 5;  // Minimum distance from center
        const maxDistance = 100; // Maximum distance from center
        const threshold = get(displaySimilarityThreshold);
        // Add new elements
        // Add nodes with initial positions based on similarity
        const nodes = data.nodes.map((node, index) => {
           // Calculate radius inversely proportional to similarity
          let normSim = 0;
          // Use similarity to determine radius - higher similarity means closer to center
          // Default to maxDistance if similarity is missing or too low
          const similarity = node.similarity || 0.3;
          if (simMax === simMin) {
            normSim = 1; 
          } else normSim = Math.max((similarity - simMin) / (simMax - simMin), 0.1); //
            //0-1
          node.normsim = normSim;
          node.distance = minDistance + minDistance / normSim;// * (simMax - similarity)/(simMax - simMin) ;
          node.diameter = Math.max(10 + 20 * normSim, 20);
       
            // Query Node
          if (node.id === 'query') { //(node.id === 'query') {
            node.distance = 0;// * (simMax - similarity)/(simMax - simMin) ;
            node.diameter = 30;
            node.normsim =1;
            return {
              data: { ...node },
              position: { x: 0, y: 0 }
            };
          }
          //console.log("L257 distance ",index, " " , node.distance, "  similarity ",similarity, " normSim ", normSim)
          
          // Place nodes in a circle with angle based on similarity
          const angle = (2 * Math.PI * normSim) / (node.distance - 1);
          return {
            data: { ...node }  ,
            position: {
              x: node.distance * Math.cos(angle),
              y: node.distance * Math.sin(angle)
              
            }
          };
        });
        
        // Add edges with weights based on similarity
        const edges = data.links.map((link) => {
          let normWt = 0;
          
          if (edgeMax === edgeMin) {
            normWt = 1; 
          } else normWt = Math.max((link.weight - edgeMin) / (edgeMax - edgeMin), 0.1); 
            //0-1
          link.normwt = normWt;
          //node.normsim = normSim;

          return {            
          data: { ...link }
          }
        });

        cy.add([...nodes, ...edges]);
        
        // STYLING Apply styles based on properties
        cy.nodes().forEach((node, index) => {
          const similarity = node.data('similarity') || 0;
          const isQuery = (node.data('id') === 'query'); //node.data('id') === 'query';
          //const diameter = node.data('diameter');
          const csscolor = `rgb(0, ${Math.round(55 + node.data('normsim') * 200)}, 0)`;
          const label = node.data('label');
          node.style({
            'background-color': isQuery ? '#F3A73C' : csscolor, //getNodeColorByProperty(similarity, simMin, simMax),
            //'width': diameter,
            //'height': diameter,
            'label': similarity >= 0.99 || isQuery ? label : '',
            //'font-size': '12px',
            //'text-wrap': 'wrap',
            //'text-max-width': '100px',
            'border-width': 0
          });
        });
        // Style edges based on weight
        cy.edges().forEach((edge, index) => {
          const weight = edge.data('normwt') || 0.1;
          const isQueryLink = edge.data('source') === 'query';
          const opacity =  Math.min(1, 0.1 + weight * 0.9);
          const display = (weight > threshold) ? '': 'none';
          const csscolor =  `rgba(100, 100, 100, ${opacity})`;
          
          edge.style({
            'width': 1 + weight * 9,
            'line-color': isQueryLink ? '#F3A73C' : csscolor,
            'opacity': opacity,
            'target-arrow-color': isQueryLink ? '#F3A73C' : csscolor,
            'display' : display 
          });
        });
        //console.log("cy graph ", cy);
        // Apply force-directed layout
        const layout = cy.layout({
          name: 'cose',
          idealEdgeLength: edge => {
            const scale = ((edge.data('weight') - edgeMin) / (edgeMax - edgeMin)); // Assuming similarity is stored in edge data
            const minLength = 30; // Minimum length for high similarity
            const maxLength = 300; // Maximum length for low similarity
            const length = Math.min(maxLength, minLength * scale);
            return length;
          },
          numIter: 1000,
          fit: true,
          zoom: 1,
          padding: 50,
          quality: "default",
          randomize: false,
          nodeRepulsion: 100,
          nodeOverlap: 10,
          edgeElasticity: 0.45,
          gravity: 1, //0.25,
          //gravityRange: 1, //3.8,
          //gravityCompound: 1.0,
          //gravityRangeCompound: 1.5,
          // Animation parameters
          animate: 'end',
          animationDuration: 100,
          refresh: 10
        });
            
        // Remove zoom listener temporarily
        cy.off('zoom');
        
        // After layout completes, reattach zoom listener and apply styles
        layout.one('layoutstop', () => {
          cy.on('zoom', () => updateElementStyles(cy));
          
        });

        layout.run();
        
      });
      nodeCount = data.nodes.length;
      edgeCount = data.links.length;
      graphStatus = `Rendered ${nodeCount} nodes and ${edgeCount} edges`;
      
      console.log("Netork graph updated successfully");
      // Give the layout some time to complete
      setTimeout(() => {
        //updateElementStyles(cy);
        cy.center();
        cy.fit(undefined, 50);
        cy.resize();
      }, 500); // 500ms delay, adjust as needed
      
      updateElementStyles(cy);
          
    } catch (error) {
      console.error("Error updating network graph:", error);
      graphStatus = `Error: ${error.message}`;
    }
  }

  onMount(() => {
    //if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.log("Container width", container.clientWidth);
    //}
    initGraph();
    
    // Add window resize handler
    const handleResize = () => {
      if (cy) {
        cy.resize();
        cy.center();
        cy.fit();
      }
    };
    
    window.addEventListener('resize', handleResize);
    /*
    return () => {
      window.removeEventListener('resize', handleResize);
    };
    */
    
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
