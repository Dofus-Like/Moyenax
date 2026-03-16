import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { ResourceMapScene } from '../game/ResourceMap/ResourceMapScene';
import { useNavigate } from 'react-router-dom';
import './ResourceMapPage.css';

export function ResourceMapPage() {
  const navigate = useNavigate();

  return (
    <div className="resource-map-container">
      <header className="resource-map-header">
        <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        <h2>🗺️ Carte des Ressources</h2>
      </header>
      <div className="resource-map-canvas">
        <Canvas>
          <OrthographicCamera makeDefault position={[10, 10, 10]} zoom={30} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <ResourceMapScene />
        </Canvas>
      </div>
    </div>
  );
}
