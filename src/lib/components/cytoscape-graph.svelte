<script>
  import { onMount, onDestroy } from 'svelte';
  import cytoscape from 'cytoscape';
  import { get } from "svelte/store";
  import fcose from 'cytoscape-fcose';

  // Props
  export let initialSearchString = '';
  export let nodeData = [];
  export let onSearch = (searchString) => {};

  let container;
  let cy;
  let currentCentralNode = null;

  // Register the fcose layout algorithm with cytoscape
  onMount(() => {
    cytoscape.use(fcose);
    initCytoscape();
  });
function initCytoscape() {
  cy = cytoscape({
    container,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#6495ED',
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '100px',
          'font-size': '12px',
          'width': function(ele) {
            return ele.data('score') ? 30 + (ele.data('score') * 50) : 30;
          },
          'height': function(ele) {
            return ele.data('score') ? 30 + (ele.data('score') * 50) : 30;
          },
          'border-color': '#000',
          'border-width': 1,
          'text-outline-color': '#fff',
          'text-outline-width': 2
        }
      },
      {
        selector: 'node.central',
        style: {
          'background-color': '#FF7F50',
          'width': 80,
          'height': 80,
          'font-size': '14px',
          'font-weight': 'bold',
          'border-width': 3,
          'border-color': '#B22222'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 'mapData(score, 0, 1, 1, 5)',
          'line-color': '#ccc',
          'opacity': function(ele) {
            return ele.data('score') ? 1 + (ele.data('score') * 4) : 1;
          },
          'curve-style': 'bezier'
        }
      }
    ],
    // Removed layout configuration here
    maxZoom: 2.5,
    minZoom: 0.5,
    wheelSensitivity: 0.2
  });

  // Same double-click handler...
  cy.on('dblclick', 'node', function(evt) {
    const node = evt.target;
    if (!node.hasClass('central')) {
      const newSearchString = node.data('description');
      onSearch(newSearchString);
    }
  });

  // For testing, add a central node
  cy.add({
    data: { id: 'central', label: initialSearchString, description: initialSearchString, score: 1.0 },
    position: { x: 0, y: 0 }
  });
}

function updateGraph() {
  if (!cy) return;
  
  cy.elements().remove();
  
  // Create central node based on search string
  const centralNodeId = 'central-' + Date.now();
  cy.add({
    data: { 
      id: centralNodeId, 
      label: initialSearchString.length > 30 ? initialSearchString.substring(0, 27) + '...' : initialSearchString,
      description: initialSearchString,
      score: 1.0
    }
  });
  
  currentCentralNode = cy.$id(centralNodeId);
  currentCentralNode.addClass('central');
  
  // Add result nodes and edges
  const baseDistance = 200;   // Distance for a node with score = 1. Adjust as needed.
  
  nodeData.forEach((node, i) => {
    // Determine a position in a circle around the center
    const angle = (2 * Math.PI * i) / nodeData.length;
    const radius = 200 * node.score;  // Adjust as needed
    const distance = baseDistance / node.score;  
    const pos = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };

    cy.add({
      data: { 
        id: node.id, 
        label: node.label.length > 20 ? node.label.substring(0, 17) + '...' : node.label,
        description: node.description,
        score: node.score 
      },
      position: pos
    });
        cy.add({
          data: { 
            id: `edge-${centralNodeId}-${node.id}`, 
            source: centralNodeId, 
            target: node.id, 
            score: node.score 
          }
        });
    // Add edge from central node to this node
    /*cy.add({
      data: {
        id: `edge-${centralNodeId}-${node.id}`,
        source: centralNodeId,
        target: node.id,
        score: node.score
      }
    });*/
  });
  
  // Apply layout using the same fcose config as used in updateGraph
  const layoutOptions = {
    name: 'cose',
    animate: 'end',      // Use animate as 'end'
    animationDuration: 1000,
    padding: 30,
    idealEdgeLength: function(edge) {
    const score = edge.data('score') || 1;
    return 200 / score;
    },
    nodeSeparation: 150,
    fixedNodeConstraint: [{ nodeId: centralNodeId, position: { x: 100, y: 100 } }]
  };
  
  const layout = cy.layout(layoutOptions);
  layout.run();
}

  // Function to handle zoom controls
  function zoomIn() {
    cy.zoom(cy.zoom() * 1.2);
    cy.center();
  }

  function zoomOut() {
    cy.zoom(cy.zoom() / 1.2);
    cy.center();
  }

  function resetView() {
    cy.fit();
    cy.center();
  }
  
  // Call updateGraph whenever nodeData or initialSearchString changes and cy exists
  $: if (cy && nodeData && initialSearchString) {
      updateGraph();
  }
</script>

<div class="cytoscape-container">
  <div class="cy-controls">
    <button on:click={zoomIn}>+</button>
    <button on:click={zoomOut}>-</button>
    <button on:click={resetView}>Reset</button>
  </div>
  <div bind:this={container} class="cy-container"></div>
</div>

<style>
  .cytoscape-container {
    position: relative;
    width: 100%;
    height: 600px;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .cy-container {
    width: 100%;
    height: 100%;
  }
  
  .cy-controls {
    position: absolute;
    bottom: 10px;
    right: 10px;
    z-index: 10;
    display: flex;
    gap: 5px;
  }
  
  .cy-controls button {
    width: 30px;
    height: 30px;
    border-radius: 4px;
    border: 1px solid #ccc;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
  
  .cy-controls button:hover {
    background: #f0f0f0;
  }
</style>
