import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'

// Shows a car in 3D.
// - Sketchfab links are shown in Sketchfab's own viewer.
// - .glb files are loaded into our own Three.js scene.
export default function CarViewer({ modelUrl, title = '3D car model' }) {
  if (!modelUrl) {
    return <div className="viewer viewer-empty">3D model coming soon</div>
  }

  if (modelUrl.includes('sketchfab.com')) {
    const src = `${modelUrl}?autostart=1&preload=1&ui_theme=dark&ui_infos=0&ui_watermark=0`
    return (
      <div className="viewer">
        <iframe
          title={title}
          src={src}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className="viewer">
      <Canvas camera={{ position: [4, 2, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <GlbModel url={modelUrl} />
        <OrbitControls enablePan={false} />
        <Environment preset="city" />
      </Canvas>
    </div>
  )
}

function GlbModel({ url }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}
