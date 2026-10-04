import { Ratio } from 'react-bootstrap'
import CarArt, { buildArtProps } from './CarArt.jsx'

// Shows a build's latest AI preview, or a drawing if none exists yet
export default function BuildImage({ build }) {
  const preview = build.previews?.[0]
  return (
    <Ratio aspectRatio="16x9" className="bg-body-secondary rounded">
      <div className="d-flex align-items-center justify-content-center p-3">
        {preview
          ? <img src={preview.image_url} alt={`AI preview of ${build.name}`} className="w-100 h-100 rounded" style={{ objectFit: 'cover' }} />
          : <CarArt {...buildArtProps(build)} />}
      </div>
    </Ratio>
  )
}
