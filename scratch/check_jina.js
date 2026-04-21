import * as fs from 'fs';

async function check() {
  const res = await fetch('https://huggingface.co/api/models/jinaai/jina-embeddings-v5-text-small');
  if (res.ok) {
    const data = await res.json();
    console.log("Siblings (files):", data.siblings ? data.siblings.map(s => s.rfilename).filter(f => f.includes('onnx')) : 'None');
  } else {
    console.log("HTTP", res.status);
  }
}
check();
