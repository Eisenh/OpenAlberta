/**
 * Utility functions for exporting network data to formats compatible with Cytoscape desktop
 */

/**
 * @typedef {Object} ExportOptions
 * @property {string} [filename]
 * @property {string} [sourceField]
 * @property {string} [targetField]
 * @property {string} [weightField]
 * @property {string} [idField]
 */

/**
 * Export network data to Cytoscape JSON format
 * @param {Object} networkData
 * @param {ExportOptions} [options]
 * @returns {Object|void}
 */
export function exportNetworkToCytoscape(networkData, options = {}) {
  const {
    filename = 'network_export.cyjs',
    sourceField = 'source',
    targetField = 'target',
    weightField = 'weight',
    idField = 'id'
  } = options;

  if (!networkData?.nodes || !networkData?.links) {
    console.error('Invalid network data');
    return;
  }

  const exportData = {
    elements: {
      nodes: [],
      edges: []
    }
  };

  networkData.nodes.forEach(node => {
    if (node[idField] === undefined) {
      console.warn('Node missing ID:', node);
      return;
    }
    exportData.elements.nodes.push({ data: { ...node } });
  });

  networkData.links.forEach((link, index) => {
    const source = link[sourceField];
    const target = link[targetField];
    
    if (source === undefined || target === undefined) {
      console.warn('Link missing source/target:', link);
      return;
    }

    const edgeData = {
      ...link,
      id: link.id || `e${index}`,
      source,
      target
    };

    exportData.elements.edges.push({ data: edgeData });
  });

  return exportData;
}

/**
 * @typedef {Object} SIFOptions
 * @property {string} [filename]
 * @property {string} [interactionType]
 * @property {string} [sourceField]
 * @property {string} [targetField]
 */

/**
 * Export network data to SIF format
 * @param {Object} networkData
 * @param {SIFOptions} [options]
 */
export function exportNetworkToSIF(networkData, options = {}) {
  const {
    filename = 'network_export.sif',
    interactionType = 'similarity',
    sourceField = 'source',
    targetField = 'target'
  } = options;

  if (!networkData?.nodes || !networkData?.links) {
    console.error('Invalid network data');
    return;
  }

  let sifContent = '';
  
  networkData.links.forEach(link => {
    const source = link[sourceField];
    const target = link[targetField];
    
    if (source && target) {
      sifContent += `${source} ${interactionType} ${target}\n`;
    }
  });

  const blob = new Blob([sifContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.download = filename;
  a.href = url;
  a.click();
  
  URL.revokeObjectURL(url);
}