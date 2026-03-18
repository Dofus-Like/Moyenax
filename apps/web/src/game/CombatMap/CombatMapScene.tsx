import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text, Float } from '@react-three/drei';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { TerrainType, CombatActionType, findPath, GameMap } from '@game/shared-types';
import { combatApi } from '../../api/combat.api';
import { canMoveTo, canJumpTo, isInRange, hasLineOfSight } from '@game/game-engine';
import { getPlayerColors, PlayerColors } from '../utils/playerColors';

function CombatTile({ position, type, isReachable, previewColor, isTarget, onClick, onHover }: {
  position: [number, number, number];
  type: TerrainType;
  isReachable: boolean; // Renamed logic to isPath
  previewColor?: string | null;
  isTarget: boolean;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Couleurs plus vives pour le test
  let color = '#3f3f46'; // GROUND
  if (type === TerrainType.WATER) color = '#3b82f6';
  else if ([TerrainType.IRON_ORE, TerrainType.GOLD_ORE, TerrainType.WOOD, TerrainType.CRYSTAL].includes(type)) {
    color = '#78350f'; // Obstacle
  } else if ([TerrainType.HERB, TerrainType.LEATHER].includes(type)) {
    color = '#16a34a'; // Ressource
  }

  const highlightColor = previewColor || (isTarget ? '#ef4444' : null);
  const finalColor = hovered && highlightColor ? highlightColor : (hovered ? '#52525b' : color);

  return (
    <mesh
      position={position}
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(true);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(false);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <boxGeometry args={[0.98, type === TerrainType.GROUND ? 0.1 : 0.4, 0.98]} />
      <meshStandardMaterial
        color={finalColor}
        transparent={type === TerrainType.GROUND}
        opacity={type === TerrainType.GROUND ? 0.6 : 1}
      />
      {highlightColor && (
          <mesh position={[0, type === TerrainType.GROUND ? 0.06 : 0.21, 0]}>
              <boxGeometry args={[0.8, 0.02, 0.8]} />
              <meshStandardMaterial color={highlightColor} emissive={highlightColor} emissiveIntensity={0.5} />
          </mesh>
      )}
    </mesh>
  );
}

function PlayerMesh({ gridPosition, colors, isCurrent, name, path, onPathComplete }: {
  gridPosition: { x: number, y: number };
  colors: PlayerColors;
  isCurrent: boolean;
  name: string;
  path: { x: number, y: number }[] | null;
  onPathComplete: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [currentPath, setCurrentPath] = useState<{ x: number, y: number }[]>([]);
  const [pathIndex, setPathIndex] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const progressRef = useRef(0);

  const fromRef = useRef(new THREE.Vector3(gridPosition.x, 0.5, gridPosition.y));
  const toRef = useRef(new THREE.Vector3(gridPosition.x, 0.5, gridPosition.y));

  useEffect(() => {
    if (path && path.length > 0) {
      setCurrentPath(path);
      setPathIndex(0);
      setIsMoving(true);
      progressRef.current = 0;
      fromRef.current.set(groupRef.current?.position.x ?? gridPosition.x, 0.5, groupRef.current?.position.z ?? gridPosition.y);
      toRef.current.set(path[0].x, 0.5, path[0].y);
    }
  }, [path]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (isMoving && currentPath.length > 0) {
        progressRef.current += delta * 4; // Move speed
        const t = Math.min(progressRef.current, 1);

        const pos = new THREE.Vector3().lerpVectors(fromRef.current, toRef.current, t);
        const bounce = Math.abs(Math.sin(t * Math.PI)) * 0.2;

        groupRef.current.position.set(pos.x, 0.5 + bounce, pos.z);

        // Face movement
        const angle = Math.atan2(toRef.current.x - fromRef.current.x, toRef.current.z - fromRef.current.z);
        groupRef.current.rotation.y += (angle - groupRef.current.rotation.y) * 0.2;

        if (t >= 1) {
            if (pathIndex + 1 < currentPath.length) {
                fromRef.current.copy(toRef.current);
                const next = currentPath[pathIndex + 1];
                toRef.current.set(next.x, 0.5, next.y);
                setPathIndex(prev => prev + 1);
                progressRef.current = 0;
            } else {
                setIsMoving(false);
                setCurrentPath([]);
                onPathComplete();
            }
        }
    } else {
        // Idle
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, gridPosition.x, 0.1);
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, gridPosition.y, 0.1);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <capsuleGeometry args={[0.3, 0.8, 4, 16]} />
        <meshStandardMaterial
          color={colors.primary}
          emissive={colors.emissive}
          emissiveIntensity={0.2}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>

      <mesh position={[0, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial
          color={colors.secondary}
          emissive={colors.emissive}
          emissiveIntensity={0.2}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>

      <Text
        position={[0, 1.5, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {name}
      </Text>

      {isCurrent && (
          <mesh position={[0, 1.8, 0]}>
              <coneGeometry args={[0.1, 0.2, 4]} />
              <meshStandardMaterial color="#facc15" emissive="#facc15" />
          </mesh>
      )}
    </group>
  );
}

function ParticleTrail({ position, color, count = 20, spread = 0.5 }: {
  position: THREE.Vector3;
  color: string;
  count?: number;
  spread?: number;
}) {
  const particlesRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    return arr;
  }, [count, spread]);

  useFrame(() => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y += 0.02;
    }
  });

  return (
    <points ref={particlesRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color={color}
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

function SpellVFX({ type, from, to, onComplete }: {
    type: string;
    from: {x: number, y: number};
    to: {x: number, y: number};
    onComplete: () => void;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const startPos = new THREE.Vector3(from.x, 1, from.y);
    const endPos = new THREE.Vector3(to.x, 1, to.y);
    const [progress, setProgress] = useState(0);

    useFrame((_, delta) => {
        if (progress >= 1) {
            onComplete();
            return;
        }
        setProgress(p => Math.min(p + delta * 2.5, 1));
        if (meshRef.current) {
            meshRef.current.position.lerpVectors(startPos, endPos, progress);
            if (type === 'Épée' || type === 'spell-frappe') {
                meshRef.current.rotation.z = progress * Math.PI * 2;
            }
        }
    });

    if (type === 'Boule de Feu' || type === 'spell-fireball') {
        return (
            <group>
                <mesh ref={meshRef}>
                    <sphereGeometry args={[0.3, 16, 16]} />
                    <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={2} />
                    <pointLight color="#f97316" intensity={2} distance={3} />
                </mesh>
                {meshRef.current && (
                    <ParticleTrail
                        position={meshRef.current.position}
                        color="#f97316"
                        count={30}
                        spread={0.6}
                    />
                )}
            </group>
        );
    }

    if (type === 'spell-heal') {
        return (
            <group>
                <mesh ref={meshRef}>
                    <sphereGeometry args={[0.25, 16, 16]} />
                    <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={2} transparent opacity={0.7} />
                    <pointLight color="#22c55e" intensity={1.5} distance={2} />
                </mesh>
                {meshRef.current && (
                    <ParticleTrail
                        position={meshRef.current.position}
                        color="#86efac"
                        count={40}
                        spread={0.8}
                    />
                )}
            </group>
        );
    }

    return (
        <group>
            <mesh ref={meshRef}>
                <boxGeometry args={[0.1, 0.8, 0.2]} />
                <meshStandardMaterial color="#e2e8f0" emissive="#94a3b8" />
            </mesh>
            {meshRef.current && (
                <ParticleTrail
                    position={meshRef.current.position}
                    color="#cbd5e1"
                    count={15}
                    spread={0.3}
                />
            )}
        </group>
    );
}

function DamagePopup({ position, value, onComplete }: {
  position: [number, number, number],
  value: number,
  onComplete: () => void
}) {
  const [opacity, setOpacity] = useState(1);
  const [yOffset, setYOffset] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = elapsed / duration;

      if (progress >= 1) {
        clearInterval(interval);
        onComplete();
      } else {
        setOpacity(1 - progress);
        setYOffset(progress * 1);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <Text
      position={[position[0], position[1] + 1.5 + yOffset, position[2]]}
      fontSize={0.5}
      color="#ef4444"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.04}
      outlineColor="black"
    >
      {value}
      <meshStandardMaterial opacity={opacity} transparent />
    </Text>
  );
}

function PathPreview({ path }: { path?: {x: number, y: number}[] | null }) {
    if (!path || path.length === 0) return null;
    return (
        <group>
            {path.map((p, i) => (
                <mesh key={`path-${i}`} position={[p.x, 0.05, p.y]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[i === path.length - 1 ? 0.25 : 0.1, 12]} />
                    <meshStandardMaterial
                        color={i === path.length - 1 ? "#22c55e" : "#6366f1"}
                        transparent
                        opacity={0.8}
                        emissive={i === path.length - 1 ? "#22c55e" : "#6366f1"}
                        emissiveIntensity={0.5}
                    />
                </mesh>
            ))}
        </group>
    );
}

export function CombatMapScene({ sessionId }: { sessionId: string }) {
  const { connectToSession, disconnect, combatState, sseConnection, setCombatState } = useCombatStore();
  const [popups, setPopups] = useState<{ id: string, pos: [number, number, number], val: number }[]>([]);
  const [vfx, setVfx] = useState<{ id: string, type: string, from: {x: number, y: number}, to: {x: number, y: number} }[]>([]);
  const [playerPaths, setPlayerPaths] = useState<Record<string, {x: number, y: number}[]>>({});
  const lastPlayerPositions = useRef<Record<string, {x: number, y: number}>>({});

  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);

  const selectedSpellId = useCombatStore((s) => s.selectedSpellId);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);

  const user = useAuthStore((s) => s.player);
  const currentPlayer = combatState && user ? combatState.players[user.id] : null;
  const isMyTurn = combatState?.currentTurnPlayerId === user?.id;

  useEffect(() => {
    if (!sseConnection) return;

    const damageHandler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        const player = combatState?.players[data.targetId];
        if (player) {
            setPopups(prev => [
                ...prev,
                {
                    id: Math.random().toString(),
                    pos: [player.position.x, 0.5, player.position.y],
                    val: data.damage
                }
            ]);
        }
    };

    sseConnection.addEventListener('DAMAGE_DEALT', damageHandler);
    return () => sseConnection.removeEventListener('DAMAGE_DEALT', damageHandler);
  }, [sseConnection, combatState]);

  useEffect(() => {
    console.log('CombatMapScene: Connecting to session:', sessionId);
    if (sessionId) {
      connectToSession(sessionId);
    }

    return () => {
      console.log('CombatMapScene: Disconnecting');
      disconnect();
    };
  }, [sessionId, connectToSession, disconnect]);

  const occupiedPositions = useMemo(() =>
    combatState ? Object.values(combatState.players).map(p => p.position) : []
  , [combatState]);

  const gameMap = useMemo(() => {
    if (!combatState?.map?.tiles) return null;
    const grid = Array(combatState.map.height).fill(0).map(() => Array(combatState.map.width).fill(TerrainType.GROUND));
    combatState.map.tiles.forEach(t => {
        if (grid[t.y] && grid[t.y][t.x] !== undefined) {
            grid[t.y][t.x] = t.type;
        }
    });
    return { width: combatState.map.width, height: combatState.map.height, grid } as GameMap;
  }, [combatState?.map]);

  useEffect(() => {
    if (!combatState || !gameMap) return;

    Object.values(combatState.players).forEach(p => {
        const last = lastPlayerPositions.current[p.playerId];
        if (last && (last.x !== p.position.x || last.y !== p.position.y)) {
            // Find path for animation
            const path = findPath(gameMap, last, p.position);
            if (path) {
                setPlayerPaths(prev => ({ ...prev, [p.playerId]: path }));
            }
        }
        lastPlayerPositions.current[p.playerId] = { ...p.position };
    });
  }, [combatState, gameMap]);

  const reachableTiles = useMemo(() => {
    if (!isMyTurn || !currentPlayer || !gameMap || !combatState) return [];

    // BFS to find all tiles reachable within remainingPm
    const reachable: { x: number, y: number, dist: number }[] = [];
    const queue: { x: number, y: number, dist: number }[] = [{ ...currentPlayer.position, dist: 0 }];
    const visited = new Set<string>();
    visited.add(`${currentPlayer.position.x},${currentPlayer.position.y}`);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.dist > 0) reachable.push(current);

        if (current.dist < currentPlayer.remainingPm) {
            for (const dir of [{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:-1,y:0}]) {
                const next = { x: current.x + dir.x, y: current.y + dir.y };
                const key = `${next.x},${next.y}`;
                const tile = combatState.map.tiles.find(t => t.x === next.x && t.y === next.y);
                const isOccupied = occupiedPositions.some(p => p.x === next.x && p.y === next.y);

                if (next.x >= 0 && next.x < gameMap.width && next.y >= 0 && next.y < gameMap.height &&
                    !visited.has(key) && tile && tile.type === TerrainType.GROUND && !isOccupied) {
                    visited.add(key);
                    queue.push({ ...next, dist: current.dist + 1 });
                }
            }
        }
    }
    return reachable;
  }, [isMyTurn, currentPlayer?.position, currentPlayer?.remainingPm, gameMap, occupiedPositions, combatState?.map?.tiles]);

  const previewPath = useMemo(() => {
     if (!isMyTurn || !currentPlayer || !hoveredTile || !gameMap || selectedSpellId) return [];

     // Find reachable tile closest to mouse
     let closest: {x: number, y: number} | null = null;
     let minDist = Infinity;

     for (const t of reachableTiles) {
         const d = Math.abs(t.x - hoveredTile.x) + Math.abs(t.y - hoveredTile.y);
         if (d < minDist) {
             minDist = d;
             closest = t;
         }
     }

     if (!closest) return [];

     // Final path is guaranteed to be within PM
     return findPath(gameMap, currentPlayer.position, closest) ?? [];
  }, [isMyTurn, currentPlayer, hoveredTile, gameMap, selectedSpellId, reachableTiles]);

  const handleTileClick = async (x: number, y: number) => {
    if (!sessionId || !isMyTurn || !currentPlayer) {
        console.log('CombatMapScene: Click ignored', { sessionId, isMyTurn, hasPlayer: !!currentPlayer });
        return;
    }

    try {
        let res;
        if (selectedSpellId) {
            console.log('CombatMapScene: Casting spell', selectedSpellId, 'at', { x, y });

            // Trigger local VFX
            if (currentPlayer) {
                setVfx(prev => [...prev, {
                    id: Math.random().toString(),
                    type: selectedSpellId,
                    from: currentPlayer.position,
                    to: { x, y }
                }]);
            }

            res = await combatApi.playAction(sessionId, {
                type: CombatActionType.CAST_SPELL,
                spellId: selectedSpellId,
                targetX: x,
                targetY: y
            });
            setSelectedSpell(null);
        } else {
            const target = { x, y };
            console.log('CombatMapScene: Moving to', target);
            if (canMoveTo(target, currentPlayer.remainingPm, currentPlayer.position, combatState!.map.tiles, occupiedPositions)) {
                res = await combatApi.playAction(sessionId, {
                    type: CombatActionType.MOVE,
                    targetX: x,
                    targetY: y
                });
            } else if (canJumpTo(target, currentPlayer.remainingPm, currentPlayer.position, combatState!.map.tiles, occupiedPositions)) {
                res = await combatApi.playAction(sessionId, {
                    type: CombatActionType.JUMP,
                    targetX: x,
                    targetY: y
                });
            } else {
                console.warn('CombatMapScene: Position unreachable');
            }
        }

        if (res?.data) {
            setCombatState(res.data);
        }
    } catch (err: any) {
        console.error('CombatAction Error:', err);
        // On ne met pas d'alert ici pour ne pas bloquer le jeu 3D, mais on logge
    }
  };

  if (!combatState) {
    return null;
  }

  return (
    <group>
      <color attach="background" args={['#3f3f46']} />
      <gridHelper
        args={[combatState.map.width, combatState.map.width, '#ffffff', '#888888']}
        position={[combatState.map.width / 2 - 0.5, -0.01, combatState.map.height / 2 - 0.5]}
      />

      {combatState.map.tiles.map((tile) => {
        let isReachable = false;
        let isTarget = false;
        let previewColor: string | null = null;

        if (isMyTurn && currentPlayer) {
            if (selectedSpellId) {
                const spell = currentPlayer.spells.find(s => s.id === selectedSpellId);
                if (spell) {
                    isTarget = isInRange(currentPlayer.position, tile, spell.minRange, spell.maxRange)
                               && (spell.id === 'spell-bond' || hasLineOfSight(currentPlayer.position, tile, combatState.map.tiles));
                }
            } else {
                // Find tile in previewPath to determine color
                const pathIndex = previewPath.findIndex(p => p.x === tile.x && p.y === tile.y);
                if (pathIndex !== -1) {
                    previewColor = '#22c55e';
                }
            }
        }

        return (
          <CombatTile
            key={`${tile.x}-${tile.y}`}
            position={[tile.x, 0, tile.y]}
            type={tile.type}
            isReachable={!!previewColor}
            previewColor={previewColor}
            isTarget={isTarget}
            onClick={() => handleTileClick(tile.x, tile.y)}
            onHover={(h) => setHoveredTile(h ? { x: tile.x, y: tile.y } : null)}
          />
        );
      })}

      <PathPreview path={previewPath} />

      {Object.values(combatState.players).map((p) => (
        <PlayerMesh
          key={p.playerId}
          gridPosition={p.position}
          colors={getPlayerColors()}
          isCurrent={combatState.currentTurnPlayerId === p.playerId}
          name={p.playerId === user?.id ? 'Vous (Warrior)' : 'Adversaire (Mage)'}
          path={playerPaths[p.playerId]}
          onPathComplete={() => setPlayerPaths(prev => {
              const next = { ...prev };
              delete next[p.playerId];
              return next;
          })}
        />
      ))}

      {vfx.map(v => (
          <SpellVFX
            key={v.id}
            type={v.type}
            from={v.from}
            to={v.to}
            onComplete={() => setVfx(prev => prev.filter(x => x.id !== v.id))}
          />
      ))}

      {popups.map(popup => (
          <DamagePopup
            key={popup.id}
            position={popup.pos}
            value={popup.val}
            onComplete={() => setPopups(prev => prev.filter(p => p.id !== popup.id))}
          />
      ))}
    </group>
  );
}
