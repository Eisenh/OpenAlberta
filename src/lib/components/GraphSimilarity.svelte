<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount, onDestroy } from "svelte";
  import cytoscape from "cytoscape";
  import { get } from "svelte/store";
  import fcose from "cytoscape-fcose";
  import cola from "cytoscape-cola";
  import { displaySimilarityThreshold } from "../stores/graphSettings.js";
  import { calculateSimilarityMatrix } from "../utils/similarity.js";
  import {jLouvain } from '../utils/louvain';
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
  let tooltipHideTimeout = null;
  let activeElementId = null;  // Tracks the ID of the element (node or edge) currently being hovered
  let activeElementType = null;  // 'node' or 'edge'
  const tooltipHideDelay = 200; // ms before hiding tooltip
  // Debugging variables
  let graphStatus = "Initializing";
  let nodeCount = 0;
  let edgeCount = 0;
  let edgeMin, edgeMax, edgeMid = 0;
  let simMin, simMax = 0;
  let zoom = 1;
  
  // Watch for changes in graphData
  $: if (cy && data) {
    //const data = get(graphData);
    console.log("Network graph component reactive statement triggered with data:", data);
    edgeMax = Math.max(...data.links.map(obj => obj.weight));
    edgeMin = Math.min(...data.links.map(obj => obj.weight));
    edgeMid = (edgeMax + edgeMin)/2;
    //displaySimilarityThreshold.set(edgeMid);
    simMax = Math.max(...data.nodes.slice(1).map(obj => obj.similarity));
    simMin = Math.min(...data.nodes.map(obj => obj.similarity));
    initGraph()
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
      const weight = Math.max(link.data('weight') , 0);
      let baseWeight = 3 * (weight - edgeMin) + 1;
      const display = weight < threshold ? 'none' : '';
      
      link.style({
        'width': baseWeight * scaleFactor,
        'display': display
      });
    });
  }
  
  function getClusterColor(clusterId, colorMap = {}) {
    const baseColors = [
      '#1f77b4', // blue
      '#d62728', // red
      '#9467bd', // purple
      '#8c564b', // brown
      '#2ca02c', // green
      '#e377c2', // pink
      '#7f7f7f', // gray
      '#bcbd22', // olive
      '#17becf'  // cyan
    ];

    if (colorMap[clusterId]) {
      return colorMap[clusterId];
    }

    const baseColorIndex = clusterId % baseColors.length;
    let color = baseColors[baseColorIndex];

    // If there are more clusters than base colors, generate a shade
    if (clusterId >= baseColors.length) {
      color = adjustColorBrightness(color, (clusterId / baseColors.length) * 0.8); // Adjust brightness
    }

    colorMap[clusterId] = color;
    return color;
  }


  function adjustColorBrightness(hex, factor) {
    let color = hex.replace(/^#/, '');
    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);

    r = Math.round(r * factor);
    g = Math.round(g * factor);
    b = Math.round(b * factor);

    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function showTooltip(node, originalEvent, HTML_Text) {
    const tooltip = document.getElementById("graph-tooltip");
    const containerRect = container.getBoundingClientRect();
    console.log("Tooltip ", originalEvent);
    // Calculate position relative to the container
    const x = originalEvent.clientX - containerRect.left + 10;
    const y = originalEvent.clientY - containerRect.top + 10;

    setTimeout(() => {
      // Format similarity with 2 decimal places if available
      //const simText = similarity ? similarity.toFixed(2) + " - " : "";
      tooltip.innerHTML = HTML_Text;
      tooltip.style.display = "block";
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      
    }, 50);
  }

  function handleElementMouseOut(event) {
    const element = event.target;
    
    // If it's a node, remove the hover class
    if (element.isNode()) {
      element.removeClass('hover');
    }
    
    // If this is the active element being tracked, clear the tracking
    if (element.id() === activeElementId) {
      activeElementId = null;
      activeElementType = null;
    }
    
    // Set a timeout to hide the tooltip after a delay
    if (tooltipHideTimeout) {
      clearTimeout(tooltipHideTimeout);
    }
    
    tooltipHideTimeout = setTimeout(() => {
      // Only hide if we're not currently over another element
      if (!activeElementId) {
        document.getElementById("graph-tooltip").style.display = "none";
      }
    }, tooltipHideDelay);
  }
  // Initialize Cytoscape
  function initGraph() {
    if (!container) {
      console.error("Graph container element not found");
      graphStatus = "Error: Container not found";
      return;
    }
    
    if (!data) {
      console.error("Data  not found");
      graphStatus = "Error: Data not passed ";
      return;
    }
//    console.log("Initializing Similarity Cytoscape graph");
    
    cytoscape.use(cola);
    cy = cytoscape({
      container: container,
      userPanningEnabled: true,
      userZoomingEnabled: true,
     // wheelSensitivity: 0.3
      //zoom: 1,  // Set initial zoom
      pan: { x: 0, y: 0 },  // Center the graph
      //fit: true  // Adjust the viewport to fit all nodes
    });

    // Track zoom level
    cy.on('zoom', () => {

      zoom = cy.zoom();
      updateElementStyles(cy);
    });
    
  // Subscribe to the displaySimilarityThreshold store
    displaySimilarityThreshold.subscribe(value => {
      threshold = value;
      if (cy) {
        updateElementStyles(cy);
      }
    });
    // Apply expanded style
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
          'label': '', //'data(label)',
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
    //updateElementStyles(cy);
 

  // Handle hover event to show tooltip
  cy.on("mouseover", "node", (event) => {
    const node = event.target;
    node.addClass('hover');
    const similarity = node.data('similarity') || 0;
      
    // Update tracking variables
    activeElementId = node.id();
    activeElementType = 'node';
    
    // Clear any existing hide timeout
    if (tooltipHideTimeout) {
      clearTimeout(tooltipHideTimeout);
      tooltipHideTimeout = null;
    }
    // Show tooltip
    const showText = "<b>" +  node.data('label') + "</b> <p>" +(node.data('description') ) + "</p>";
    showTooltip(node, event.originalEvent, showText);
    
  });

    cy.on("mouseover", "edge", (event) => {
      const edge = event.target;
      //node.addClass('hover-');
      const similarity = edge.data('weight') || 0;
      console.log("mouseover edge ", event, " similarity ", similarity);
       // Update tracking variables
      activeElementId = edge.id();
      activeElementType = 'edge';   
       
      // Clear any existing hide timeout
      if (tooltipHideTimeout) {
        clearTimeout(tooltipHideTimeout);
        tooltipHideTimeout = null;
      }
      
      // Show tooltip
      
      const simText = "Similarity: " + (similarity ? similarity.toFixed(2) : "unknown");
      showTooltip(edge, event.originalEvent, simText);
        
    });
   
      
    // Apply the common handler to both nodes and edges
    cy.on("mouseout", "node", handleElementMouseOut);
    cy.on("mouseout", "edge", handleElementMouseOut);
/*
    // Hide tooltip on mouseout - keep this as a backup but don't rely on it
    cy.on("mouseout", "node", (event) => {
      const node = event.target;
      node.removeClass('hover');

      
      if (node.id() === mouseOverNodeId) {
        mouseOverNodeId = null;
      }

      // Set a timeout to hide the tooltip after a delay
      // This makes it less sensitive to actually capturing a mouse off event
      if (tooltipHideTimeout) {
        clearTimeout(tooltipHideTimeout);
      }
      
      tooltipHideTimeout = setTimeout(() => {
        // Only hide if we're not currently over another node
        if (!mouseOverNodeId) {
          document.getElementById("graph-tooltip").style.display = "none";
        }
      }, tooltipHideDelay);
    });

    cy.on("mouseout", "edge", (event) => {
      const node = event.target;

    });
*/
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
/*
    graphStatus = "Graph initialized, waiting for data";
    //updateGraph();
    edgeMax = Math.max(...data.links.map(obj => obj.weight));
    edgeMin = Math.min(...data.links.map(obj => obj.weight));
    edgeMid = (edgeMax + edgeMin)/2;
    //displaySimilarityThreshold.set(edgeMid);
    simMax = Math.max(...data.nodes.slice(1).map(obj => obj.similarity));
    simMin = Math.min(...data.nodes.map(obj => obj.similarity));
    updateGraph(data);
    */
    console.log("initGraph: ", data);
  }

  function updateGraph(data) {
    if (!cy || !data?.nodes) {
      console.error("Cannot update graph: missing Cytoscape instance or invalid data");
      return;
    }

//    console.log("Received graph data in network view:", data);

    try {
      cy.batch(() => {
        // Remove existing elements
        cy.elements().remove();

        const minDistance = 5;  // Minimum distance from center
        const maxDistance = 100; // Maximum distance from center
        const threshold = get(displaySimilarityThreshold);
              
        let constraints = [];
        let clusterNodes = {};
        //let clusterColors = ["blue", "red", "yellow", "magenta"];
        let clusterColors = {}; // Create color map object
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
          node.ind = index;
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
//        console.log(" Data ", " nodes ", nodes.length, " edges", edges.length)

        let nodeIdsForLouvain = [];
        nodeIdsForLouvain = nodes.map((node) => {
          return node.data.id;  //returs nodeIds
        });
//        console.log("Nodes for jLouvain ", nodeIdsForLouvain);

        let edgesForLouvain = [];
        // Now create the edges with error checking
       
        edgesForLouvain = edges.map(link => {
           //console.log("Link ",link);
          return {
            source: link.data.source,
            target: link.data.target,
            weight: link.data.normwt || 0
          };
        });
 //       console.log("Edges for jLouvain ", edgesForLouvain);
                /*
                */
        // Define minimum modularity improvement threshold
        const MIN_MODULARITY_IMPROVEMENT = 0.00001; //001; //00001;
                
        // Run jLouvain algorithm
        const communityAssignments = jLouvain(nodeIdsForLouvain, edgesForLouvain, MIN_MODULARITY_IMPROVEMENT);

        // Add cluster information to node data before creating Cytoscape elements
        nodes.forEach(nodeObj => {
          const nodeId = nodeObj.data.id;
          nodeObj.data.cluster = communityAssignments[nodeId];
        });

        // Create the graph object
        cy.add([...nodes, ...edges]);
        /*  markov clustering stuff
        // markov clustering creates an array of collections, each with node elements
        let clusters = cy.elements().markovClustering({
          attributes: [
            function( edge ){ return edge.data('weight'); }
          ]
        });
        //console.log("Clusters: ", clusters);

        // Store cluster assignments in each node data
        clusters.forEach((cluster, clusterId) => {
          console.log("Storing cluster ",clusterId," in nodes");
          cluster.forEach(node => {
            const nodeId = node.id(); 
            cy.getElementById(nodeId  ).data('cluster', clusterId);
            console.log(" clusterId ", clusterId, " stored in ", nodeId);
          });
        });
        */
        // STYLING Apply styles based on properties
        cy.nodes().forEach((node, index) => {

          const cluster = node.data('cluster');
          if (!clusterNodes[cluster]) {
            clusterNodes[cluster] = [];
          }
          clusterNodes[cluster].push(node.data('id'));

          //node.style('background-color', clusterColors[cluster]);

          const similarity = node.data('similarity') || 0;
          const isQuery = (node.data('id') === 'query'); //node.data('id') === 'query';
          //const diameter = node.data('diameter');
//          console.log(" node.data('cluster') ", node.data('cluster'))
          const csscolor = getClusterColor(cluster, clusterColors);//clusterColors[node.data('cluster')]; //`rgb(0, ${Math.round(55 + node.data('normsim') * 200)}, 0)`;
          const label = node.data('label');
          node.style({
            'background-color': isQuery ? '#F3A73C' : csscolor, 
            //color: 'rgba(255, 255, 255, 0.5)', // Half-transparent white for query node
            //'width': diameter,rgba(255, 255, 255, 0.5)
            //'height': diameter,
            'label': similarity >= 0.99 || isQuery ? label : '',
            //'font-size': '12px',
            'text-wrap': 'wrap', // Enable text wrapping
            'text-max-width': '40em', // Set maximum width for text wrapping
            'border-width': 0,
            'text-background-color': 'white',
            'z-index': 50,
            'text-background-opacity': .7
          });
        });
        // Style edges based on weight
        cy.edges().forEach((edge, index) => {
          const weight = edge.data('normwt') || 0.1;
          const isQueryLink = edge.data('source') === 'query';
          const opacity =  Math.min(1, 0.1 + weight * 0.9);
          const display = (weight > threshold) ? '': 'none';
          const csscolor =  `rgba(100, 100, 100, ${opacity})`;
                  
          const sourceNode = cy.getElementById(edge.data('source'));
          const targetNode = cy.getElementById(edge.data('target'));
          const sourceCluster = sourceNode.data('cluster');
          const targetCluster = targetNode.data('cluster');
          const sourceColor = getClusterColor(sourceCluster, clusterColors);
          const targetColor = getClusterColor(targetCluster, clusterColors);
          if (isQueryLink) {
            edge.style({
              'line-color': '#F3A73C' ,
              'target-arrow-color': '#F3A73C',
              'line-gradient-stop-colors': null // Remove any gradient
            });
 //           console.log("L471 edge formating ",sourceCluster, targetCluster, sourceColor );
          } else if (sourceCluster === targetCluster ) {
            // Intra-cluster edge - use the cluster color            
//            console.log("L471 edge formating ",sourceCluster, targetCluster, sourceColor );
            edge.style({
              'line-color': sourceColor,
              'target-arrow-color': sourceColor,
              'line-gradient-stop-colors': null // Remove any gradient
            });
          } else {
            // Inter-cluster edge - use gradient
            
//            console.log("L471 edge formating ",sourceCluster, targetCluster, sourceColor );
            edge.style({
              'line-gradient-stop-colors': [sourceColor, targetColor],
              'line-gradient-stop-positions': [0, 100],
              'curve-style': 'bezier', // Required for gradients
              'target-arrow-color': targetColor
            });
          }
          edge.style({
            //'width': 1 + weight * 5,
            //'line-color': isQueryLink ? '#F3A73C' : csscolor,
            'opacity': opacity,
            //'target-arrow-color': isQueryLink ? '#F3A73C' : csscolor,
            'display' : display 
          });
        });

        /*
        for (const cluster in clusterNodes) {
          constraints.push({
            type: 'boundingBox',
            boundingBox: {
              x1: 0,
              y1: 0,
              x2: 1,
              y2: 1
            },
            nodes: clusterNodes[cluster]
          });
        }

        */
        // Apply force-directed layout
        updateElementStyles(cy);
        const layout = cy.layout({
          name: 'cose',
          //constraints: constraints,
          idealEdgeLength: edge => {
            const scale = ((edge.data('weight') - edgeMin) / (edgeMax - edgeMin)); // Assuming similarity is stored in edge data
            const minLength = 30; // Minimum length for high similarity
            const maxLength = 300; // Maximum length for low similarity
            const length = Math.min(maxLength, minLength * scale);
            return length;
          },
          numIter: 2000,
          //zoom: 1,
          padding: 50,
          quality: "default",
          randomize: true,
          nodeRepulsion: 200,
          nodeOverlap: 20,
          edgeElasticity: 0.45,
          gravity: .25, //0.25,
          // Gravity range (constant)
          gravityRange: 3.8,
          // Nesting factor (multiplier) to compact components
          nestingFactor: 0.1,
          // Align components to avoid overlapping
          tile: true,
          // Whether to fit the network view after layout
          fit: true, // Adjust the viewport to fit all nodes
          // Padding on fit
          padding: 30,
          // Animation parameters
          animate: true,
          //animate: 'end',
          animationDuration: 1000,
          // Number of iterations
          numIter: 500
          //refresh: 10
        });
            
        // Remove zoom listener temporarily
        //cy.off('zoom');
        
        // After layout completes, reattach zoom listener and apply styles
        layout.on('layoutstop', () => {
          
        cy.center();
        cy.fit(undefined, 50);
          //updateElementStyles(cy);
        });
        
        
        layout.run();
        //cy.center();
        //cy.fit(undefined, 50);
      });
      nodeCount = data.nodes.length;
      edgeCount = data.links.length;
      graphStatus = `Rendered ${nodeCount} nodes and ${edgeCount} edges`;
      
      console.log("Netork graph updated successfully");
      // Give the layout some time to complete
      setTimeout(() => { 
        cy.resize();  
      }, 900); // 500ms delay, adjust as needed
      
     
          
    } catch (error) {
      console.error("Error updating network graph:", error);
      graphStatus = `Error: ${error.message}`;
    }
  }

  onMount(() => {
    //if (container.clientWidth === 0 || container.clientHeight === 0) {
 //     console.log("Container width", container.clientWidth);
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
<div id="graph-tooltip" class="graph-tooltip"></div>

<!-- Debug Overlay -->
{#if false && import.meta.env.DEV}
  <div class="graph-debug-overlay">
    <span>Status: {graphStatus}   Zoom {zoom}</span>
    <span>Nodes: {nodeCount} | Edges: {edgeCount}</span>
    <span>sinMin {simMin}, max {simMax}, edgeMin {edgeMin}, edgeMax {edgeMax}</span>
  </div>
{/if} 

<style>
  .graph-wrapper {
    width: 100%;
    height: 100%; /* clamp(400px, 60vh, 700px); /* Match Graph.svelte's responsive height */
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-md);
    position: relative;
    margin-bottom: 1rem; /* Add matching bottom margin */
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
