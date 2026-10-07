import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Grid, OrbitControls, useBounds } from '@react-three/drei'
import type { Object3D } from 'three'

function Fit({ object }: { object: Object3D }) {
  const bounds = useBounds()
  useEffect(() => {
    bounds.refresh(object).clip().fit()
  }, [bounds, object])
  return null
}

export function Viewport({ object }: { object: Object3D | null }) {
  return (
    <div className="viewport">
      <Canvas camera={{ position: [3, 2.5, 4], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={['#14161a']} />
        <hemisphereLight args={['#dfe8ff', '#3a3f4a', 1.4]} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} />
        <Grid
          args={[20, 20]}
          cellSize={0.5}
          sectionSize={2.5}
          cellColor="#2a2f38"
          sectionColor="#3d4552"
          fadeDistance={25}
          infiniteGrid
        />
        <Bounds margin={1.4}>
          {object && (
            <>
              <primitive object={object} />
              <Fit object={object} />
            </>
          )}
        </Bounds>
        <OrbitControls makeDefault enableDamping />
      </Canvas>
      {!object && <p className="empty">Generate a prop or load a sample to preview it here.</p>}
    </div>
  )
}
