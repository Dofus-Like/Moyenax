import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';
import { JSDOM } from 'jsdom';

// Minimal mock for browser globals to let GLTFLoader run in node
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.self = dom.window.self;
global.HTMLElement = dom.window.HTMLElement;

async function listNodes() {
  const loader = new GLTFLoader();
  const fileData = fs.readFileSync('apps/web/public/assets/models/bushes.glb');
  const arrayBuffer = fileData.buffer;

  loader.parse(
    arrayBuffer,
    '',
    (gltf) => {
      console.log('Nodes in GLB:');
      gltf.scene.traverse((node) => {
        if (node.isMesh) {
          console.log(
            `- Mesh: ${node.name} (Position: ${node.position.x}, ${node.position.y}, ${node.position.z})`,
          );
        } else {
          console.log(`- Group/Object3D: ${node.name}`);
        }
      });
    },
    (err) => console.error(err),
  );
}

listNodes();
