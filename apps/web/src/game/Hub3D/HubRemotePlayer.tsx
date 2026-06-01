import type { HubChatMessage, HubPlayerSnapshot } from '@game/shared-types';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { Vector3, type Group } from 'three';


import { useHubGround } from './HubGround';
import { HubPawn } from './HubPawn';
import { ARRIVAL_THRESHOLD, PLAYER_SPEED, PLAYER_VERTICAL_OFFSET } from './constants';

const TARGET = new Vector3();
const STEP = new Vector3();
const TELEPORT_THRESHOLD = 6;
const BUBBLE_TTL_MS = 4000;

interface HubRemotePlayerProps {
  snapshot: HubPlayerSnapshot;
  lastMessage?: HubChatMessage;
}

function moveGroup(group: Group, target: Vector3, delta: number, snapY: (x: number, z: number) => number): void {
  STEP.set(target.x - group.position.x, 0, target.z - group.position.z);
  const distance = STEP.length();
  if (distance < ARRIVAL_THRESHOLD) {
    group.position.x = target.x;
    group.position.z = target.z;
    group.position.y = snapY(group.position.x, group.position.z);
    return;
  }
  const step = Math.min(PLAYER_SPEED * delta, distance);
  STEP.divideScalar(distance);
  group.position.x += STEP.x * step;
  group.position.z += STEP.z * step;
  group.position.y = snapY(group.position.x, group.position.z);
}

function maybeTeleport(group: Group, snapshot: HubPlayerSnapshot): void {
  const dx = group.position.x - snapshot.position.x;
  const dz = group.position.z - snapshot.position.z;
  if (Math.hypot(dx, dz) > TELEPORT_THRESHOLD) {
    group.position.set(snapshot.position.x, group.position.y, snapshot.position.z);
  }
}

export function HubRemotePlayer({ snapshot, lastMessage }: HubRemotePlayerProps): ReactElement {
  const ref = useRef<Group>(null);
  const { snapY, ready } = useHubGround();
  const [initialPos] = useState<[number, number, number]>(() => [
    snapshot.position.x,
    snapshot.position.x === 0 && snapshot.position.z === 0 ? 0 : snapY(snapshot.position.x, snapshot.position.z),
    snapshot.position.z,
  ]);

  useEffect(() => {
    const group = ref.current;
    if (!group || !ready) return;
    maybeTeleport(group, snapshot);
  }, [snapshot, ready]);

  useFrame((_, delta): void => {
    const group = ref.current;
    if (!group) return;
    const target = snapshot.target ?? snapshot.position;
    TARGET.set(target.x, 0, target.z);
    moveGroup(group, TARGET, delta, snapY);
  });

  return (
    <group ref={ref} position={initialPos}>
      <HubPawn skinId={snapshot.skin} />
      <NameTag username={snapshot.username} />
      {lastMessage ? <ChatBubble message={lastMessage} /> : null}
    </group>
  );
}

const NAME_STYLE: CSSProperties = {
  background: 'rgba(0, 0, 0, 0.6)',
  border: '2px solid rgba(255, 255, 255, 0.55)',
  outline: '1.5px solid rgba(0, 0, 0, 0.85)',
  color: '#ffffff',
  padding: '2px 8px',
  borderRadius: 6,
  fontSize: 11,
  letterSpacing: '0.04em',
  fontFamily: 'var(--font-hud)',
  textShadow:
    '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 -1.5px 0 #000, 0 1.5px 0 #000, -1.5px 0 0 #000, 1.5px 0 0 #000',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  transform: 'translate(-50%, -100%)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
};

function NameTag({ username }: { username: string }): ReactElement {
  return (
    <Html position={[0, PLAYER_VERTICAL_OFFSET + 1.4, 0]} center occlude={false} zIndexRange={[20, 0]}>
      <div style={NAME_STYLE}>{username}</div>
    </Html>
  );
}

const BUBBLE_STYLE: CSSProperties = {
  background: 'rgba(0, 0, 0, 0.85)',
  border: '2px solid rgba(255, 255, 255, 0.9)',
  outline: '1.5px solid rgba(0, 0, 0, 0.85)',
  color: '#ffffff',
  padding: '6px 10px',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: 'var(--font-hud)',
  display: 'inline-block',
  width: 'max-content',
  maxWidth: 280,
  pointerEvents: 'none',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  transform: 'translate(-50%, -100%)',
  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(0, 0, 0, 0.75)',
  textAlign: 'center',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

function ChatBubble({ message }: { message: HubChatMessage }): ReactElement | null {
  const expiresAt = useMemo(() => message.sentAt + BUBBLE_TTL_MS, [message]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return (): void => window.clearInterval(t);
  }, []);
  if (now > expiresAt) return null;
  return (
    <Html position={[0, PLAYER_VERTICAL_OFFSET + 2.1, 0]} center occlude={false} zIndexRange={[30, 0]}>
      <div style={BUBBLE_STYLE}>{message.text}</div>
    </Html>
  );
}
